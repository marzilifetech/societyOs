import { useEffect, useRef, useState } from 'react';
import {
  BackHandler,
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
import * as Haptics from 'expo-haptics';
import { PinDots } from '../../src/components/ui/PinDots';
import { PIN_LENGTH, WEAK_PINS, setPin } from '../../src/lib/pin';
import { useLockStore } from '../../src/store/lock.store';

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
      useLockStore.getState().setHasPin(true);
      useLockStore.getState().unlock();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace('/(tabs)' as never);
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

  // Creating a PIN is not optional for a signed-in session, so Back can't
  // leave this screen (it landed on the society picker with the session still
  // live). On the confirm step it steps back to choosing the PIN.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 'confirm') backToCreate();
      return true;
    });
    return () => sub.remove();
  });

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
