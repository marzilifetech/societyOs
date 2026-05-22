import { ScrollView, View, Text, TouchableOpacity, RefreshControl, Animated } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../../src/lib/api';

type IoniconName = keyof typeof Ionicons.glyphMap;
type VitalType = 'bp' | 'sugar' | 'weight' | 'spo2';

type VitalReading = {
  id: string;
  value: string;
  unit: string;
  recordedAt: string;
  notes?: string;
};

type VitalsData = {
  readings: VitalReading[];
  sparkline: number[];
};

const TABS: { key: VitalType; label: string; unit: string; icon: IoniconName; tint: string }[] = [
  { key: 'bp', label: 'BP', unit: 'mmHg', icon: 'pulse', tint: '#DC2626' },
  { key: 'sugar', label: 'Sugar', unit: 'mg/dL', icon: 'water', tint: '#0EA5E9' },
  { key: 'weight', label: 'Weight', unit: 'kg', icon: 'scale', tint: '#16A34A' },
  { key: 'spo2', label: 'SpO2', unit: '%', icon: 'fitness', tint: '#7C3AED' },
];

function Sparkline({ values }: { values: number[] }) {
  if (!values || values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const h = 60;

  return (
    <View className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-4">
      <Text className="text-gray-500 text-sm mb-3">Last 7 days</Text>
      <View style={{ height: h }}>
        <View className="flex-row items-end justify-between h-full px-1">
          {values.map((v, i) => {
            const barHeight = Math.max(4, ((v - min) / range) * (h - 16));
            return (
              <View
                key={i}
                style={{ height: barHeight, width: 24, backgroundColor: '#821A52', borderRadius: 4, opacity: 0.7 + 0.3 * (i / values.length) }}
              />
            );
          })}
        </View>
      </View>
      <View className="flex-row justify-between mt-2">
        <Text className="text-gray-400 text-xs">Low: {min}</Text>
        <Text className="text-gray-400 text-xs">High: {max}</Text>
      </View>
    </View>
  );
}

export default function VitalsScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const [activeTab, setActiveTab] = useState<VitalType>((params.tab as VitalType) || 'bp');
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const { data, isLoading, isError, refetch } = useQuery<VitalsData>({
    queryKey: ['vitals', activeTab],
    queryFn: () => api.get<VitalsData>(`/health/vitals?type=${activeTab}&days=7`),
  });

  useEffect(() => {
    fadeAnim.setValue(0);
    if (data) Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [data]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="px-6 pt-4 pb-2 flex-row items-center justify-between">
        <TouchableOpacity onPress={() => router.back()} className="mr-3" style={{ minHeight: 48, justifyContent: 'center' }}>
          <Ionicons name="chevron-back" size={24} color="#821A52" />
        </TouchableOpacity>
        <Text className="text-2xl font-bold text-gray-900 flex-1">Vitals Log</Text>
        <TouchableOpacity
          onPress={() => router.push('/health/vitals/log' as any)}
          className="bg-primary-500 rounded-xl px-4 py-3 flex-row items-center gap-1"
          style={{ minHeight: 48, justifyContent: 'center' }}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text className="text-white font-semibold text-sm">Log</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View className="flex-row px-6 mb-4 gap-2">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              className="flex-1 rounded-xl py-2 items-center"
              style={{
                minHeight: 56,
                backgroundColor: isActive ? '#821A52' : '#F9FAFB',
                borderWidth: 1,
                borderColor: isActive ? '#821A52' : '#E5E7EB',
              }}
            >
              <Ionicons name={tab.icon} size={16} color={isActive ? '#fff' : tab.tint} />
              <Text className="text-xs font-semibold mt-0.5" style={{ color: isActive ? '#fff' : '#6B7280' }}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#821A52" />}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 48 }}
      >
        {isLoading && (
          <>
            <View className="bg-gray-50 border border-gray-200 rounded-2xl h-20 mb-3" />
            <View className="bg-gray-50 border border-gray-200 rounded-2xl h-16 mb-3" />
            <View className="bg-gray-50 border border-gray-200 rounded-2xl h-16 mb-3" />
          </>
        )}

        {isError && (
          <View className="bg-gray-50 border border-gray-200 rounded-2xl p-6 items-center">
            <Text className="text-gray-500 text-base mb-3">Could not load vitals</Text>
            <TouchableOpacity onPress={() => refetch()} className="bg-primary-500 rounded-xl px-6 py-3">
              <Text className="text-white font-semibold">Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {data && (
          <Animated.View style={{ opacity: fadeAnim }}>
            <Sparkline values={data.sparkline} />

            <TouchableOpacity
              onPress={() => router.push(`/health/vitals/${activeTab}` as any)}
              className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 mb-4 flex-row justify-between items-center"
              style={{ minHeight: 48 }}
            >
              <Text className="text-gray-900 text-sm">View 30-day history & statistics</Text>
              <Ionicons name="chevron-forward" size={20} color="#821A52" />
            </TouchableOpacity>

            {data.readings.length === 0 ? (
              <View className="bg-gray-50 border border-gray-200 rounded-2xl p-8 items-center">
                <View className="w-16 h-16 rounded-2xl bg-primary-50 items-center justify-center mb-4">
                  <Ionicons name="pulse" size={32} color="#821A52" />
                </View>
                <Text className="text-gray-900 text-base font-semibold mb-2">No readings yet</Text>
                <Text className="text-gray-500 text-sm text-center">Tap + Log to add your first reading</Text>
              </View>
            ) : (
              data.readings.map((r) => (
                <View key={r.id} className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 mb-3">
                  <View className="flex-row justify-between items-center">
                    <Text className="text-gray-900 text-xl font-bold">{r.value}</Text>
                    <Text className="text-gray-500 text-sm">{TABS.find(t => t.key === activeTab)?.unit}</Text>
                  </View>
                  <Text className="text-gray-500 text-sm mt-1">{new Date(r.recordedAt).toLocaleString()}</Text>
                  {r.notes && <Text className="text-gray-500 text-sm mt-1 italic">{r.notes}</Text>}
                </View>
              ))
            )}
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
