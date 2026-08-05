import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';
import { verifyPin } from './pin-setup';
import { useSettingsStore } from '../../src/store/settings.store';
import { useAuthStore } from '../../src/store/auth.store';

export default function PinLoginScreen() {
  const [pin, setPin] = useState('');
  const [attempts, setAttempts] = useState(0);
  const biometricEnabled = useSettingsStore((s) => s.biometricEnabled);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  useEffect(() => {
    if (!biometricEnabled) return;
    (async () => {
      try {
        const has = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        if (!has || !enrolled) return;
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Unlock SocietyOS Staff',
          fallbackLabel: 'Use PIN',
        });
        if (result.success) router.replace('/(tabs)' as any);
      } catch {}
    })();
  }, [biometricEnabled]);

  const handleSubmit = async () => {
    if (pin.length !== 4) return;
    const ok = await verifyPin(pin);
    if (ok) {
      router.replace('/(tabs)' as any);
      return;
    }
    const next = attempts + 1;
    setAttempts(next);
    setPin('');
    if (next >= 5) {
      Alert.alert('Too many attempts', 'Please log in again with your phone.', [
        {
          text: 'OK',
          onPress: async () => {
            await clearAuth();
            router.replace('/(auth)/society-select' as any);
          },
        },
      ]);
    } else {
      Alert.alert('Incorrect PIN', `${5 - next} attempts remaining`);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-primary-500">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <View className="flex-1 px-8 justify-center">
          <Text className="text-3xl font-bold text-white mb-2">Enter PIN</Text>
          <Text className="text-primary-100 text-base mb-10">Use your 4-digit PIN to continue.</Text>
          <TextInput
            className="bg-white/10 border border-white/20 rounded-2xl px-5 py-4 text-white text-2xl tracking-widest text-center"
            value={pin}
            onChangeText={(t) => setPin(t.replace(/\D/g, '').slice(0, 4))}
            placeholder="••••"
            placeholderTextColor="rgba(255,255,255,0.4)"
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            autoFocus
            onSubmitEditing={handleSubmit}
          />
          <TouchableOpacity
            className={`mt-8 rounded-2xl py-4 items-center ${pin.length === 4 ? 'bg-white' : 'bg-white/20'}`}
            onPress={handleSubmit}
            disabled={pin.length !== 4}
          >
            <Text className={`font-bold text-base ${pin.length === 4 ? 'text-primary-500' : 'text-white/50'}`}>
              Unlock
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="mt-4 items-center py-2"
            onPress={async () => {
              await clearAuth();
              router.replace('/(auth)/society-select' as any);
            }}
          >
            <Text className="text-primary-100 text-sm">Forgot PIN? Log in with phone</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
