import { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  unwrapApiEnvelope,
  isVerifyOtpTotpChallenge,
  type VerifyOtpPayload,
  type StaffUser,
} from '@societyos/api-client';
import { api } from '../../src/lib/api';
import { useAuthStore } from '../../src/store/auth.store';

const OTP_LENGTH = 4;

export default function OtpVerifyScreen() {
  const { phone, societyId: paramSocietyId } = useLocalSearchParams<{ phone: string; societyId?: string }>();
  const societyId = paramSocietyId ?? process.env.EXPO_PUBLIC_SOCIETY_ID!;
  const setAuth = useAuthStore((s) => s.setAuth);
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(30);
  const inputs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const t = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCountdown]);

  const handleChange = (text: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = text.slice(-1);
    setOtp(newOtp);
    if (text && index < OTP_LENGTH - 1) inputs.current[index + 1]?.focus();
    if (newOtp.every(Boolean)) handleVerify(newOtp.join(''));
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (code: string) => {
    setLoading(true);
    try {
      const raw = await api.post<object>('/auth/verify-otp', {
        phone: `+91${phone}`,
        otp: code,
        societyId,
      });
      const res = unwrapApiEnvelope<VerifyOtpPayload>(raw);

      if (isVerifyOtpTotpChallenge(res)) {
        Alert.alert(
          '2FA required',
          'This account requires two-factor authentication. Use the admin portal or contact support.',
        );
        setOtp(Array(OTP_LENGTH).fill(''));
        return;
      }

      const accessToken = res.accessToken || res.token;
      if (!accessToken) {
        throw new Error('Login response did not include an access token.');
      }

      const user: StaffUser = {
        id: res.user.id,
        name: res.user.name ?? '',
        phone: res.user.phone,
        role: res.user.role,
        societyId: res.user.societyId ?? societyId,
      };

      await setAuth(accessToken, res.refreshToken ?? null, user);
      router.replace('/(tabs)');
    } catch (err) {
      Alert.alert('Invalid OTP', err instanceof Error ? err.message : 'Something went wrong');
      setOtp(Array(OTP_LENGTH).fill(''));
      inputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      await api.post('/auth/send-otp', { phone: `+91${phone}`, societyId });
      setResendCountdown(30);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Something went wrong');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-primary-500">
      <View className="flex-1 px-8 justify-center">
        <TouchableOpacity onPress={() => router.back()} className="mb-8">
          <Text className="text-blue-200 text-base">← Back</Text>
        </TouchableOpacity>

        <Text className="text-3xl font-bold text-white mb-2">Enter OTP</Text>
        <Text className="text-blue-200 text-base mb-8">
          Sent to +91 {phone}
        </Text>

        <View className="flex-row gap-3 justify-center mb-8">
          {otp.map((digit, i) => (
            <TextInput
              key={i}
              ref={(el) => { inputs.current[i] = el; }}
              className={`w-12 h-14 text-center text-xl font-bold rounded-2xl border ${
                digit ? 'bg-white border-white text-primary-500' : 'bg-white/10 border-white/20 text-white'
              }`}
              value={digit}
              onChangeText={(t) => handleChange(t, i)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
            />
          ))}
        </View>

        {loading && (
          <View className="items-center mb-4">
            <ActivityIndicator color="white" />
          </View>
        )}

        <View className="items-center">
          {resendCountdown > 0 ? (
            <Text className="text-blue-300 text-sm">Resend in {resendCountdown}s</Text>
          ) : (
            <TouchableOpacity onPress={handleResend}>
              <Text className="text-white font-semibold text-sm">Resend OTP</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
