import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@societyos/theme';
import { api } from '../../src/lib/api';

export default function PhoneEntryScreen() {
  const { societyId, societyName } = useLocalSearchParams<{ societyId?: string; societyName?: string }>();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const isValid = phone.replace(/\D/g, '').length === 10;

  const handleContinue = async () => {
    if (!societyId) {
      Alert.alert('Pick a society', 'Please choose your society first.');
      router.replace('/(auth)/society-select' as any);
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/send-otp', { phone: `+91${phone}`, societyId });
      router.push({ pathname: '/(auth)/otp-verify', params: { phone, societyId } } as any);
    } catch (err: any) {
      Alert.alert('Error', err.message);
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
        <View className="flex-1 px-8 justify-center">
          <View className="mb-10">
            <Text className="text-4xl font-bold text-white mb-2">Staff Login</Text>
            <Text className="text-primary-100 text-base">
              {societyName ?? 'SocietyOS Staff Portal'}
            </Text>
          </View>

          <View className="mb-6">
            <Text className="text-primary-100 text-sm mb-2">Mobile Number</Text>
            <View className="flex-row bg-white/10 border border-white/20 rounded-2xl overflow-hidden">
              <View className="px-4 py-4 border-r border-white/20 justify-center">
                <Text className="text-white font-semibold text-base">+91</Text>
              </View>
              <TextInput
                className="flex-1 px-4 py-4 text-white text-base"
                value={phone}
                onChangeText={setPhone}
                placeholder="Enter 10-digit number"
                placeholderTextColor="rgba(255,255,255,0.4)"
                keyboardType="phone-pad"
                maxLength={10}
              />
            </View>
          </View>

          <TouchableOpacity
            className={`rounded-2xl py-4 items-center ${isValid ? 'bg-white' : 'bg-white/20'}`}
            onPress={handleContinue}
            disabled={!isValid || loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.primary[500]} />
            ) : (
              <Text className={`font-bold text-base ${isValid ? 'text-primary-500' : 'text-white/50'}`}>
                Get OTP
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
