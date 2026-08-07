import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Haptics from 'expo-haptics';
import {
  verifyPin,
  getPinAttempts,
  recordFailedPinAttempt,
  resetPinAttempts,
} from './pin-setup';
import { PinDots } from '../../src/components/ui/PinDots';
import { useSettingsStore } from '../../src/store/settings.store';
import { useAuthStore } from '../../src/store/auth.store';

const PIN_LENGTH = 4;
const MAX_ATTEMPTS = 5;

export default function PinLoginScreen() {
  const [pin, setPin] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const biometricEnabled = useSettingsStore((s) => s.biometricEnabled);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const hidden = useRef<TextInput | null>(null);
  const submitting = useRef(false);

  // The counter is PERSISTED (see pin-setup.ts). Previously it lived only in
  // component state, so force-quitting the app reset it and the 5-attempt
  // limit could be bypassed forever.
  useEffect(() => {
    getPinAttempts().then(setAttempts);
  }, []);

  const signOut = useCallback(async () => {
    await resetPinAttempts();
    await clearAuth();
    router.replace('/(auth)/society-select' as any);
  }, [clearAuth]);

  const runBiometric = useCallback(async () => {
    try {
      const has = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!has || !enrolled) return false;
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Marzi Staff',
        fallbackLabel: 'Use PIN',
      });
      if (result.success) {
        await resetPinAttempts();
        router.replace('/(tabs)' as any);
        return true;
      }
    } catch {
      /* fall back to PIN */
    }
    return false;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const has = await LocalAuthentication.hasHardwareAsync().catch(() => false);
      const enrolled = await LocalAuthentication.isEnrolledAsync().catch(() => false);
      if (cancelled) return;
      setBiometricAvailable(!!has && !!enrolled);
      if (biometricEnabled) void runBiometric();
    })();
    return () => {
      cancelled = true;
    };
  }, [biometricEnabled, runBiometric]);

  const handleChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, PIN_LENGTH);
    setPin(digits);
    if (error) setError(null);
    // Auto-submit: a 4-digit PIN has exactly one completion point, so making
    // the user reach for a separate button afterwards is pure friction.
    if (digits.length === PIN_LENGTH) void handleSubmit(digits);
  };

  const handleSubmit = async (value: string) => {
    if (submitting.current || value.length !== PIN_LENGTH) return;
    submitting.current = true;
    setChecking(true);
    try {
      const ok = await verifyPin(value);
      if (ok) {
        await resetPinAttempts();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        router.replace('/(tabs)' as any);
        return;
      }
      const next = await recordFailedPinAttempt();
      setAttempts(next);
      setPin('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      if (next >= MAX_ATTEMPTS) {
        await signOut();
        return;
      }
      const left = MAX_ATTEMPTS - next;
      setError(
        `Incorrect PIN. ${left} ${left === 1 ? 'try' : 'tries'} left before you have to sign in again.`,
      );
      hidden.current?.focus();
    } finally {
      submitting.current = false;
      setChecking(false);
    }
  };

  const remaining = MAX_ATTEMPTS - attempts;

  return (
    <SafeAreaView className="flex-1 bg-primary-500">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* Top-aligned — `justify-center` left a large dead band above the
            content and put the Unlock button behind the number pad. */}
        <ScrollView
          contentContainerClassName="flex-grow px-7 pt-16 pb-8"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text className="text-3xl font-heading text-white mb-2" accessibilityRole="header">
            Enter your PIN
          </Text>
          <Text className="font-body text-primary-100 text-base mb-12">
            Unlock the app to continue your shift.
          </Text>

          <TextInput
            ref={hidden}
            value={pin}
            onChangeText={handleChange}
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={PIN_LENGTH}
            autoFocus
            accessibilityLabel="Enter your 4-digit PIN"
            style={{ position: 'absolute', opacity: 0, height: 1, width: 1, top: -100 }}
          />

          <Pressable
            onPress={() => hidden.current?.focus()}
            accessibilityRole="button"
            accessibilityLabel="Edit PIN"
            className="py-4"
          >
            <PinDots length={PIN_LENGTH} filled={pin.length} error={!!error} />
          </Pressable>

          {error ? (
            <View className="flex-row items-start mt-4">
              <Ionicons name="alert-circle" size={16} color="#FECACA" />
              <Text className="font-body text-sm text-red-100 ml-2 flex-1">{error}</Text>
            </View>
          ) : attempts > 0 ? (
            <Text className="font-body text-sm text-primary-100/80 mt-4 text-center">
              {remaining} {remaining === 1 ? 'try' : 'tries'} left
            </Text>
          ) : checking ? (
            <Text className="font-body text-sm text-primary-100/80 mt-4 text-center">Checking…</Text>
          ) : null}

          {biometricAvailable ? (
            <TouchableOpacity
              onPress={() => void runBiometric()}
              accessibilityRole="button"
              accessibilityLabel="Unlock with fingerprint or face"
              className="flex-row items-center justify-center mt-10 py-3"
            >
              <Ionicons name="finger-print" size={20} color="#FFFFFF" />
              <Text className="font-heading text-white text-base ml-2">Use fingerprint</Text>
            </TouchableOpacity>
          ) : null}

          <View className="flex-1" />

          <TouchableOpacity
            className="items-center py-3 mt-8"
            onPress={signOut}
            accessibilityRole="button"
            accessibilityLabel="Forgot PIN, sign in with phone number"
          >
            <Text className="font-body text-primary-100 text-sm underline">
              Forgot PIN? Sign in with your number
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
