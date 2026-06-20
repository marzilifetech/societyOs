import { useState } from 'react';
import { ScrollView, View, Text, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

const AUTO_PAY_KEY = 'maintenance_auto_pay_enabled';
const PAYMENT_METHOD_KEY = 'maintenance_payment_method_label';

type IoniconName = keyof typeof Ionicons.glyphMap;

type PaymentMethod = { id: string; label: string; icon: IoniconName; desc: string; tint: string };

// Kept in sync with PAYMENT_METHODS in ./pay.tsx
const PAYMENT_METHODS: PaymentMethod[] = [
  { id: 'UPI', label: 'UPI', icon: 'phone-portrait', desc: 'Pay via UPI app', tint: '#0EA5E9' },
  { id: 'CARD', label: 'Card', icon: 'card', desc: 'Credit / Debit card', tint: '#7C3AED' },
  { id: 'NETBANKING', label: 'Net Banking', icon: 'business', desc: 'All major banks', tint: '#16A34A' },
  { id: 'WALLET', label: 'Wallet', icon: 'wallet', desc: 'Paytm, PhonePe etc.', tint: '#F97316' },
];

function buildLabel(methodId: string, detail: string): string | null {
  const trimmed = detail.trim();
  switch (methodId) {
    case 'UPI': {
      if (!/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(trimmed)) return null;
      return `UPI ${trimmed}`;
    }
    case 'CARD': {
      const digits = trimmed.replace(/\D/g, '');
      if (digits.length < 12) return null;
      return `Card •••• ${digits.slice(-4)}`;
    }
    case 'NETBANKING':
      if (!trimmed) return null;
      return `Net Banking — ${trimmed}`;
    case 'WALLET':
      if (!trimmed) return null;
      return `Wallet — ${trimmed}`;
    default:
      return null;
  }
}

const DETAIL_CONFIG: Record<string, { label: string; placeholder: string; keyboard: 'default' | 'number-pad' }> = {
  UPI: { label: 'UPI ID', placeholder: 'name@bank', keyboard: 'default' },
  CARD: { label: 'Card Number', placeholder: '1234 5678 9012 3456', keyboard: 'number-pad' },
  NETBANKING: { label: 'Bank Name', placeholder: 'e.g. HDFC Bank', keyboard: 'default' },
  WALLET: { label: 'Wallet', placeholder: 'e.g. Paytm', keyboard: 'default' },
};

export default function PaymentMethodScreen() {
  const [method, setMethod] = useState('UPI');
  const [detail, setDetail] = useState('');
  const [saving, setSaving] = useState(false);

  const cfg = DETAIL_CONFIG[method];

  const handleSave = async () => {
    const label = buildLabel(method, detail);
    if (!label) {
      Alert.alert('Invalid details', `Please enter a valid ${cfg.label.toLowerCase()}.`);
      return;
    }
    setSaving(true);
    try {
      await AsyncStorage.multiSet([
        [PAYMENT_METHOD_KEY, label],
        [AUTO_PAY_KEY, 'true'],
      ]);
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-3 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => router.back()} className="p-2" accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={24} color="#374151" />
        </TouchableOpacity>
        <View>
          <Text className="text-gray-900 text-xl font-bold">Payment Method</Text>
          <Text className="text-sm text-gray-500">Used for auto-pay charges</Text>
        </View>
      </View>

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
          <Text className="text-gray-900 text-base font-semibold mb-3">Method Type</Text>
          <View className="gap-3 mb-6">
            {PAYMENT_METHODS.map((pm) => {
              const selected = method === pm.id;
              return (
                <TouchableOpacity
                  key={pm.id}
                  onPress={() => { setMethod(pm.id); setDetail(''); }}
                  className={`rounded-2xl p-4 flex-row items-center gap-4 border ${selected ? 'bg-primary-50 border-primary-500' : 'bg-gray-50 border-gray-200'}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${pm.label}`}
                >
                  <View className="w-11 h-11 rounded-xl items-center justify-center" style={{ backgroundColor: `${pm.tint}1A` }}>
                    <Ionicons name={pm.icon} size={22} color={pm.tint} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-gray-900 font-semibold">{pm.label}</Text>
                    <Text className="text-gray-500 text-xs">{pm.desc}</Text>
                  </View>
                  <View style={{
                    width: 20, height: 20, borderRadius: 10,
                    borderWidth: 2, borderColor: selected ? '#821A52' : '#D1D5DB',
                    backgroundColor: selected ? '#821A52' : 'transparent',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    {selected && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' }} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text className="text-gray-900 text-base font-semibold mb-2">{cfg.label}</Text>
          <TextInput
            value={detail}
            onChangeText={setDetail}
            placeholder={cfg.placeholder}
            placeholderTextColor="#9CA3AF"
            keyboardType={cfg.keyboard}
            autoCapitalize="none"
            autoCorrect={false}
            className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 text-gray-900 text-base mb-2"
          />
          {method === 'CARD' && (
            <Text className="text-gray-400 text-xs mb-4">Only the last 4 digits are stored on this device.</Text>
          )}

          <TouchableOpacity
            onPress={handleSave}
            disabled={saving || !detail.trim()}
            className={`rounded-2xl py-4 items-center mt-4 ${saving || !detail.trim() ? 'bg-gray-300' : 'bg-primary-500'}`}
            accessibilityRole="button"
            accessibilityLabel="Save payment method and enable auto-pay"
          >
            <Text className="text-white font-bold text-base">Save & Enable Auto-Pay</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
