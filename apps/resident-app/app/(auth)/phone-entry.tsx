import { useState, useEffect, useRef } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Platform, Pressable, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { api } from '../../src/lib/api';
import { requestPhoneNumberHint } from '../../src/hooks/useSmsOtpAutoRead';
import { useTheme } from '../../src/hooks/useTheme';
import { ThemedText, ThemedButton } from '../../src/components/ui';

// requires: npx expo install expo-local-authentication
let LocalAuthentication: typeof import('expo-local-authentication') | null = null;
try {
  LocalAuthentication = require('expo-local-authentication');
} catch {
  // package not available; biometric features disabled
}

// Normalize digits from non-Latin scripts (Devanagari, Arabic-Indic, Persian,
// Bengali, Gujarati, Tamil, Telugu, Kannada) to ASCII 0-9. Required because
// the user's keyboard may be set to a regional script — then `\d` regex and
// backend validation reject the input.
const NUMERIC_RANGES: Array<[number, number]> = [
  [0x0660, 0x0669], // Arabic-Indic
  [0x06f0, 0x06f9], // Extended Arabic-Indic (Persian/Urdu)
  [0x0966, 0x096f], // Devanagari (Hindi)
  [0x09e6, 0x09ef], // Bengali
  [0x0a66, 0x0a6f], // Gurmukhi
  [0x0ae6, 0x0aef], // Gujarati
  [0x0b66, 0x0b6f], // Oriya
  [0x0be6, 0x0bef], // Tamil
  [0x0c66, 0x0c6f], // Telugu
  [0x0ce6, 0x0cef], // Kannada
  [0x0d66, 0x0d6f], // Malayalam
];
const toAsciiDigits = (input: string) =>
  Array.from(input)
    .map((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      for (const [start, end] of NUMERIC_RANGES) {
        if (code >= start && code <= end) {
          return String.fromCharCode(0x30 + (code - start));
        }
      }
      return ch;
    })
    .join('')
    .replace(/\D/g, '');

