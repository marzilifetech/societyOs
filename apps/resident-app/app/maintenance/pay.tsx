import { useState, useRef } from 'react';
import { ScrollView, View, Text, TouchableOpacity, ActivityIndicator, Alert, Linking } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
// Lazy-loaded to avoid crashing when native module isn't linked (Expo Go / first-boot)
const getRazorpay = (): typeof import('react-native-razorpay').default | null => {
  try { return require('react-native-razorpay').default; } catch { return null; }
};
import { api } from '../../src/lib/api';
import { APP_NAME } from '../../src/lib/app-version';

type IoniconName = keyof typeof Ionicons.glyphMap;

type PaymentMethod = { id: string; label: string; icon: IoniconName; desc: string; tint: string };

const PAYMENT_METHODS: PaymentMethod[] = [
  { id: 'UPI', label: 'UPI', icon: 'phone-portrait', desc: 'Pay via UPI app', tint: '#0EA5E9' },
  { id: 'CARD', label: 'Card', icon: 'card', desc: 'Credit / Debit card', tint: '#7C3AED' },
  { id: 'NETBANKING', label: 'Net Banking', icon: 'business', desc: 'All major banks', tint: '#16A34A' },
  { id: 'WALLET', label: 'Wallet', icon: 'wallet', desc: 'Paytm, PhonePe etc.', tint: '#F97316' },
];

type Bill = { id: string; month: string; amount: number; description?: string; status?: string };

type PaymentResult = {
  razorpay_payment_id: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
  method?: string;
};

