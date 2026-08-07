import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  Pressable,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import {
  unwrapApiEnvelope,
  isVerifyOtpTotpChallenge,
  type VerifyOtpPayload,
} from '@societyos/api-client';
import { api } from '../../src/lib/api';
import { useAuthStore } from '../../src/store/auth.store';
import { Display, rd } from '../../src/components/ui/redesign';
import { Tappable } from '../../src/components/ui/Tappable';
import { useSmsOtpAutoRead } from '../../src/hooks/useSmsOtpAutoRead';

// requires: npx expo install expo-local-authentication
let LocalAuthentication: typeof import('expo-local-authentication') | null = null;
try {
  LocalAuthentication = require('expo-local-authentication');
} catch {
  // package not available; biometric features disabled
}

const OTP_LENGTH = 4;
const RESEND_SECONDS = 30;

// Regional keyboards can emit non-Latin numerals, which fail the backend regex.
const NUMERIC_RANGES: Array<[number, number]> = [
  [0x0660, 0x0669],
  [0x06f0, 0x06f9],
  [0x0966, 0x096f],
  [0x09e6, 0x09ef],
  [0x0a66, 0x0a6f],
  [0x0ae6, 0x0aef],
  [0x0b66, 0x0b6f],
  [0x0be6, 0x0bef],
  [0x0c66, 0x0c6f],
  [0x0ce6, 0x0cef],
  [0x0d66, 0x0d6f],
];

function toAsciiDigits(text: string): string {
  let out = '';
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    let mapped = '';
    for (const [start, end] of NUMERIC_RANGES) {
      if (code >= start && code <= end) {
        mapped = String.fromCharCode(0x30 + (code - start));
        break;
      }
    }
    if (mapped) out += mapped;
    else if (/\d/.test(ch)) out += ch;
  }
  return out;
}

/** +919876543210 → +91 98765 43210 */
function formatPhone(raw?: string): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  const local = digits.length > 10 ? digits.slice(-10) : digits;
  const cc = digits.length > 10 ? digits.slice(0, digits.length - 10) : '';
  const spaced = local.replace(/(\d{5})(\d{5})/, '$1 $2');
  return cc ? `+${cc} ${spaced}` : spaced;
}

