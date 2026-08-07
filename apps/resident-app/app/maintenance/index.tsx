import { ScrollView, View, Text, TouchableOpacity, Alert, ActivityIndicator, RefreshControl, Switch } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';

const AUTO_PAY_KEY = 'maintenance_auto_pay_enabled';
const PAYMENT_METHOD_KEY = 'maintenance_payment_method_label';

// Soft card shadow matching the redesign-kit RoundCard surface.
const cardShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.06,
  shadowRadius: 14,
  elevation: 2,
} as const;

type Bill = {
  id: string;
  month: string;
  amount: number;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'OVERDUE';
  dueDate?: string;
  description?: string;
};

export default function MaintenanceScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [autoPayEnabled, setAutoPayEnabled] = useState(false);
  const [autoPayLoaded, setAutoPayLoaded] = useState(false);
  const [paymentMethodLabel, setPaymentMethodLabel] = useState<string | null>(null);

  const loadPaymentState = useCallback(() => {
    Promise.all([
      AsyncStorage.getItem(AUTO_PAY_KEY),
      AsyncStorage.getItem(PAYMENT_METHOD_KEY),
    ]).then(([autoVal, methodVal]) => {
      setAutoPayEnabled(autoVal === 'true');
      setPaymentMethodLabel(methodVal);
      setAutoPayLoaded(true);
    });
  }, []);

  // Reload when returning from the payment-method screen so the new method/state shows.
  useFocusEffect(loadPaymentState);

  const handleAutoPayToggle = async (val: boolean) => {
    if (val && !paymentMethodLabel) {
      router.push('/maintenance/payment-method' as any);
      return;
    }
    setAutoPayEnabled(val);
    await AsyncStorage.setItem(AUTO_PAY_KEY, String(val));
    api.post('/maintenance/auto-pay', { enabled: val }).catch(() => {});
  };

  const handleRemoveMethod = () => {
    Alert.alert('Remove payment method?', 'Auto-pay will be turned off until you add a method again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setAutoPayEnabled(false);
          setPaymentMethodLabel(null);
          await AsyncStorage.multiRemove([PAYMENT_METHOD_KEY, AUTO_PAY_KEY]);
          api.post('/maintenance/auto-pay', { enabled: false }).catch(() => {});
        },
      },
    ]);
  };

  const { data: bills, isLoading, isError, refetch } = useQuery<Bill[]>({
    queryKey: ['maintenance-bills'],
    queryFn: () => api.get<Bill[]>('/maintenance/bills'),
  });

  const pending = bills?.filter((b: any) => b.status === 'PENDING' || b.status === 'OVERDUE') ?? [];
  const totalDue = pending.reduce((sum: any, b: any) => sum + b.amount, 0);
  const hasOverdue = pending.some((b: any) => b.status === 'OVERDUE');
  const recentPaid = bills?.filter((b: any) => b.status === 'SUCCESS').slice(0, 3) ?? [];

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-3 flex-row items-center gap-3">
        <TouchableOpacity
          onPress={() => router.back()}
          className="p-2"
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={24} color="#374151" />
        </TouchableOpacity>
        <View>
          <Text className="text-2xl font-bold text-gray-900">Maintenance</Text>
          <Text className="text-sm text-gray-500">Society dues and payments</Text>
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#821A52" size="large" />
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="alert-circle" size={40} color="#DC2626" />
          <Text className="text-gray-900 text-lg font-semibold mb-4 mt-3">Failed to load bills</Text>
          <TouchableOpacity
            onPress={() => refetch()}
            className="bg-primary-500 rounded-xl px-6 py-3"
            accessibilityRole="button"
            accessibilityLabel="Retry loading bills"
          >
            <Text className="text-white font-semibold">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await refetch(); setRefreshing(false); }} tintColor="#821A52" />}
          contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
        >
          {/* Auto-pay toggle */}
          {autoPayLoaded && (
            <View
              className={`rounded-2xl p-4 mb-4 border ${autoPayEnabled ? 'bg-primary-50 border-primary-200' : 'bg-white border-gray-100'}`}
              style={autoPayEnabled ? undefined : cardShadow}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1 mr-3 gap-3">
                  <View className={`w-10 h-10 rounded-xl items-center justify-center ${autoPayEnabled ? 'bg-primary-100' : 'bg-gray-100'}`}>
                    <Ionicons name="wallet" size={20} color={autoPayEnabled ? '#821A52' : '#6B7280'} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-gray-900">Auto-Pay</Text>
                    <Text className={`text-sm mt-0.5 ${autoPayEnabled ? 'text-primary-500' : 'text-gray-500'}`}>
                      {autoPayEnabled
                        ? paymentMethodLabel
                          ? `Auto-pay active — charges ${paymentMethodLabel} on due date`
                          : 'Auto-pay active — bills will be paid automatically on due date'
                        : 'Enable to pay bills automatically on the due date'}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={autoPayEnabled}
                  onValueChange={handleAutoPayToggle}
                  trackColor={{ false: '#E5E7EB', true: '#F3D6E6' }}
                  thumbColor={autoPayEnabled ? '#821A52' : '#9CA3AF'}
                />
              </View>

              {paymentMethodLabel && (
                <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-primary-200/60">
                  <View className="flex-row items-center flex-1 mr-3 gap-2">
                    <Ionicons name="card-outline" size={16} color="#6B7280" />
                    <Text className="text-sm text-gray-700 flex-1" numberOfLines={1}>
                      Method: <Text className="font-semibold text-gray-900">{paymentMethodLabel}</Text>
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => router.push('/maintenance/payment-method' as any)}
                    className="px-2 py-1"
                    accessibilityRole="button"
                    accessibilityLabel="Change auto-pay payment method"
                  >
                    <Text className="text-primary-500 text-sm font-semibold">Change</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleRemoveMethod}
                    className="px-2 py-1"
                    accessibilityRole="button"
                    accessibilityLabel="Remove auto-pay payment method"
                  >
                    <Text className="text-red-500 text-sm font-semibold">Remove</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* Overdue warning */}
          {hasOverdue && (
            <View className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4 flex-row items-center gap-3">
              <Ionicons name="alert-circle" size={28} color="#DC2626" />
              <View className="flex-1">
                <Text className="text-red-700 text-base font-semibold">Overdue Payment</Text>
                <Text className="text-red-600 text-sm mt-0.5">Late fees may apply. Please pay immediately.</Text>
              </View>
            </View>
          )}

          {/* Current dues card */}
          {pending.length > 0 && (
            <View className="bg-white border border-gray-100 rounded-2xl p-5 mb-6" style={cardShadow}>
              <View className="flex-row items-center gap-2 mb-1">
                <Ionicons name="cash" size={18} color="#821A52" />
                <Text className="text-gray-500 text-sm">Total Outstanding</Text>
              </View>
              <Text className={`text-4xl font-bold mb-1 ${hasOverdue ? 'text-red-600' : 'text-gray-900'}`}>₹{totalDue.toLocaleString('en-IN')}</Text>
              {pending[0]?.dueDate && (
                <View className="flex-row items-center gap-1.5 mb-4">
                  <Ionicons name="time" size={14} color={hasOverdue ? '#DC2626' : '#6B7280'} />
                  <Text className={`text-base ${hasOverdue ? 'text-red-600' : 'text-gray-500'}`}>
                    Due: {new Date(pending[0].dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}
                  </Text>
                </View>
              )}
              <TouchableOpacity
                onPress={() => router.push('/maintenance/pay' as any)}
                className="bg-primary-500 rounded-full items-center justify-center py-4 flex-row gap-2"
                accessibilityRole="button"
                accessibilityLabel={`Pay maintenance bill of ₹${totalDue.toLocaleString('en-IN')}`}
              >
                <Ionicons name="card" size={18} color="#FFFFFF" />
                <Text className="text-white font-bold text-base">Pay Now</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Nothing outstanding. Without this the screen rendered only the
              Auto-Pay row above a screenful of blank space, which reads as a
              failed load rather than good news — the most common state for a
              resident who pays on time. */}
          {pending.length === 0 && (
            <View
              className="bg-white border border-gray-100 rounded-2xl p-6 mb-6 items-center"
              style={cardShadow}
            >
              <View
                className="rounded-full items-center justify-center mb-3"
                style={{ width: 56, height: 56, backgroundColor: '#E7F4EC' }}
              >
                <Ionicons name="checkmark-circle" size={30} color="#1F7A45" />
              </View>
              <Text className="text-gray-900 text-lg font-semibold mb-1">No dues right now</Text>
              <Text className="text-gray-500 text-sm text-center leading-5">
                {recentPaid.length > 0
                  ? 'You are all paid up. New bills will show here as soon as they are raised.'
                  : 'When your society raises a maintenance bill, it will appear here.'}
              </Text>
            </View>
          )}

          {/* Recent payments */}
          {recentPaid.length > 0 && (
            <View className="mb-6">
              <View className="flex-row justify-between items-center mb-3">
                <Text className="text-gray-900 text-lg font-semibold">Recent Payments</Text>
                <TouchableOpacity
                  onPress={() => router.push('/maintenance/bills' as any)}
                  accessibilityRole="button"
                  accessibilityLabel="View all bills"
                >
                  <Text className="text-primary-500 text-sm font-semibold">View All</Text>
                </TouchableOpacity>
              </View>
              {recentPaid.map((bill: any) => (
                <TouchableOpacity
                  key={bill.id}
                  onPress={() => router.push(`/maintenance/bills/${bill.id}` as any)}
                  className="bg-white border border-gray-100 rounded-2xl p-4 mb-3 flex-row items-center"
                  style={cardShadow}
                  accessibilityRole="button"
                  accessibilityLabel={`View bill for ${new Date(bill.month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`}
                >
                  <View className="w-10 h-10 rounded-xl bg-green-100 items-center justify-center mr-3">
                    <Ionicons name="receipt" size={20} color="#16A34A" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-gray-900 text-base font-semibold">
                      {new Date(bill.month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                    </Text>
                    <Text className="text-gray-500 text-sm mt-0.5">{bill.description ?? 'Society Maintenance'}</Text>
                  </View>
                  <View className="items-end gap-1">
                    <Text className="text-gray-900 text-base font-bold">₹{bill.amount.toLocaleString('en-IN')}</Text>
                    <View className="bg-green-100 rounded-full px-2.5 py-0.5">
                      <Text className="text-green-700 text-xs font-semibold">Paid</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TouchableOpacity
            onPress={() => router.push('/maintenance/bills' as any)}
            className="bg-white border border-gray-100 rounded-2xl py-4 items-center flex-row justify-center gap-2"
            style={cardShadow}
            accessibilityRole="button"
            accessibilityLabel="View all maintenance bills"
          >
            <Ionicons name="document-text" size={18} color="#821A52" />
            <Text className="text-primary-500 text-base font-semibold">View All Bills</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
