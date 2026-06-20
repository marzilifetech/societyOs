import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import {
  unwrapApiEnvelope,
  isVerifyOtpTotpChallenge,
  type VerifyOtpPayload,
} from '@societyos/api-client';
import { api } from '../../src/lib/api';
import { useAuthStore } from '../../src/store/auth.store';

// requires: npx expo install expo-local-authentication
let LocalAuthentication: typeof import('expo-local-authentication') | null = null;
try {
  LocalAuthentication = require('expo-local-authentication');
} catch {
  // package not available; biometric features disabled
}

const OTP_LENGTH = 4;

export default function OtpVerifyScreen() {
  const { phone, societyId } = useLocalSearchParams<{ phone: string; societyId: string }>();
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const inputs = useRef<(TextInput | null)[]>([]);
  const setAuth = useAuthStore((s) => s.setAuth);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  // Normalize Devanagari/Arabic-Indic/etc. digits to ASCII 0-9 — regional
  // keyboards may produce non-Latin numerals which fail the backend regex.
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
  const toAsciiDigit = (ch: string) => {
    const code = ch.codePointAt(0) ?? 0;
    for (const [start, end] of NUMERIC_RANGES) {
      if (code >= start && code <= end) return String.fromCharCode(0x30 + (code - start));
    }
    return /\d/.test(ch) ? ch : '';
  };

  const handleChange = (text: string, index: number) => {
    const digit = toAsciiDigit(text.slice(-1));
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);
    if (digit && index < OTP_LENGTH - 1) inputs.current[index + 1]?.focus();
    if (newOtp.every(Boolean)) handleVerify(newOtp.join(''));
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (code?: string) => {
    const finalOtp = code ?? otp.join('');
    if (finalOtp.length !== OTP_LENGTH) return;
    setLoading(true);
    try {
      const raw = await api.post<object>('/auth/verify-otp', {
        phone,
        societyId,
        otp: finalOtp,
      });
      const res = unwrapApiEnvelope<VerifyOtpPayload>(raw);

      if (isVerifyOtpTotpChallenge(res)) {
        Alert.alert('2FA required', 'Please complete verification through the channel your society uses.');
        return;
      }

      const token = res.accessToken || res.token;
      if (!token) {
        throw new Error('Login response did not include a token.');
      }

      await setAuth(token, res.refreshToken ?? null, res.user, societyId);

      // Biometric enrollment prompt after successful login
      try {
        if (LocalAuthentication) {
          const hasHardware = await LocalAuthentication.hasHardwareAsync();
          const isEnrolled = await LocalAuthentication.isEnrolledAsync();
          const alreadyEnabled = await SecureStore.getItemAsync('biometricEnabled');
          if (hasHardware && isEnrolled && alreadyEnabled !== 'true') {
            Alert.alert(
              'Enable biometric login',
              'Use Face ID / fingerprint to sign in next time?',
              [
                { text: 'Not now', style: 'cancel' },
                {
                  text: 'Enable',
                  onPress: async () => {
                    await SecureStore.setItemAsync('biometricEnabled', 'true');
                  },
                },
              ],
            );
          }
        }
      } catch {
        // biometric check non-critical; continue
      }

      // Even with status=ACTIVE, the user may not have a Resident row (admin
      // manually edited status, or onboarding was skipped). The (tabs) layout
      // also guards against this, but routing them straight there causes a
      // visible 404-then-redirect flicker. Probe /residents/me first so the
      // user lands on the correct screen on the first frame.
      let routeTarget: '/(tabs)' | '/(auth)/profile-setup' | '/(auth)/pending-approval' = '/(auth)/profile-setup';
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
      Alert.alert('Invalid OTP', err instanceof Error ? err.message : 'Please try again');
      setOtp(Array(OTP_LENGTH).fill(''));
      inputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    await api.post('/auth/send-otp', { phone, societyId });
    setCountdown(30);
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-6 pt-12">
        <TouchableOpacity className="mb-8" onPress={() => router.back()}>
          <Text className="text-primary-500 text-base">← Back</Text>
        </TouchableOpacity>

        <View className="mb-10">
          <Text className="text-3xl font-bold text-gray-900 mb-2">Verify OTP</Text>
          <Text className="text-base text-gray-500">
            Sent to <Text className="font-semibold text-gray-700">{phone}</Text>
          </Text>
        </View>

        <View className="flex-row justify-between mb-10">
          {otp.map((digit, i) => (
            <TextInput
              key={i}
              ref={(ref) => { inputs.current[i] = ref; }}
              className="w-12 h-14 border-2 rounded-2xl text-center text-2xl font-bold text-gray-900"
              style={{ borderColor: digit ? '#3B3FBF' : '#E5E7EB' }}
              value={digit}
              onChangeText={(text) => handleChange(text, i)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
              keyboardType="number-pad"
              maxLength={1}
              autoFocus={i === 0}
            />
          ))}
        </View>

        <TouchableOpacity
          className="bg-primary-500 rounded-2xl py-4 items-center mb-6"
          onPress={() => handleVerify()}
          disabled={loading || otp.some((d) => !d)}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white text-base font-semibold">Verify</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={handleResend} disabled={countdown > 0} className="items-center">
          <Text className={`text-base ${countdown > 0 ? 'text-gray-400' : 'text-primary-500 font-semibold'}`}>
            {countdown > 0 ? `Resend in ${countdown}s` : 'Resend OTP'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
