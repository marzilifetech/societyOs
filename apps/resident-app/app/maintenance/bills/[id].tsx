import { ScrollView, View, Text, TouchableOpacity, ActivityIndicator, Alert, Linking } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../../src/lib/api';

type BillDetail = {
  id: string;
  month: string;
  amount: number;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'OVERDUE';
  dueDate?: string;
  description?: string;
  breakdown?: Record<string, number>;
  payments?: { id: string; amount: number; paidAt: string }[];
  penaltyAmount?: number;
};

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  PENDING: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Pending' },
  SUCCESS: { bg: 'bg-green-100', text: 'text-green-700', label: 'Paid' },
  FAILED: { bg: 'bg-red-100', text: 'text-red-700', label: 'Failed' },
  OVERDUE: { bg: 'bg-red-100', text: 'text-red-700', label: 'Overdue' },
};

export default function BillDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: bill, isLoading, isError, refetch } = useQuery<BillDetail>({
    queryKey: ['bill', id],
    queryFn: () => api.get<BillDetail>(`/maintenance/bills/${id}`),
    enabled: !!id,
  });

  const payNow = () => {
    if (!id) return;
    router.push(`/maintenance/pay?billId=${id}` as any);
  };

  const downloadReceipt = async () => {
    const paymentId = bill?.payments?.[0]?.id;
    if (!paymentId) {
      Alert.alert('Receipt unavailable', 'No completed payment found for this bill.');
      return;
    }
    try {
      const r = await api.get<{ url: string }>(`/maintenance/receipt/${paymentId}`);
      if (r?.url) await Linking.openURL(r.url);
    } catch (e: any) {
      Alert.alert('Download failed', e?.message ?? 'Unable to download receipt.');
    }
  };

  const isPending = bill?.status === 'PENDING' || bill?.status === 'OVERDUE';
  const isOverdue = bill?.status === 'OVERDUE';
  const daysOverdue = bill?.dueDate ? Math.max(0, Math.floor((Date.now() - new Date(bill.dueDate).getTime()) / 86400000)) : 0;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-3 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => router.back()} className="p-2" accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={24} color="#374151" />
        </TouchableOpacity>
        <Text className="text-gray-900 text-xl font-bold">Bill Details</Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#821A52" size="large" />
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="alert-circle" size={40} color="#DC2626" />
          <Text className="text-gray-900 text-lg font-semibold mb-4 mt-3">Failed to load</Text>
          <TouchableOpacity onPress={() => refetch()} className="bg-primary-500 rounded-xl px-6 py-3">
            <Text className="text-white font-semibold">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : bill ? (
        <>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
            {isOverdue && daysOverdue > 0 && (
              <View className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4 flex-row items-center gap-3">
                <Ionicons name="alert-circle" size={28} color="#DC2626" />
                <View className="flex-1">
                  <Text className="text-red-700 font-semibold">{daysOverdue} days overdue</Text>
                  {bill.penaltyAmount ? (
                    <Text className="text-red-600 text-xs mt-1">
                      Late fee: ₹{bill.penaltyAmount.toLocaleString('en-IN')}
                    </Text>
                  ) : null}
                </View>
              </View>
            )}

            <View className="bg-gray-50 border border-gray-200 rounded-2xl p-5 mb-4">
              <Row label="Period" value={new Date(bill.month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })} />
              {bill.dueDate && (
                <Row label="Due Date" value={new Date(bill.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} highlight={isOverdue} />
              )}
              <View className="flex-row justify-between mb-3 items-center">
                <Text className="text-gray-500 text-sm">Status</Text>
                <View className={`rounded-full px-2.5 py-1 ${STATUS_BADGE[bill.status]?.bg ?? 'bg-gray-100'}`}>
                  <Text className={`text-xs font-semibold ${STATUS_BADGE[bill.status]?.text ?? 'text-gray-700'}`}>
                    {STATUS_BADGE[bill.status]?.label ?? bill.status}
                  </Text>
                </View>
              </View>
              <View className="border-t border-gray-200 mt-3 pt-3 flex-row justify-between items-center">
                <Text className="text-gray-900 font-bold text-lg">Total</Text>
                <Text className={`font-bold text-2xl ${isOverdue ? 'text-red-600' : 'text-primary-500'}`}>₹{bill.amount.toLocaleString('en-IN')}</Text>
              </View>
            </View>

            {bill.breakdown && (
              <View className="bg-gray-50 border border-gray-200 rounded-2xl p-5 mb-4">
                <View className="flex-row items-center gap-2 mb-3">
                  <Ionicons name="document-text" size={16} color="#374151" />
                  <Text className="text-gray-900 font-semibold">Breakdown</Text>
                </View>
                {Object.entries(bill.breakdown).map(([key, val]) => (
                  <View key={key} className="flex-row justify-between mb-2">
                    <Text className="text-gray-500 text-sm capitalize">{key.replace(/_/g, ' ')}</Text>
                    <Text className="text-gray-900 text-sm">₹{Number(val).toLocaleString('en-IN')}</Text>
                  </View>
                ))}
              </View>
            )}

            {bill.payments?.length ? (
              <View className="bg-gray-50 border border-gray-200 rounded-2xl p-5 mb-4">
                <View className="flex-row items-center gap-2 mb-3">
                  <Ionicons name="receipt" size={16} color="#374151" />
                  <Text className="text-gray-900 font-semibold">Payment History</Text>
                </View>
                {bill.payments.map((p: any) => (
                  <View key={p.id} className="flex-row justify-between items-center mb-2">
                    <View className="flex-row items-center gap-2">
                      <Ionicons name="checkmark-circle" size={14} color="#16A34A" />
                      <Text className="text-gray-500 text-sm">
                        {new Date(p.paidAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </Text>
                    </View>
                    <Text className="text-green-700 text-sm font-semibold">₹{p.amount.toLocaleString('en-IN')}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </ScrollView>

          {isPending ? (
            <View className="px-6 pb-6">
              <TouchableOpacity
                onPress={payNow}
                accessibilityLabel={`Pay ${bill.amount} rupees`}
                accessibilityRole="button"
                className="bg-primary-500 rounded-2xl py-4 items-center flex-row justify-center gap-2"
              >
                <Ionicons name="card" size={18} color="#FFFFFF" />
                <Text className="text-white font-bold text-base">Pay ₹{bill.amount.toLocaleString('en-IN')}</Text>
              </TouchableOpacity>
            </View>
          ) : bill.status === 'SUCCESS' ? (
            <View className="px-6 pb-6">
              <TouchableOpacity
                onPress={downloadReceipt}
                accessibilityLabel="Download receipt"
                accessibilityRole="button"
                className="bg-gray-50 border border-gray-200 rounded-2xl py-4 items-center flex-row justify-center gap-2"
              >
                <Ionicons name="receipt" size={18} color="#16A34A" />
                <Text className="text-green-700 font-bold text-base">Download Receipt</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </>
      ) : null}
    </SafeAreaView>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View className="flex-row justify-between mb-3">
      <Text className="text-gray-500 text-sm">{label}</Text>
      <Text className={`text-sm ${highlight ? 'text-red-600 font-semibold' : 'text-gray-900'}`}>{value}</Text>
    </View>
  );
}
