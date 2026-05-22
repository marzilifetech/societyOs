import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../src/lib/api';
import { TrendChart } from '../../src/components/review/TrendChart';

type Performance = {
  avgRating: number;
  totalTasks: number;
  completionRate: number;
  trend30d: number[];
  leaderboardRank?: { position: number; outOf: number };
  monthlyGoals?: { tasksTarget: number; tasksDone: number; ratingTarget: number; ratingActual: number };
};

const TIPS = [
  { icon: '⏱️', title: 'Respond faster', body: 'Accept tasks within 5 minutes to boost your rating.' },
  { icon: '📸', title: 'Add before/after photos', body: 'Photos build resident trust and reduce disputes.' },
  { icon: '🗒️', title: 'Leave clear notes', body: 'A short summary of what you did improves feedback.' },
];

export default function PerformanceScreen() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-performance'],
    queryFn: () =>
      api
        .get<Performance>('/staff/performance')
        .catch((e) => {
          console.warn('[performance] fetch failed', e?.message);
          return null;
        }),
  });

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="px-6 pt-4 pb-8">
          <TouchableOpacity onPress={() => router.back()}>
            <Text className="text-primary-500 text-base mb-4">← Back</Text>
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-gray-900 mb-1">Performance</Text>
          <Text className="text-gray-500 mb-4">Your trends and stats</Text>

          {isLoading ? (
            <ActivityIndicator color="#821A52" />
          ) : !data ? (
            <View className="bg-white rounded-2xl p-6 items-center">
              <Text className="text-4xl mb-2">📈</Text>
              <Text className="text-gray-400 text-sm">Performance data unavailable</Text>
            </View>
          ) : (
            <>
              {/* Trend chart */}
              <View className="bg-white rounded-2xl p-4 mb-4">
                <Text className="text-sm font-semibold text-gray-700 mb-3">30-Day Rating Trend</Text>
                <TrendChart data={data.trend30d ?? []} />
              </View>

              {/* Stat row */}
              <View className="flex-row gap-2 mb-4">
                <View className="flex-1 bg-white rounded-2xl p-3 items-center">
                  <Text className="text-xl font-bold text-gray-900">{data.totalTasks ?? 0}</Text>
                  <Text className="text-[10px] text-gray-500 mt-1">Tasks</Text>
                </View>
                <View className="flex-1 bg-white rounded-2xl p-3 items-center">
                  <Text className="text-xl font-bold text-gray-900">{(data.avgRating ?? 0).toFixed(1)}</Text>
                  <Text className="text-[10px] text-gray-500 mt-1">Avg Rating</Text>
                </View>
                <View className="flex-1 bg-white rounded-2xl p-3 items-center">
                  <Text className="text-xl font-bold text-gray-900">{Math.round((data.completionRate ?? 0) * 100)}%</Text>
                  <Text className="text-[10px] text-gray-500 mt-1">Completion</Text>
                </View>
                {data.leaderboardRank && (
                  <View className="flex-1 bg-white rounded-2xl p-3 items-center">
                    <Text className="text-xl font-bold text-primary-600">#{data.leaderboardRank.position}</Text>
                    <Text className="text-[10px] text-gray-500 mt-1">of {data.leaderboardRank.outOf}</Text>
                  </View>
                )}
              </View>

              {/* Monthly goals */}
              {data.monthlyGoals && (
                <View className="bg-white rounded-2xl p-4 mb-4">
                  <Text className="text-sm font-semibold text-gray-700 mb-3">Monthly Goals</Text>

                  <Text className="text-xs text-gray-500 mb-1">
                    Tasks: {data.monthlyGoals.tasksDone} / {data.monthlyGoals.tasksTarget}
                  </Text>
                  <View className="bg-gray-100 rounded-full h-2 mb-3 overflow-hidden">
                    <View
                      className="bg-primary-500 h-2"
                      style={{
                        width: `${Math.min(100, (data.monthlyGoals.tasksDone / Math.max(1, data.monthlyGoals.tasksTarget)) * 100)}%`,
                      }}
                    />
                  </View>

                  <Text className="text-xs text-gray-500 mb-1">
                    Rating: {data.monthlyGoals.ratingActual.toFixed(1)} / {data.monthlyGoals.ratingTarget.toFixed(1)}
                  </Text>
                  <View className="bg-gray-100 rounded-full h-2 overflow-hidden">
                    <View
                      className="bg-amber-500 h-2"
                      style={{
                        width: `${Math.min(100, (data.monthlyGoals.ratingActual / Math.max(0.1, data.monthlyGoals.ratingTarget)) * 100)}%`,
                      }}
                    />
                  </View>
                </View>
              )}
            </>
          )}

          {/* Improvement tips */}
          <Text className="text-sm font-semibold text-gray-700 mb-2 mt-2">Tips to Improve</Text>
          {TIPS.map((t) => (
            <View key={t.title} className="bg-white rounded-2xl p-4 mb-2 flex-row items-start">
              <Text className="text-2xl mr-3">{t.icon}</Text>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-gray-900">{t.title}</Text>
                <Text className="text-xs text-gray-500 mt-0.5 leading-4">{t.body}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
