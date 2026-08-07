import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@societyos/theme';
import { api } from '../../src/lib/api';

/**
 * Normalise digits from non-Latin scripts (Devanagari, Arabic-Indic, Bengali,
 * Tamil, Telugu, Kannada…) to ASCII 0-9.
 *
 * Staff phones are very often set to a regional keyboard, which emits e.g.
 * '९' rather than '9'. The old screen passed the raw string straight through:
 * `maxLength` still allowed 10 characters, but `isValid` stripped them with
 * `\D` and the field could never validate — the Get OTP button simply stayed
 * dead with no explanation. Worse, the value POSTed was the un-stripped string,
 * so any stray space or dash went to the API inside the phone number.
 */
const NUMERIC_RANGES: Array<[number, number]> = [
  [0x0660, 0x0669], // Arabic-Indic
  [0x06f0, 0x06f9], // Extended Arabic-Indic (Persian/Urdu)
  [0x0966, 0x096f], // Devanagari (Hindi/Marathi)
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
        if (code >= start && code <= end) return String.fromCharCode(0x30 + (code - start));
      }
      return ch;
    })
    .join('')
    .replace(/\D/g, '');

/** 98765 43210 — the grouping Indian users read a mobile number in. */
const formatPhone = (digits: string) =>
  digits.length <= 5 ? digits : `${digits.slice(0, 5)} ${digits.slice(5)}`;

export default function PhoneEntryScreen() {
  const { societyId, societyName } = useLocalSearchParams<{
    societyId?: string;
    societyName?: string;
  }>();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = phone.length === 10;

  const handleChange = (text: string) => {
    setPhone(toAsciiDigits(text).slice(0, 10));
    if (error) setError(null);
  };

  const handleContinue = async () => {
    if (!societyId) {
      router.replace('/(auth)/society-select' as any);
      return;
    }
    if (!isValid || loading) return;
    setLoading(true);
    setError(null);
    try {
      await api.post('/auth/send-otp', { phone: `+91${phone}`, societyId });
      router.push({ pathname: '/(auth)/otp-verify', params: { phone, societyId } } as any);
    } catch (err: any) {
      // Inline, next to the field it concerns. An Alert here forced a second
      // tap to dismiss before the user could correct the number.
      setError(err?.message ?? 'We could not send the code. Check the number and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-primary-500">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/*
          Content is TOP-aligned inside a scroll view rather than vertically
          centred. With `justify-center` the block sat in the middle of the
          screen, and when the number pad opened on Android the primary button
          ended up underneath it — the user could type a number but not submit
          it without dismissing the keyboard first.
        */}
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
            Sign in
          </Text>
          <Text className="font-body text-primary-100 text-base mb-9">
            {societyName ? `Staff at ${societyName}` : 'Marzi Staff'}
          </Text>

          <Text className="font-body text-primary-100 text-sm mb-2">Mobile number</Text>
          <View
            className={`flex-row bg-white/15 rounded-2xl overflow-hidden border-2 ${
              error ? 'border-red-300' : isValid ? 'border-white' : 'border-white/25'
            }`}
          >
            <View className="px-4 justify-center border-r border-white/20">
              <Text className="text-white font-heading text-base">+91</Text>
            </View>
            <TextInput
              className="flex-1 px-4 text-white"
              style={{ fontSize: 22, letterSpacing: 1.5, paddingVertical: 16 }}
              value={formatPhone(phone)}
              onChangeText={handleChange}
              placeholder="98765 43210"
              placeholderTextColor="rgba(255,255,255,0.45)"
              keyboardType="number-pad"
              inputMode="numeric"
              autoComplete="tel"
              textContentType="telephoneNumber"
              maxLength={11 /* 10 digits + the inserted space */}
              autoFocus
              accessibilityLabel="Mobile number"
              accessibilityHint="Enter your 10-digit mobile number"
            />
          </View>

          {error ? (
            <View className="flex-row items-start mt-3">
              <Ionicons name="alert-circle" size={16} color="#FECACA" />
              <Text className="font-body text-sm text-red-100 ml-2 flex-1">{error}</Text>
            </View>
          ) : (
            <Text className="font-body text-sm text-primary-100/80 mt-3">
              We will text you a 4-digit code to confirm it&apos;s you.
            </Text>
          )}

          <TouchableOpacity
            className={`rounded-2xl items-center justify-center mt-8 ${
              isValid ? 'bg-white' : 'bg-white/20'
            }`}
            style={{ minHeight: 56 }}
            onPress={handleContinue}
            disabled={!isValid || loading}
            accessibilityRole="button"
            accessibilityLabel="Send verification code"
            accessibilityState={{ disabled: !isValid || loading }}
          >
            {loading ? (
              <ActivityIndicator color={colors.primary[500]} />
            ) : (
              <Text
                className={`font-heading text-base ${isValid ? 'text-primary-500' : 'text-white/50'}`}
              >
                Get OTP
              </Text>
            )}
          </TouchableOpacity>

          <View className="flex-1" />

          <Text className="font-body text-xs text-primary-100/70 text-center mt-8">
            Trouble signing in? Ask your supervisor to check your number is registered.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