const formatPhoneDisplay = (digits: string) => {
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)} ${digits.slice(5)}`;
};

const SUPPORT_PHONE = '+918047188888';

export default function PhoneEntryScreen() {
  const t = useTheme();
  const { societyId, societyName } = useLocalSearchParams<{ societyId: string; societyName: string }>();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // On app open: if biometric login is enabled and a token exists, offer biometric auth
    const tryBiometric = async () => {
      try {
        if (!LocalAuthentication) return;
        const biometricEnabled = await SecureStore.getItemAsync('biometricEnabled');
        const token = await SecureStore.getItemAsync('auth_token');
        if (biometricEnabled !== 'true' || !token) return;

        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Sign in to Society App',
          fallbackLabel: 'Use PIN',
          cancelLabel: 'Use phone number',
        });
        if (result.success) {
          router.replace('/(tabs)');
        }
      } catch {
        // biometric auth non-critical; show normal login
      }
    };
    tryBiometric();
  }, []);

  // Android: offer the system phone-number picker once, so the common case is
  // "tap your own number" instead of typing ten digits. Delayed slightly so it
  // does not race the screen transition, and fired only once per mount — the
  // sheet reappearing after a dismissal would be obnoxious. A null result
  // (dismissed, no Play Services, no SIM) silently leaves manual entry.
  const hintTried = useRef(false);
  useEffect(() => {
    if (hintTried.current) return;
    hintTried.current = true;
    const t = setTimeout(() => {
      requestPhoneNumberHint().then((num) => {
        if (num) setPhone(num);
      });
    }, 600);
    return () => clearTimeout(t);
  }, []);

  const isValid = phone.length === 10;

  const handlePhoneChange = (text: string) => setPhone(toAsciiDigits(text));

  const handleSend = async () => {
    if (!isValid) return;
    setLoading(true);
    try {
      const formattedPhone = `+91${phone}`;
      await api.post('/auth/send-otp', { phone: formattedPhone, societyId });
      router.push({ pathname: '/(auth)/otp-verify', params: { phone: formattedPhone, societyId } });
    } catch (err: any) {
      Alert.alert('We could not send the code', err?.message ?? 'Please check your number and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleNeedHelp = () => {
    Linking.openURL(`tel:${SUPPORT_PHONE}`).catch(() => {
      Alert.alert('Support', `Please call ${SUPPORT_PHONE} for help.`);
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bgPrimary }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <View style={{ flex: 1, paddingHorizontal: t.screenPadding, paddingTop: t.sectionGap }}>
        {/* Back — icon-only button, left-edge aligned with the heading. Using
            an icon avoids the glyph-metric drift that comes with a leading
            arrow + word, which made the text look indented. */}
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={12}
          style={{
            width: 44,
            height: 44,
            borderRadius: t.radiusMd,
            borderWidth: 1,
            borderColor: t.borderSubtle,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: t.sectionGap,
          }}
        >
          <ThemedText
            color={t.textPrimary}
            style={{ fontSize: 22, lineHeight: 22, marginTop: -2 /* optical centering for arrow glyph */ }}
          >
            ←
          </ThemedText>
        </Pressable>

        {/* Heading block */}
        <View style={{ marginBottom: t.sectionGap }}>
          <ThemedText
            variant="heading"
            accessibilityRole="header"
            style={{ marginBottom: 8 }}
          >
            Enter your number
          </ThemedText>
          {societyName ? (
            <ThemedText variant="body" color={t.textSecondary}>
              Signing in to {societyName}
            </ThemedText>
          ) : null}
        </View>

        {/* Country-code + number input */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: t.bgCard,
            borderRadius: t.radiusLg,
            paddingHorizontal: t.cardPadding,
            paddingVertical: 12,
            borderWidth: 2,
            borderColor: isValid ? t.accentPrimary : t.borderSubtle,
            minHeight: t.touchTargetLg,
            marginBottom: t.sectionGap,
          }}
        >
          <View
            style={{
              backgroundColor: 'rgba(130,26,82,0.10)',
              borderRadius: t.radiusSm,
              paddingHorizontal: 14,
              paddingVertical: 8,
              marginRight: 14,
            }}
          >
            <ThemedText weight="bold" color={t.accentPrimary} style={{ fontSize: t.fontLg }}>
              +91
            </ThemedText>
          </View>
          <TextInput
            value={formatPhoneDisplay(phone)}
            onChangeText={handlePhoneChange}
            placeholder="98765 43210"
            placeholderTextColor={t.textMuted}
            keyboardType="number-pad"
            inputMode="numeric"
            textContentType="none"
            autoComplete="off"
            importantForAutofill="no"
            autoCorrect={false}
            spellCheck={false}
            maxLength={11 /* 10 digits + 1 inserted space */}
            autoFocus
            accessibilityLabel="Mobile number"
            accessibilityHint="Enter your 10-digit Indian mobile number"
            style={{
              flex: 1,
              fontSize: t.font2xl,
              fontWeight: '600',
              color: t.textPrimary,
              letterSpacing: 1.5,
              padding: 0, // some Androids add extra vertical padding
            }}
          />
        </View>

        {/* Helper — readable, not whisper-grey */}
        <ThemedText variant="body" color={t.textSecondary} style={{ marginBottom: t.sectionGap }}>
          We will send a 4-digit code to this number so we know it&apos;s you.
        </ThemedText>

        {/* Primary CTA — large, prominent */}
        <ThemedButton
          label={loading ? 'Sending…' : 'Send code'}
          onPress={handleSend}
          disabled={!isValid}
          loading={loading}
          size="lg"
          accessibilityLabel="Send verification code"
          accessibilityHint="Sends a 4-digit code to your mobile number"
        />

        {/* Need help — bottom anchor, clearly visible */}
        <View style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: t.sectionGap }}>
          <Pressable
            onPress={handleNeedHelp}
            accessibilityRole="button"
            accessibilityLabel="Call support"
            accessibilityHint="Opens your phone app to call Marzi support"
            hitSlop={12}
            style={{
              minHeight: t.touchTargetSm,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: t.radiusMd,
              borderWidth: 1,
              borderColor: t.borderSubtle,
              paddingVertical: 12,
            }}
          >
            <ThemedText variant="body" weight="semibold" color={t.accentPrimary}>
              Need help? Tap to call us
            </ThemedText>
          </Pressable>
        </View>
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
