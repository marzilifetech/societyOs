import { useRef, useState } from 'react';
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
import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';
import { PinDots } from '../../src/components/ui/PinDots';

const PIN_KEY = 'staff_pin_hash';
const ATTEMPTS_KEY = 'staff_pin_attempts';
const PIN_LENGTH = 4;

// Tiny non-cryptographic hash. Sufficient as obfuscation for a 4-digit PIN
// stored in SecureStore (which is already hardware-backed on iOS/Android).
function hashPin(pin: string): string {
  let h = 5381;
  for (let i = 0; i < pin.length; i++) h = ((h << 5) + h) ^ pin.charCodeAt(i);
  return (h >>> 0).toString(16);
}

export async function isPinSet(): Promise<boolean> {
  const v = await SecureStore.getItemAsync(PIN_KEY);
  return !!v;
}

export async function verifyPin(pin: string): Promise<boolean> {
  const stored = await SecureStore.getItemAsync(PIN_KEY);
  if (!stored) return false;
  return stored === hashPin(pin);
}

export async function setPin(pin: string): Promise<void> {
  await SecureStore.setItemAsync(PIN_KEY, hashPin(pin));
  await resetPinAttempts();
}

export async function clearPin(): Promise<void> {
  await SecureStore.deleteItemAsync(PIN_KEY);
  await resetPinAttempts();
}

/**
 * Failed-attempt counter, PERSISTED.
 *
 * The lockout used to live in React state on the PIN screen, so force-quitting
 * the app reset it to zero — the "5 attempts then sign out" rule could be
 * bypassed indefinitely by killing and reopening the app, which makes a
 * 4-digit PIN exhaustively guessable on a stolen phone. Persisting it in
 * SecureStore is what makes the limit real.
 */
export async function getPinAttempts(): Promise<number> {
  try {
    const raw = await SecureStore.getItemAsync(ATTEMPTS_KEY);
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export async function recordFailedPinAttempt(): Promise<number> {
  const next = (await getPinAttempts()) + 1;
  try {
    await SecureStore.setItemAsync(ATTEMPTS_KEY, String(next));
  } catch {
    /* counter is best-effort; never block the UI on it */
  }
  return next;
}

export async function resetPinAttempts(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(ATTEMPTS_KEY);
  } catch {
    /* ignore */
  }
}

/** PINs that offer no protection at all. Warned about, not blocked. */
const WEAK_PINS = new Set(['0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999', '1234', '4321']);

export default function PinSetupScreen() {
  const [pin, setPinValue] = useState('');
  const [confirm, setConfirm] = useState('');
  const [step, setStep] = useState<'create' | 'confirm'>('create');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const hidden = useRef<TextInput | null>(null);

  const value = step === 'create' ? pin : confirm;
  const weak = step === 'create' && pin.length === PIN_LENGTH && WEAK_PINS.has(pin);

  const handleChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, PIN_LENGTH);
    if (error) setError(null);
    if (step === 'create') setPinValue(digits);
    else setConfirm(digits);
    if (digits.length === PIN_LENGTH) Haptics.selectionAsync().catch(() => {});
  };

  const handleNext = async () => {
    if (value.length !== PIN_LENGTH) return;
    if (step === 'create') {
      setStep('confirm');
      setConfirm('');
      hidden.current?.focus();
      return;
    }
    if (confirm !== pin) {
      // Inline, and only the CONFIRM field is cleared — the old Alert made the
      // user dismiss a modal and gave no hint which entry was wrong.
      setError('Those PINs are different. Try entering the second one again.');
      setConfirm('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      hidden.current?.focus();
      return;
    }
    setSaving(true);
    try {
      await setPin(pin);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace('/(tabs)' as any);
    } catch {
      setError('Could not save your PIN. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const backToCreate = () => {
    setStep('create');
    setConfirm('');
    setError(null);
    hidden.current?.focus();
  };

  return (
    <SafeAreaView className="flex-1 bg-primary-500">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* Top-aligned: with `justify-center` the whole block sat mid-screen,
            leaving a large empty band above it and pushing the button under
            the number pad. */}
        <ScrollView
          contentContainerClassName="flex-grow px-7 pt-10 pb-8"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 'confirm' ? (
            <TouchableOpacity
              onPress={backToCreate}
              accessibilityRole="button"
              accessibilityLabel="Back to choosing a PIN"
              hitSlop={12}
              className="w-11 h-11 rounded-full bg-white/15 items-center justify-center mb-8"
            >
              <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <View className="h-11 mb-8" />
          )}

          <Text className="text-3xl font-heading text-white mb-2" accessibilityRole="header">
            {step === 'create' ? 'Create a PIN' : 'Confirm your PIN'}
          </Text>
          <Text className="font-body text-primary-100 text-base mb-12">
            {step === 'create'
              ? 'Pick 4 digits. You will use this to unlock the app.'
              : 'Enter the same 4 digits once more.'}
          </Text>

          {/* One hidden input holds the value; the dots are the visible UI. */}
          <TextInput
            ref={hidden}
            value={value}
            onChangeText={handleChange}
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={PIN_LENGTH}
            autoFocus
            accessibilityLabel={step === 'create' ? 'Choose a 4-digit PIN' : 'Re-enter your PIN'}
            style={{ position: 'absolute', opacity: 0, height: 1, width: 1, top: -100 }}
          />

          <Pressable
            onPress={() => hidden.current?.focus()}
            accessibilityRole="button"
            accessibilityLabel="Edit PIN"
            className="py-4"
          >
            <PinDots length={PIN_LENGTH} filled={value.length} error={!!error} />
          </Pressable>

          {error ? (
            <View className="flex-row items-start mt-4">
              <Ionicons name="alert-circle" size={16} color="#FECACA" />
              <Text className="font-body text-sm text-red-100 ml-2 flex-1">{error}</Text>
            </View>
          ) : weak ? (
            <View className="flex-row items-start mt-4">
              <Ionicons name="information-circle" size={16} color="#FDE68A" />
              <Text className="font-body text-sm text-amber-100 ml-2 flex-1">
                That PIN is easy to guess. Consider a less obvious one.
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            className={`rounded-2xl items-center justify-center mt-10 ${
              value.length === PIN_LENGTH ? 'bg-white' : 'bg-white/20'
            }`}
            style={{ minHeight: 56 }}
            onPress={handleNext}
            disabled={value.length !== PIN_LENGTH || saving}
            accessibilityRole="button"
            accessibilityState={{ disabled: value.length !== PIN_LENGTH || saving }}
          >
            <Text
              className={`font-heading text-base ${
                value.length === PIN_LENGTH ? 'text-primary-500' : 'text-white/50'
              }`}
            >
              {saving ? 'Saving…' : step === 'create' ? 'Next' : 'Confirm'}
            </Text>
          </TouchableOpacity>

          <View className="flex-1" />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