export default function PayScreen() {
  const { billId } = useLocalSearchParams<{ billId?: string }>();
  const qc = useQueryClient();
  const [method, setMethod] = useState('UPI');
  const [success, setSuccess] = useState(false);
  const [lastPaymentId, setLastPaymentId] = useState<string | null>(null);
  const [pendingPoll, setPendingPoll] = useState(false);
  const idempotencyKeyRef = useRef<string | null>(null);

  const { data: bills } = useQuery<Bill[]>({
    queryKey: ['maintenance-bills'],
    queryFn: () => api.get<Bill[]>('/maintenance/bills'),
  });

  const pendingBills = bills?.filter((b: any) => b.status === 'PENDING' || b.status === 'OVERDUE') ?? [];
  const bill = billId ? bills?.find((b: any) => b.id === billId) : pendingBills[0];

  const pollPaymentStatus = async (paymentId: string): Promise<boolean> => {
    setPendingPoll(true);
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      try {
        const status = await api.get<{ status: string }>(`/maintenance/payment-status/${paymentId}`);
        if (status?.status === 'SUCCESS') {
          setPendingPoll(false);
          return true;
        }
        if (status?.status === 'FAILED') {
          setPendingPoll(false);
          return false;
        }
      } catch {
        /* ignore — keep polling */
      }
      await new Promise((r: any) => setTimeout(r, 3000));
    }
    setPendingPoll(false);
    return false;
  };

  const downloadReceipt = async () => {
    if (!lastPaymentId) return;
    try {
      const r = await api.get<{ url: string }>(`/maintenance/receipt/${lastPaymentId}`);
      if (r?.url) await Linking.openURL(r.url);
    } catch (e: any) {
      Alert.alert('Download failed', e?.message ?? 'Unable to download receipt.');
    }
  };

  const runCheckout = async () => {
    if (!bill) return;
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = `pay-${bill.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }
    const idemKey = idempotencyKeyRef.current;

    try {
      const order = await api.post<{ orderId: string; amount: number; key: string }>(
        '/maintenance/payment-order',
        { billId: bill.id, idempotencyKey: idemKey },
      );

      const options = {
        description: `Maintenance Bill - ${bill.month}`,
        image: 'https://your-logo-url.com/logo.png',
        currency: 'INR',
        amount: order.amount,
        order_id: order.orderId,
        key: order.key ?? process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID ?? 'rzp_test_xxx',
        name: APP_NAME,
        prefill: { contact: '', email: '' },
        theme: { color: '#821A52' },
      };

      const RazorpayCheckout = getRazorpay();
      if (!RazorpayCheckout) {
        Alert.alert('Payment unavailable', 'Payment gateway is not available in this build.');
        return;
      }
      const paymentResult: PaymentResult = await RazorpayCheckout.open(options as any);
      setLastPaymentId(paymentResult.razorpay_payment_id);

      try {
        await api.post('/maintenance/verify-payment', {
          billId: bill.id,
          paymentId: paymentResult.razorpay_payment_id,
          orderId: paymentResult.razorpay_order_id,
          signature: paymentResult.razorpay_signature,
          gatewayRef: paymentResult.razorpay_payment_id,
          method: paymentResult.method || method,
          idempotencyKey: idemKey,
        });
        qc.invalidateQueries({ queryKey: ['maintenance-bills'] });
        setSuccess(true);
        idempotencyKeyRef.current = null;
      } catch (verifyErr: any) {
        const ok = await pollPaymentStatus(paymentResult.razorpay_payment_id);
        if (ok) {
          qc.invalidateQueries({ queryKey: ['maintenance-bills'] });
          setSuccess(true);
          idempotencyKeyRef.current = null;
        } else {
          Alert.alert(
            'Payment status unclear',
            'Your payment may still be processing. Please check the bills screen in a few minutes before retrying.',
            [
              { text: 'Back to Bills', onPress: () => router.replace('/maintenance' as any) },
              { text: 'Retry', onPress: () => runCheckout() },
            ],
          );
        }
      }
    } catch (e: any) {
      const code = e?.code ?? '';
      if (code === 'USER_CANCELLED' || code === 0 || /cancel/i.test(e?.description ?? '')) {
        return;
      }
      Alert.alert('Payment Failed', e?.description ?? e?.message ?? 'Please try again.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Retry', onPress: () => runCheckout() },
      ]);
    }
  };

  const payMutation = useMutation({
    mutationFn: runCheckout,
  });

  if (success) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center px-8 bg-white">
        <View className="w-20 h-20 rounded-full bg-green-100 items-center justify-center mb-6">
          <Ionicons name="checkmark-circle" size={56} color="#16A34A" />
        </View>
        <Text className="text-gray-900 text-2xl font-bold mb-3 text-center">Payment Successful!</Text>
        <Text className="text-gray-500 text-base text-center mb-8">₹{bill?.amount.toLocaleString('en-IN')} paid for {bill?.description ?? 'Maintenance'}</Text>
        <TouchableOpacity
          onPress={downloadReceipt}
          accessibilityLabel="Download receipt"
          accessibilityRole="button"
          className="bg-gray-50 border border-gray-200 rounded-2xl py-4 px-10 mb-4 w-full items-center flex-row justify-center gap-2"
        >
          <Ionicons name="receipt" size={18} color="#16A34A" />
          <Text className="text-green-700 font-bold text-base">Download Receipt</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/maintenance' as any)} className="bg-primary-500 rounded-2xl py-4 px-10 w-full items-center">
          <Text className="text-white font-bold text-base">Done</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-3 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => router.back()} className="p-2" accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={24} color="#374151" />
        </TouchableOpacity>
        <Text className="text-gray-900 text-xl font-bold">Make Payment</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
        {/* Bill summary */}
        {bill && (
          <View className="bg-gray-50 border border-gray-200 rounded-2xl p-5 mb-6">
            <View className="flex-row items-center gap-2 mb-1">
              <Ionicons name="receipt" size={16} color="#6B7280" />
              <Text className="text-gray-500 text-sm">Paying for</Text>
            </View>
            <Text className="text-gray-900 text-base font-semibold">
              {new Date(bill.month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </Text>
            <Text className="text-primary-500 text-3xl font-bold mt-2">₹{bill.amount.toLocaleString('en-IN')}</Text>
          </View>
        )}

        <Text className="text-gray-900 text-base font-semibold mb-3">Payment Method</Text>
        <View className="gap-3 mb-6">
          {PAYMENT_METHODS.map((pm) => {
            const selected = method === pm.id;
            return (
              <TouchableOpacity
                key={pm.id}
                onPress={() => setMethod(pm.id)}
                className={`rounded-2xl p-4 flex-row items-center gap-4 border ${selected ? 'bg-primary-50 border-primary-500' : 'bg-gray-50 border-gray-200'}`}
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

        <TouchableOpacity
          onPress={() => payMutation.mutate()}
          disabled={!bill || payMutation.isPending}
          className={`rounded-2xl py-4 items-center ${bill ? 'bg-primary-500' : 'bg-gray-300'}`}
        >
          {payMutation.isPending || pendingPoll ? (
            <View className="flex-row items-center gap-2">
              <ActivityIndicator color="#fff" />
              {pendingPoll && <Text className="text-white text-sm">Verifying…</Text>}
            </View>
          ) : (
            <Text className="text-white font-bold text-base">
              Pay ₹{bill?.amount.toLocaleString('en-IN') ?? '0'} via {method}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
