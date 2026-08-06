import { FlatList, View, Text, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, Linking } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../../src/lib/api';

const API_BASE = (globalThis as any).process?.env?.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/v1';

type Bill = {
  id: string;
  month: string;
  amount: number;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'OVERDUE';
  dueDate?: string;
  description?: string;
};

const STATUS_META: Record<string, { label: string; bg: string; text: string }> = {
  PENDING: { label: 'Pending', bg: 'bg-amber-100', text: 'text-amber-700' },
  SUCCESS: { label: 'Paid', bg: 'bg-green-100', text: 'text-green-700' },
  FAILED: { label: 'Failed', bg: 'bg-red-100', text: 'text-red-700' },
  OVERDUE: { label: 'Overdue', bg: 'bg-red-100', text: 'text-red-700' },
};

export default function BillsListScreen() {
  const [refreshing, setRefreshing] = useState(false);

  const handleExport = async () => {
    try {
      await SecureStore.getItemAsync('auth_token');
      const url = `${API_BASE}/maintenance/bills/export?format=csv`;
      const canOpen = await Linking.canOpenURL(url).catch(() => false);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Export ready', `Open this URL to download your bills CSV:\n\n${url}`);
      }
    } catch {
      Alert.alert('Export failed', 'Could not initiate export. Please try again.');
    }
  };

  const { data: bills, isLoading, isError, refetch } = useQuery<Bill[]>({
    queryKey: ['maintenance-bills'],
    queryFn: () => api.get<Bill[]>('/maintenance/bills'),
  });

  const sorted = [...(bills ?? [])].sort((a, b) => b.month.localeCompare(a.month));

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
        <Text className="text-gray-900 text-2xl font-bold flex-1">All Bills</Text>
        <TouchableOpacity
          onPress={handleExport}
          className="bg-primary-50 rounded-lg px-3 py-2 flex-row items-center gap-1.5"
          accessibilityRole="button"
          accessibilityLabel="Export bills as CSV"
        >
          <Ionicons name="document-text" size={14} color="#821A52" />
          <Text className="text-primary-500 text-sm font-semibold">Export CSV</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#821A52" size="large" />
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="alert-circle" size={40} color="#DC2626" />
          <Text className="text-gray-900 text-lg font-semibold mb-4 mt-3">Failed to load</Text>
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
        <FlatList
          data={sorted}
          keyExtractor={(b) => b.id}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={7}
          contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await refetch(); setRefreshing(false); }} tintColor="#821A52" />}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          ListEmptyComponent={
            <View className="items-center py-20">
              <View className="w-20 h-20 rounded-full bg-primary-50 items-center justify-center mb-4">
                <Ionicons name="receipt-outline" size={36} color="#821A52" />
              </View>
              <Text className="text-gray-900 text-lg font-semibold mb-2">No bills yet</Text>
              <Text className="text-gray-400 text-sm">Your bills will appear here</Text>
            </View>
          }
          renderItem={({ item: bill }) => {
            const meta = STATUS_META[bill.status] ?? STATUS_META.PENDING;
            const isOverdue = bill.status === 'OVERDUE';
            const isPaid = bill.status === 'SUCCESS';
            return (
              <TouchableOpacity
                onPress={() => router.push(`/maintenance/bills/${bill.id}` as any)}
                className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex-row items-center"
                accessibilityRole="button"
                accessibilityLabel={`View bill for ${new Date(bill.month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}, amount ₹${bill.amount.toLocaleString('en-IN')}, status ${meta.label}`}
              >
                <View className={`w-10 h-10 rounded-xl items-center justify-center mr-3 ${isPaid ? 'bg-green-100' : isOverdue ? 'bg-red-100' : 'bg-amber-100'}`}>
                  <Ionicons
                    name={isPaid ? 'checkmark-circle' : isOverdue ? 'alert-circle' : 'receipt'}
                    size={20}
                    color={isPaid ? '#16A34A' : isOverdue ? '#DC2626' : '#B45309'}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-gray-900 text-base font-semibold">
                    {new Date(bill.month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                  </Text>
                  <Text className="text-gray-500 text-sm mt-0.5">{bill.description ?? 'Society Maintenance'}</Text>
                  {bill.dueDate && (
                    <View className="flex-row items-center gap-1 mt-0.5">
                      <Ionicons name="time" size={12} color="#9CA3AF" />
                      <Text className="text-gray-400 text-xs">
                        Due: {new Date(bill.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </Text>
                    </View>
                  )}
                </View>
                <View className="items-end gap-2">
                  <Text className={`text-lg font-bold ${isOverdue ? 'text-red-600' : 'text-gray-900'}`}>₹{bill.amount.toLocaleString('en-IN')}</Text>
                  <View className={`rounded-full px-3 py-0.5 ${meta.bg}`}>
                    <Text className={`text-xs font-semibold ${meta.text}`}>{meta.label}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
