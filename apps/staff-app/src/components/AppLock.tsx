import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Haptics from 'expo-haptics';
import { swallow } from '@societyos/mobile-core';
import {
  MAX_PIN_ATTEMPTS,
  PIN_LENGTH,
  getPinAttempts,
  recordFailedPinAttempt,
  resetPinAttempts,
  verifyPin,
} from '../lib/pin';
import { PinDots } from './ui/PinDots';
import { useSettingsStore } from '../store/settings.store';
import { useAuthStore } from '../store/auth.store';
import { useLockStore } from '../store/lock.store';

/**
 * The PIN / biometric lock, drawn OVER the app while `useLockStore.locked`.
 *
 * Not a route — see lock.store.ts for why the old `/(auth)/pin-login` route
 * could be bypassed with Android Back and stacked a new Home on every unlock.
 * Here Back is swallowed while the lock is up, and unlocking only removes the
 * overlay: whatever the guard had open underneath is exactly as they left it.
 */
export function AppLock() {
  const [pin, setPin] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const biometricEnabled = useSettingsStore((s) => s.biometricEnabled);
  const unlock = useLockStore((s) => s.unlock);
  const hidden = useRef<TextInput | null>(null);
  const submitting = useRef(false);

  // The lock must not be walked past: Back does nothing while it is up.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  const unlocked = useCallback(async () => {
    // Unlock FIRST: feedback is a nicety and must never stand between a guard
    // who typed the right PIN and the app.
    unlock();
    void swallow(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
    await resetPinAttempts();
  }, [unlock]);

  const signingOut = useRef(false);
  const signOut = useCallback(async () => {
    if (signingOut.current) return;
    signingOut.current = true;
    await useAuthStore.getState().clearAuth();
    router.replace('/(auth)/society-select' as never);
  }, []);

  // The counter is PERSISTED (see lib/pin.ts) so killing the app can't reset
  // it. A counter already at the limit means the app was killed between the
  // last wrong PIN and the sign-out it triggered: finish that sign-out now,
  // rather than handing out another guess per relaunch.
  useEffect(() => {
    void getPinAttempts().then((n) => {
      setAttempts(n);
      if (n >= MAX_PIN_ATTEMPTS) void signOut();
    });
  }, [signOut]);

  const runBiometric = useCallback(async () => {
    try {
      const has = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!has || !enrolled) return;
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Marzi Staff',
        fallbackLabel: 'Use PIN',
      });
      if (result.success) await unlocked();
    } catch {
      /* fall back to PIN */
    }
  }, [unlocked]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const has = await LocalAuthentication.hasHardwareAsync().catch(() => false);
      const enrolled = await LocalAuthentication.isEnrolledAsync().catch(() => false);
      if (cancelled) return;
      setBiometricAvailable(!!has && !!enrolled);
      if (biometricEnabled && has && enrolled) void runBiometric();
    })();
    return () => {
      cancelled = true;
    };
  }, [biometricEnabled, runBiometric]);

  const handleSubmit = async (value: string) => {
    if (submitting.current || value.length !== PIN_LENGTH) return;
    submitting.current = true;
    setChecking(true);
    try {
      // Re-read, not the state: a PIN typed before the mount-time read landed
      // must not get a guess past the limit.
      if ((await getPinAttempts()) >= MAX_PIN_ATTEMPTS) {
        await signOut();
        return;
      }
      if (await verifyPin(value)) {
        await unlocked();
        return;
      }
      const next = await recordFailedPinAttempt();
      setAttempts(next);
      setPin('');
      void swallow(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
      if (next >= MAX_PIN_ATTEMPTS) {
        await signOut();
        return;
      }
      const left = Math.max(0, MAX_PIN_ATTEMPTS - next);
      setError(
        `Incorrect PIN. ${left} ${left === 1 ? 'try' : 'tries'} left before you have to sign in again.`,
      );
      hidden.current?.focus();
    } finally {
      submitting.current = false;
      setChecking(false);
    }
  };

  const handleChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, PIN_LENGTH);
    setPin(digits);
    if (error) setError(null);
    // Auto-submit: a 4-digit PIN has exactly one completion point.
    if (digits.length === PIN_LENGTH) void handleSubmit(digits);
  };

  const remaining = Math.max(0, MAX_PIN_ATTEMPTS - attempts);

  return (
    <View style={StyleSheet.absoluteFill} accessibilityViewIsModal testID="app-lock">
      <SafeAreaView className="flex-1 bg-primary-500">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          <ScrollView
            contentContainerClassName="flex-grow px-7 pt-16 pb-8"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text className="mb-2 font-heading text-3xl text-white" accessibilityRole="header">
              Enter your PIN
            </Text>
            <Text className="mb-12 font-body text-base text-primary-100">
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
              style={styles.hiddenInput}
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
              <View className="mt-4 flex-row items-start">
                <Ionicons name="alert-circle" size={16} color="#FECACA" />
                <Text className="ml-2 flex-1 font-body text-sm text-red-100">{error}</Text>
              </View>
            ) : attempts > 0 ? (
              <Text className="mt-4 text-center font-body text-sm text-primary-100/80">
                {remaining} {remaining === 1 ? 'try' : 'tries'} left
              </Text>
            ) : checking ? (
              <Text className="mt-4 text-center font-body text-sm text-primary-100/80">
                Checking…
              </Text>
            ) : null}

            {biometricAvailable ? (
              <TouchableOpacity
                onPress={() => void runBiometric()}
                accessibilityRole="button"
                accessibilityLabel="Unlock with fingerprint or face"
                className="mt-10 flex-row items-center justify-center py-3"
              >
                <Ionicons name="finger-print" size={20} color="#FFFFFF" />
                <Text className="ml-2 font-heading text-base text-white">Use fingerprint</Text>
              </TouchableOpacity>
            ) : null}

            <View className="flex-1" />

            <TouchableOpacity
              className="mt-8 items-center py-3"
              onPress={signOut}
              accessibilityRole="button"
              accessibilityLabel="Forgot PIN, sign in with phone number"
            >
              <Text className="font-body text-sm text-primary-100 underline">
                Forgot PIN? Sign in with your number
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  hiddenInput: { position: 'absolute', opacity: 0, height: 1, width: 1, top: -100 },
});
