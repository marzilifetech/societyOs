import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';

const PIN_KEY = 'staff_pin_hash';

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
}

export async function clearPin(): Promise<void> {
  await SecureStore.deleteItemAsync(PIN_KEY);
}

export default function PinSetupScreen() {
  const [pin, setPinValue] = useState('');
  const [confirm, setConfirm] = useState('');
  const [step, setStep] = useState<'create' | 'confirm'>('create');

  const handleNext = async () => {
    if (step === 'create') {
      if (pin.length !== 4) return Alert.alert('PIN must be 4 digits');
      setStep('confirm');
      return;
    }
    if (confirm !== pin) {
      Alert.alert('PINs do not match');
      setConfirm('');
      return;
    }
    await setPin(pin);
    router.replace('/(tabs)' as any);
  };

  const value = step === 'create' ? pin : confirm;
  const setValue = step === 'create' ? setPinValue : setConfirm;

  return (
    <SafeAreaView className="flex-1 bg-primary-500">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <View className="flex-1 px-8 justify-center">
          <Text className="text-3xl font-bold text-white mb-2">
            {step === 'create' ? 'Set up PIN' : 'Confirm PIN'}
          </Text>
          <Text className="text-primary-100 text-base mb-10">
            {step === 'create'
              ? 'Choose a 4-digit PIN to secure your app.'
              : 'Re-enter the same PIN to confirm.'}
          </Text>

          <TextInput
            className="bg-white/10 border border-white/20 rounded-2xl px-5 py-4 text-white text-2xl tracking-widest text-center"
            value={value}
            onChangeText={(t) => setValue(t.replace(/\D/g, '').slice(0, 4))}
            placeholder="••••"
            placeholderTextColor="rgba(255,255,255,0.4)"
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            autoFocus
          />

          <TouchableOpacity
            className={`mt-8 rounded-2xl py-4 items-center ${value.length === 4 ? 'bg-white' : 'bg-white/20'}`}
            onPress={handleNext}
            disabled={value.length !== 4}
          >
            <Text className={`font-bold text-base ${value.length === 4 ? 'text-primary-500' : 'text-white/50'}`}>
              {step === 'create' ? 'Next' : 'Confirm'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
