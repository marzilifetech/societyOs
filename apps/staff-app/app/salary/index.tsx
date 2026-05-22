import { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Modal } from 'react-native';
import { router, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import WebView from 'react-native-webview';
import { api } from '../../src/lib/api';
import { ErrorCard } from '../../src/components/ErrorCard';

interface SalarySlip {
  id: string;
  period: string; // YYYY-MM
  grossPay: number;
  deductions: number;
  netPay: number;
  fileUrl?: string;
  generatedAt?: string;
}

function formatINR(n: number) {
  return `₹${(n ?? 0).toLocaleString('en-IN')}`;
}

function periodLabel(p: string) {
  const [y, m] = p.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[Math.max(0, parseInt(m, 10) - 1)]} ${y}`;
}

export default function SalaryScreen() {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['staff-salary', year],
    queryFn: () => api.get<SalarySlip[]>(`/staff/salary?year=${year}`),
  });

  const yearOptions = useMemo(() => {
    const cur = new Date().getFullYear();
    return [cur, cur - 1, cur - 2];
  }, []);

  const total = (data ?? []).reduce((sum, s) => sum + (s.netPay ?? 0), 0);

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="bg-primary-500 px-5 py-4 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center">
          <Text className="text-white text-2xl">‹</Text>
        </TouchableOpacity>
        <Text className="text-white text-lg font-bold ml-2">Salary Slips</Text>
      </View>

      <View className="px-5 pt-4">
        <View className="flex-row gap-2">
          {yearOptions.map((y) => (
            <TouchableOpacity
              key={y}
              onPress={() => setYear(y)}
              className={`px-4 py-1.5 rounded-full border ${year === y ? 'bg-primary-500 border-primary-500' : 'bg-white border-gray-200'}`}
            >
              <Text className={year === y ? 'text-white text-sm font-semibold' : 'text-gray-700 text-sm'}>
                {y}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : isError ? (
        <ErrorCard
          message="Your salary details couldn't be loaded. Please try again."
          onRetry={() => refetch()}
        />
      ) : (
        <ScrollView className="flex-1" contentContainerClassName="p-5 gap-3">
          {(data ?? []).length === 0 ? (
            <View className="bg-white rounded-2xl p-8 items-center mt-8">
              <Text className="text-5xl mb-3">💰</Text>
              <Text className="text-gray-700 font-semibold text-base">No salary slips for {year}</Text>
            </View>
          ) : (
            (data ?? []).map((s) => (
              <View key={s.id} className="bg-white rounded-2xl p-4 shadow-sm">
                <View className="flex-row justify-between items-start mb-3">
                  <Text className="text-base font-semibold text-gray-900">{periodLabel(s.period)}</Text>
                  <Text className="text-lg font-bold text-primary-500">{formatINR(s.netPay)}</Text>
                </View>
                <View className="flex-row gap-4 mb-3">
                  <View className="flex-1">
                    <Text className="text-xs text-gray-400">Gross</Text>
                    <Text className="text-sm font-medium text-gray-700">{formatINR(s.grossPay)}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs text-gray-400">Deductions</Text>
                    <Text className="text-sm font-medium text-gray-700">{formatINR(s.deductions)}</Text>
                  </View>
                </View>
                {s.fileUrl ? (
                  <TouchableOpacity
                    onPress={() => setPdfUrl(s.fileUrl!)}
                    className="bg-primary-50 rounded-xl py-2.5 items-center"
                  >
                    <Text className="text-primary-500 font-semibold text-sm">View PDF</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ))
          )}
          {(data ?? []).length > 0 ? (
            <View className="bg-white rounded-2xl p-4 mt-2 flex-row justify-between items-center">
              <Text className="text-sm text-gray-500">Total earned in {year}</Text>
              <Text className="text-base font-bold text-gray-900">{formatINR(total)}</Text>
            </View>
          ) : null}
        </ScrollView>
      )}

      <Modal visible={!!pdfUrl} animationType="slide" onRequestClose={() => setPdfUrl(null)}>
        <SafeAreaView className="flex-1 bg-black">
          <View className="flex-row items-center justify-between px-4 py-3">
            <TouchableOpacity onPress={() => setPdfUrl(null)} className="px-2 py-1">
              <Text className="text-white text-base">Close</Text>
            </TouchableOpacity>
            <Text className="text-white font-semibold">Salary Slip</Text>
            <View className="w-12" />
          </View>
          {pdfUrl ? <WebView source={{ uri: pdfUrl }} style={{ flex: 1 }} /> : null}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
