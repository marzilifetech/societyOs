import { useState, useEffect } from 'react';
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { api } from '../../src/lib/api';

// requires: npx expo install expo-local-authentication
let LocalAuthentication: typeof import('expo-local-authentication') | null = null;
try {
  LocalAuthentication = require('expo-local-authentication');
} catch {
  // package not available; biometric features disabled
}

export default function PhoneEntryScreen() {
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

  const handlePhoneChange = (text: string) => setPhone(toAsciiDigits(text));

  const isValid = phone.length === 10;

  const handleSend = async () => {
    if (!isValid) return;
    setLoading(true);
    try {
      const formattedPhone = `+91${phone}`;
      await api.post('/auth/send-otp', { phone: formattedPhone, societyId });
      router.push({ pathname: '/(auth)/otp-verify', params: { phone: formattedPhone, societyId } });
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-6 pt-6">
        <TouchableOpacity onPress={() => router.back()} className="py-2.5 mb-8">
          <Text className="text-primary-500 text-base">← Back</Text>
        </TouchableOpacity>

        <View className="mb-12">
          <Text className="text-3xl font-bold text-gray-900 mb-2">Enter your number</Text>
          <Text className="text-base text-gray-500">{societyName}</Text>
        </View>

        <View
          className={`flex-row items-center bg-gray-50 rounded-2xl px-4 py-3.5 mb-5 border ${
            isValid ? 'border-primary-500' : 'border-gray-200'
          }`}
        >
          <View className="bg-primary-50 rounded-xl px-3 py-2 mr-3">
            <Text className="text-primary-500 text-base font-bold">+91</Text>
          </View>
          <TextInput
            className="flex-1 text-2xl font-semibold text-gray-900 tracking-widest"
            placeholder="98765 43210"
            placeholderTextColor="#9CA3AF"
            value={phone}
            onChangeText={handlePhoneChange}
            keyboardType="number-pad"
            inputMode="numeric"
            textContentType="telephoneNumber"
            autoComplete="tel-national"
            autoCorrect={false}
            spellCheck={false}
            maxLength={10}
            autoFocus
          />
        </View>

        <Text className="text-sm text-gray-400 text-center mb-10">
          We'll send a 4-digit OTP to verify your number
        </Text>

        <TouchableOpacity
          onPress={handleSend}
          disabled={!isValid || loading}
          className={`rounded-2xl h-14 items-center justify-center ${
            isValid ? 'bg-primary-500' : 'bg-primary-200'
          }`}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-white text-base font-bold">Send OTP</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
