import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  unwrapApiEnvelope,
  isVerifyOtpTotpChallenge,
  type VerifyOtpPayload,
  type StaffUser,
} from '@societyos/api-client';
import { api } from '../../src/lib/api';
import { useAuthStore } from '../../src/store/auth.store';

const OTP_LENGTH = 4;
const RESEND_SECONDS = 30;

/** Same regional-script normalisation as phone-entry — see the note there. */
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

const toAsciiDigits = (input: string) =>
  Array.from(input)
    .map((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      for (const [start, end] of NUMERIC_RANGES) {
        if (code >= start && code <= end) return String.fromCharCode(0x30 + (code - start));
      }
      return ch;
    })
    .join('')
    .replace(/\D/g, '');

/**
 * OTP entry: ONE hidden input behind four drawn boxes.
 *
 * The previous version rendered four real `TextInput`s, which is the pattern
 * that looks right and behaves badly:
 *   • Paste was broken — `text.slice(-1)` kept only the LAST character, so
 *     pasting "4821" put "1" in one box and discarded the code.
 *   • Android/iOS one-time-code autofill targets a single field, so tapping
 *     the keyboard's SMS suggestion filled box one and stopped.
 *   • Backspace across boxes depended on `onKeyPress`, which Android does not
 *     reliably deliver for an already-empty field.
 *
 * With a single input holding the whole code, paste, autofill and backspace
 * are the platform's own behaviour and need no custom handling. The boxes are
 * plain Views, so they are purely presentational.
 */
export default function OtpVerifyScreen() {
  const { phone, societyId: paramSocietyId } = useLocalSearchParams<{
    phone: string;
    societyId?: string;
  }>();
  const societyId = paramSocietyId ?? '';
  const setAuth = useAuthStore((s) => s.setAuth);

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState(RESEND_SECONDS);

  const hiddenInput = useRef<TextInput | null>(null);
  // Guards against the auto-submit firing twice (e.g. autofill setting the
  // value while the user is also typing the last digit).
  const submitting = useRef(false);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const t = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCountdown]);

  const handleChange = (text: string) => {
    const digits = toAsciiDigits(text).slice(0, OTP_LENGTH);
    setCode(digits);
    if (error) setError(null);
    if (digits.length === OTP_LENGTH) {
      Haptics.selectionAsync().catch(() => {});
      void handleVerify(digits);
    }
  };

  const handleVerify = async (value: string) => {
    if (submitting.current) return;
    if (!societyId) {
      router.replace('/(auth)/society-select' as any);
      return;
    }
    submitting.current = true;
    setLoading(true);
    setError(null);
    try {
      const raw = await api.post<object>('/auth/verify-otp', {
        phone: `+91${phone}`,
        otp: value,
        societyId,
      });
      const res = unwrapApiEnvelope<VerifyOtpPayload>(raw);

      if (isVerifyOtpTotpChallenge(res)) {
        setError(
          'This account needs two-factor authentication. Please use the admin portal or contact support.',
        );
        setCode('');
        return;
      }

      const accessToken = res.accessToken || res.token;
      if (!accessToken) throw new Error('Login response did not include an access token.');

      const user: StaffUser = {
        id: res.user.id,
        name: res.user.name ?? '',
        phone: res.user.phone,
        role: res.user.role,
        societyId: res.user.societyId ?? societyId,
      };

      await setAuth(accessToken, res.refreshToken ?? null, user);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace('/(tabs)');
    } catch (err) {
      // Inline, not an Alert: the old modal had to be dismissed before the
      // user could even see the boxes again, and it cleared the code out from
      // under them with no explanation left on screen.
      setError(err instanceof Error ? err.message : 'That code did not work. Please try again.');
      setCode('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      hiddenInput.current?.focus();
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resending || resendCountdown > 0) return;
    setResending(true);
    setError(null);
    try {
      await api.post('/auth/send-otp', { phone: `+91${phone}`, societyId });
      setResendCountdown(RESEND_SECONDS);
      setCode('');
      hiddenInput.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend the code.');
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-primary-500">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* Top-aligned inside a scroll view: with `justify-center` the block
            sat mid-screen and the number pad covered the resend control. */}
        <ScrollView
          contentContainerClassName="flex-grow px-7 pt-10 pb-8"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={12}
            className="w-11 h-11 rounded-full bg-white/15 items-center justify-center mb-8"
          >
            <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>

          <Text className="text-3xl font-heading text-white mb-2" accessibilityRole="header">
            Enter the code
          </Text>
          <View className="flex-row items-center flex-wrap mb-9">
            <Text className="font-body text-primary-100 text-base">
              Sent to +91 {phone}
            </Text>
            <TouchableOpacity
              onPress={() => router.back()}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Change number"
              className="ml-2"
            >
              <Text className="font-body text-white text-base underline">Change</Text>
            </TouchableOpacity>
          </View>

          {/* The real input — visually hidden, holds the whole code. Kept in
              the tree (not display:none) so the platform can autofill it. */}
          <TextInput
            ref={hiddenInput}
            value={code}
            onChangeText={handleChange}
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={OTP_LENGTH}
            autoFocus
            // These two are what make the OS offer the code from the SMS.
            autoComplete="sms-otp"
            textContentType="oneTimeCode"
            accessibilityLabel={`Enter the ${OTP_LENGTH}-digit code`}
            style={{ position: 'absolute', opacity: 0, height: 1, width: 1, top: -100 }}
          />

          {/* Tapping anywhere on the boxes focuses the hidden field. */}
          <Pressable
            onPress={() => hiddenInput.current?.focus()}
            accessibilityRole="button"
            accessibilityLabel="Edit code"
            className="flex-row justify-center gap-3 mb-6"
          >
            {Array.from({ length: OTP_LENGTH }).map((_, i) => {
              const char = code[i] ?? '';
              const active = i === code.length;
              return (
                <View
                  key={i}
                  className={`w-16 h-[68px] rounded-2xl items-center justify-center border-2 ${
                    error
                      ? 'bg-white/10 border-red-300'
                      : char
                        ? 'bg-white border-white'
                        : active
                          ? 'bg-white/15 border-white'
                          : 'bg-white/10 border-white/25'
                  }`}
                >
                  {char ? (
                    <Text className="text-primary-500 font-heading" style={{ fontSize: 28 }}>
                      {char}
                    </Text>
                  ) : active ? (
                    <View className="w-0.5 h-7 bg-white/80" />
                  ) : null}
                </View>
              );
            })}
          </Pressable>

          {error ? (
            <View className="flex-row items-start mb-4">
              <Ionicons name="alert-circle" size={16} color="#FECACA" />
              <Text className="font-body text-sm text-red-100 ml-2 flex-1">{error}</Text>
            </View>
          ) : null}

          {loading ? (
            <View className="flex-row items-center justify-center mb-4">
              <ActivityIndicator color="white" />
              <Text className="font-body text-primary-100 text-sm ml-2">Checking…</Text>
            </View>
          ) : null}

          <View className="items-center mt-2">
            {resendCountdown > 0 ? (
              <Text className="font-body text-primary-100/80 text-sm">
                Didn&apos;t get it? Resend in {resendCountdown}s
              </Text>
            ) : (
              <TouchableOpacity
                onPress={handleResend}
                disabled={resending}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Resend code"
                className="py-2 px-4"
              >
                <Text className="text-white font-heading text-sm underline">
                  {resending ? 'Sending…' : 'Resend code'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View className="flex-1" />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