export default function OtpVerifyScreen() {
  const { phone, societyId } = useLocalSearchParams<{ phone: string; societyId: string }>();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_SECONDS);
  const [resending, setResending] = useState(false);
  const hiddenInput = useRef<TextInput | null>(null);
  const setAuth = useAuthStore((s) => s.setAuth);
  // Guards the auto-submit so an SMS arriving mid-verify can't fire twice.
  const submittingRef = useRef(false);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  useEffect(() => {
    const t = setTimeout(() => hiddenInput.current?.focus(), 400);
    return () => clearTimeout(t);
  }, []);

  const fillCode = useCallback((sms: string) => {
    const digits = toAsciiDigits(sms).slice(0, OTP_LENGTH);
    if (digits.length !== OTP_LENGTH) return;
    setCode(digits);
    setError(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    void handleVerify(digits);
    // handleVerify is stable enough for this one-shot path.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Android SMS Retriever — fills the code the moment the SMS lands.
  useSmsOtpAutoRead(OTP_LENGTH, fillCode);

  const handleChange = (text: string) => {
    const digits = toAsciiDigits(text).slice(0, OTP_LENGTH);
    setCode(digits);
    if (error) setError(null);
    // Submit as soon as the last digit lands — typed, pasted or autofilled.
    if (digits.length === OTP_LENGTH) {
      Haptics.selectionAsync().catch(() => {});
      void handleVerify(digits);
    }
  };

  const handleVerify = async (override?: string) => {
    const finalOtp = override ?? code;
    if (finalOtp.length !== OTP_LENGTH || submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const raw = await api.post<object>('/auth/verify-otp', {
        phone,
        societyId,
        otp: finalOtp,
      });
      const res = unwrapApiEnvelope<VerifyOtpPayload>(raw);

      if (isVerifyOtpTotpChallenge(res)) {
        Alert.alert(
          '2FA required',
          'Please complete verification through the channel your society uses.',
        );
        return;
      }

      const token = res.accessToken || res.token;
      if (!token) throw new Error('Login response did not include a token.');

      await setAuth(token, res.refreshToken ?? null, res.user, societyId);

      try {
        if (LocalAuthentication) {
          const hasHardware = await LocalAuthentication.hasHardwareAsync();
          const isEnrolled = await LocalAuthentication.isEnrolledAsync();
          const alreadyEnabled = await SecureStore.getItemAsync('biometricEnabled');
          if (hasHardware && isEnrolled && alreadyEnabled !== 'true') {
            Alert.alert('Enable biometric login', 'Use Face ID / fingerprint to sign in next time?', [
              { text: 'Not now', style: 'cancel' },
              {
                text: 'Enable',
                onPress: async () => {
                  await SecureStore.setItemAsync('biometricEnabled', 'true');
                },
              },
            ]);
          }
        }
      } catch {
        // biometric check non-critical; continue
      }

      // Even with status=ACTIVE the user may not have a Resident row, so probe
      // /residents/me first and avoid a visible 404-then-redirect flicker.
      let routeTarget: '/(tabs)' | '/(auth)/profile-setup' | '/(auth)/pending-approval' =
        '/(auth)/profile-setup';
      if (res.user.status === 'ACTIVE') {
        try {
          await api.get<any>('/residents/me');
          routeTarget = '/(tabs)';
        } catch {
          routeTarget = '/(auth)/pending-approval';
        }
      }
      router.replace(routeTarget as any);
    } catch (err) {
      // Inline error, not an Alert: a modal here hides the boxes the user needs
      // to correct and takes an extra dismiss tap on every mistyped code.
      setError(err instanceof Error ? err.message : 'That code did not work. Please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setCode('');
      hiddenInput.current?.focus();
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || resending) return;
    setResending(true);
    setError(null);
    try {
      await api.post('/auth/send-otp', { phone, societyId });
      setCode('');
      hiddenInput.current?.focus();
      setCountdown(RESEND_SECONDS);
      Haptics.selectionAsync().catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not resend the code.');
    } finally {
      setResending(false);
    }
  };

  const complete = code.length === OTP_LENGTH;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Tappable
            onPress={() => router.back()}
            style={styles.backBtn}
            pressedStyle={{ opacity: 0.7 }}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={22} color="#141414" />
          </Tappable>

          <View style={styles.iconWrap}>
            <Ionicons name="chatbubble-ellipses" size={26} color="#821A52" />
          </View>

          <Display size="lg">Enter the code</Display>
          <Text style={styles.sub}>
            We sent a {OTP_LENGTH}-digit code to{'\n'}
            <Text style={styles.phone}>{formatPhone(phone)}</Text>
          </Text>

          <Tappable
            onPress={() => router.back()}
            style={styles.changeBtn}
            pressedStyle={{ opacity: 0.6 }}
            accessibilityRole="button"
            accessibilityLabel="Change phone number"
          >
            <Ionicons name="create-outline" size={14} color="#821A52" />
            <Text style={styles.changeText}>Change number</Text>
          </Tappable>

          {/* ONE real input behind four drawn boxes.
              Four separate TextInputs meant juggling refs and focus: tapping a
              middle box let you type out of order, backspace hopped
              unpredictably, and autofill delivered the whole code into a single
              box that only kept one character. A single field removes every one
              of those cases — digits fill left to right, backspace just works,
              and paste/autofill lands correctly because there is one value. */}
          <Pressable
            onPress={() => hiddenInput.current?.focus()}
            style={styles.boxRow}
            accessibilityRole="none"
            // The real control for a11y is the TextInput below; the boxes are
            // decoration, so they stay out of the accessibility tree.
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {Array.from({ length: OTP_LENGTH }).map((_, i) => {
              const char = code[i] ?? '';
              const active = focused && i === Math.min(code.length, OTP_LENGTH - 1);
              return (
                <View
                  key={i}
                  style={[
                    styles.box,
                    !!char && styles.boxFilled,
                    active && styles.boxActive,
                    !!error && styles.boxError,
                  ]}
                >
                  <Text style={styles.boxText}>{char}</Text>
                  {active && !char ? <View style={styles.caret} /> : null}
                </View>
              );
            })}
          </Pressable>

          <TextInput
            ref={hiddenInput}
            value={code}
            onChangeText={handleChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            keyboardType="number-pad"
            inputMode="numeric"
            // Native one-time-code affordances: Android offers the SMS code
            // above the keyboard, iOS on the QuickType bar.
            autoComplete="sms-otp"
            textContentType="oneTimeCode"
            importantForAutofill="yes"
            maxLength={OTP_LENGTH}
            editable={!loading}
            autoFocus
            caretHidden
            style={styles.hiddenInput}
            accessibilityLabel={`Enter the ${OTP_LENGTH} digit code`}
           accessibilityHint="The code fills in automatically when the SMS arrives"
          />

          {error ? (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle" size={15} color={rd.crimson} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : (
            <Text style={styles.hint}>The code fills in automatically when the SMS arrives.</Text>
          )}

          <Tappable
            onPress={() => handleVerify()}
            disabled={!complete || loading}
            style={[styles.cta, (!complete || loading) && styles.ctaDisabled]}
            pressedStyle={{ opacity: 0.85 }}
            accessibilityRole="button"
            accessibilityLabel="Verify code"
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.ctaText}>Verify</Text>
            )}
          </Tappable>

          <View style={styles.resendRow}>
            {countdown > 0 ? (
              <Text style={styles.resendMuted}>Resend code in {countdown}s</Text>
            ) : (
              <Tappable
                onPress={handleResend}
                disabled={resending}
                style={styles.resendBtn}
                pressedStyle={{ opacity: 0.6 }}
                accessibilityRole="button"
                accessibilityLabel="Resend code"
              >
                <Ionicons name="refresh" size={15} color="#821A52" />
                <Text style={styles.resendText}>
                  {resending ? 'Sending…' : 'Resend code'}
                </Text>
              </Tappable>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F7F7F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(130,26,82,0.09)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
    marginBottom: 18,
  },
  sub: { fontSize: 15, color: '#6B7280', marginTop: 10, lineHeight: 22 },
  phone: { color: '#141414', fontWeight: '700' },
  changeBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10, paddingVertical: 4 },
  changeText: { color: '#821A52', fontWeight: '600', fontSize: 13 },

  boxRow: { flexDirection: 'row', gap: 12, marginTop: 30 },
  box: {
    flex: 1,
    height: 66,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FAFAFA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxFilled: { borderColor: '#821A52', backgroundColor: '#FFFFFF' },
  boxActive: { borderColor: '#821A52', backgroundColor: '#FFFFFF' },
  boxError: { borderColor: rd.crimson, backgroundColor: '#FEF2F4' },
  boxText: { fontSize: 26, fontWeight: '700', color: '#141414' },
  caret: { width: 2, height: 26, borderRadius: 1, backgroundColor: '#821A52' },

  // Off-screen rather than opacity:0 — a zero-opacity input still renders a
  // selection handle on some Android skins, which floats over the boxes.
  hiddenInput: { position: 'absolute', opacity: 0, height: 1, width: 1, top: -100 },

  hint: { fontSize: 12.5, color: '#9CA3AF', marginTop: 14, lineHeight: 18 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  errorText: { flex: 1, fontSize: 13, color: rd.crimson, lineHeight: 18 },

  cta: {
    marginTop: 26,
    backgroundColor: '#821A52',
    borderRadius: rd.radiusPill,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: { backgroundColor: '#E5E7EB' },
  ctaText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },

  resendRow: { alignItems: 'center', marginTop: 20 },
  resendMuted: { color: '#9CA3AF', fontSize: 14 },
  resendBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  resendText: { color: '#821A52', fontWeight: '700', fontSize: 14 },
});
