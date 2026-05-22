import { ScrollView, View, Text, TouchableOpacity, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';

type BudgetBreakdown = {
  category: string;
  allocated: number;
  spent: number;
  percentage: number;
};

type Budget = {
  year: number;
  totalBudget: number;
  spent: number;
  remaining: number;
  breakdown: BudgetBreakdown[];
};

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];

function fmt(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
}

export default function BudgetScreen() {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery<Budget>({
    queryKey: ['society-budget', year],
    queryFn: () => api.get<Budget>(`/societies/budget?year=${year}`),
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const spentPct = data ? Math.min(100, Math.round((data.spent / data.totalBudget) * 100)) : 0;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center mr-2" accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={24} color="#374151" />
        </TouchableOpacity>
        <Text className="text-2xl font-bold text-gray-900 flex-1">Society Budget</Text>
      </View>

      {/* Year selector */}
      <View className="flex-row px-6 gap-2.5 mb-2">
        {YEAR_OPTIONS.map((y) => (
          <TouchableOpacity
            key={y}
            onPress={() => setYear(y)}
            className={`rounded-xl px-4 py-2 min-h-[44px] justify-center border ${year === y ? 'bg-primary-500 border-primary-500' : 'bg-gray-50 border-gray-200'}`}
          >
            <Text className={`font-semibold ${year === y ? 'text-white' : 'text-gray-500'}`}>{y}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#821A52" />}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 80 }}
      >
        {isLoading && (
          <>
            <View className="bg-gray-50 rounded-3xl h-40 mb-4" />
            {[1, 2, 3].map((i) => (
              <View key={i} className="bg-gray-50 rounded-2xl h-20 mb-3" />
            ))}
          </>
        )}

        {isError && (
          <View className="bg-gray-50 border border-gray-200 rounded-3xl p-6 items-center mt-4">
            <View className="w-16 h-16 rounded-2xl bg-primary-50 items-center justify-center mb-4">
              <Ionicons name="alert-circle" size={32} color="#821A52" />
            </View>
            <Text className="text-gray-500 text-base mb-3">Could not load budget</Text>
            <TouchableOpacity onPress={() => refetch()} className="bg-primary-500 rounded-2xl px-6 py-3">
              <Text className="text-white font-semibold">Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {!isLoading && !isError && !data && (
          <View className="bg-gray-50 border border-gray-200 rounded-3xl p-8 items-center mt-10">
            <View className="w-16 h-16 rounded-2xl bg-primary-50 items-center justify-center mb-4">
              <Ionicons name="cash" size={32} color="#821A52" />
            </View>
            <Text className="text-gray-900 text-lg font-semibold">Budget not published yet</Text>
            <Text className="text-gray-500 text-sm text-center mt-2">The society hasn't published the {year} budget</Text>
          </View>
        )}

        {data && (
          <>
            {/* Summary card */}
            <View className="bg-gray-50 border border-gray-200 rounded-3xl p-5 mb-5 mt-2">
              <View className="flex-row items-center mb-1">
                <View className="w-9 h-9 rounded-xl bg-primary-100 items-center justify-center mr-2.5">
                  <Ionicons name="pie-chart" size={18} color="#821A52" />
                </View>
                <Text className="text-xs font-bold text-gray-500 tracking-wide">TOTAL BUDGET {data.year}</Text>
              </View>
              <Text className="text-gray-900 text-3xl font-extrabold mb-4">{fmt(data.totalBudget)}</Text>

              {/* Progress bar */}
              <View className="bg-gray-200 rounded-lg h-2.5 mb-2.5 overflow-hidden">
                <View
                  className={`h-2.5 rounded-lg ${spentPct > 85 ? 'bg-red-600' : 'bg-primary-500'}`}
                  style={{ width: `${spentPct}%` }}
                />
              </View>

              <View className="flex-row justify-between">
                <View>
                  <Text className="text-gray-500 text-xs">Spent</Text>
                  <Text className="text-gray-900 text-base font-bold">
                    {fmt(data.spent)} <Text className="text-gray-400 text-sm">({spentPct}%)</Text>
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-gray-500 text-xs">Remaining</Text>
                  <Text className="text-green-600 text-base font-bold">{fmt(data.remaining)}</Text>
                </View>
              </View>
            </View>

            <View className="flex-row items-center mb-3">
              <Ionicons name="stats-chart" size={14} color="#6B7280" />
              <Text className="text-gray-500 text-xs font-bold ml-1.5 tracking-wide">BREAKDOWN</Text>
            </View>

            {data.breakdown?.length === 0 && (
              <Text className="text-gray-400 text-sm text-center mt-4">No breakdown available</Text>
            )}

            {data.breakdown?.map((item: BudgetBreakdown) => {
              const pct = Math.min(100, Math.round(item.percentage));
              return (
                <View key={item.category} className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-3">
                  <View className="flex-row justify-between mb-2">
                    <Text className="text-gray-900 text-[15px] font-semibold">{item.category}</Text>
                    <Text className="text-gray-500 text-sm">{pct}%</Text>
                  </View>
                  <View className="bg-gray-200 rounded-md h-1.5 mb-2 overflow-hidden">
                    <View className="bg-primary-500 h-1.5 rounded-md" style={{ width: `${pct}%` }} />
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-gray-500 text-xs">Allocated: <Text className="text-gray-900">{fmt(item.allocated)}</Text></Text>
                    <Text className="text-gray-500 text-xs">Spent: <Text className="text-gray-900">{fmt(item.spent)}</Text></Text>
                  </View>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
