import { ScrollView, View, Text, TouchableOpacity, RefreshControl, Animated } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';
import { ErrorCard } from '../../src/components/ErrorCard';

type IoniconName = keyof typeof Ionicons.glyphMap;

type VitalsSummary = {
  bp?: { systolic: number; diastolic: number; recordedAt: string };
  sugar?: { value: number; recordedAt: string };
  weight?: { value: number; recordedAt: string };
  spo2?: { value: number; recordedAt: string };
};

type MedReminder = {
  id: string;
  name: string;
  dosage: string;
  time: string;
  taken: boolean;
};

type TodaySummary = {
  vitals: VitalsSummary;
  medications: MedReminder[];
};

type QuickLink = { label: string; icon: IoniconName; route: string; tint: string };

const QUICK_LINKS: QuickLink[] = [
  { label: 'Log Vitals', icon: 'pulse', route: '/health/vitals/log', tint: '#DC2626' },
  { label: 'View Records', icon: 'folder', route: '/health/records', tint: '#0EA5E9' },
  { label: 'Medications', icon: 'medkit', route: '/health/medications', tint: '#16A34A' },
  { label: 'Appointments', icon: 'calendar', route: '/medical/appointments', tint: '#7C3AED' },
];

function SkeletonCard() {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={{ opacity }} className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-3 h-24" />
  );
}

export default function HealthHubScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const { data, isLoading, isError, refetch } = useQuery<TodaySummary>({
    queryKey: ['health-today'],
    queryFn: () => api.get<TodaySummary>('/health/today'),
  });

  useEffect(() => {
    if (data) {
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }
  }, [data]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#821A52" />}
        contentContainerStyle={{ padding: 24, paddingBottom: 48 }}
      >
        <Text className="text-2xl font-bold text-gray-900 mb-1">Health</Text>
        <Text className="text-sm text-gray-500 mb-6">Your wellness at a glance</Text>

        {/* Quick Links */}
        <View className="flex-row flex-wrap gap-3 mb-6">
          {QUICK_LINKS.map((link) => (
            <TouchableOpacity
              key={link.label}
              onPress={() => router.push(link.route as any)}
              className="bg-gray-50 border border-gray-200 rounded-2xl p-4 items-center justify-center"
              style={{ width: '47%', minHeight: 96 }}
              accessibilityRole="button"
              accessibilityLabel={link.label}
            >
              <View
                className="w-11 h-11 rounded-xl items-center justify-center mb-2"
                style={{ backgroundColor: `${link.tint}1A` }}
              >
                <Ionicons name={link.icon} size={22} color={link.tint} />
              </View>
              <Text className="text-sm font-semibold text-gray-700 text-center">{link.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Vitals Summary */}
        <Text className="text-xl font-semibold text-gray-900 mb-3">Today's Vitals</Text>

        {isLoading && (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        )}

        {isError && (
          <ErrorCard
            message="Your health data couldn't be loaded. Please try again — all your records are safe."
            onRetry={() => refetch()}
          />
        )}

        {data && (
          <Animated.View style={{ opacity: fadeAnim }}>
            <View className="flex-row flex-wrap gap-3 mb-6">
              <VitalCard
                label="Blood Pressure"
                value={data.vitals.bp ? `${data.vitals.bp.systolic}/${data.vitals.bp.diastolic}` : '—'}
                unit="mmHg"
                icon="pulse"
                tint="#DC2626"
                onPress={() => router.push('/health/vitals?tab=bp' as any)}
              />
              <VitalCard
                label="Blood Sugar"
                value={data.vitals.sugar ? String(data.vitals.sugar.value) : '—'}
                unit="mg/dL"
                icon="water"
                tint="#0EA5E9"
                onPress={() => router.push('/health/vitals?tab=sugar' as any)}
              />
              <VitalCard
                label="Weight"
                value={data.vitals.weight ? String(data.vitals.weight.value) : '—'}
                unit="kg"
                icon="scale"
                tint="#16A34A"
                onPress={() => router.push('/health/vitals?tab=weight' as any)}
              />
              <VitalCard
                label="SpO2"
                value={data.vitals.spo2 ? String(data.vitals.spo2.value) : '—'}
                unit="%"
                icon="fitness"
                tint="#7C3AED"
                onPress={() => router.push('/health/vitals?tab=spo2' as any)}
              />
            </View>

            {/* Medication Reminders */}
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-xl font-semibold text-gray-900">Medications Today</Text>
              <TouchableOpacity
                onPress={() => router.push('/health/medications' as any)}
                accessibilityRole="button"
                accessibilityLabel="See all medications"
              >
                <Text className="text-primary-500 text-sm font-semibold">See all</Text>
              </TouchableOpacity>
            </View>

            {data.medications.length === 0 ? (
              <View className="bg-gray-50 border border-gray-200 rounded-2xl p-6 items-center">
                <View className="w-16 h-16 rounded-2xl bg-primary-50 items-center justify-center mb-4">
                  <Ionicons name="checkmark-circle" size={32} color="#821A52" />
                </View>
                <Text className="text-gray-500 text-sm">No medications scheduled</Text>
              </View>
            ) : (
              data.medications.map((med) => <MedReminderRow key={med.id} med={med} />)
            )}
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function VitalCard({
  label, value, unit, icon, tint, onPress,
}: {
  label: string; value: string; unit: string; icon: IoniconName; tint: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="bg-gray-50 border border-gray-200 rounded-2xl p-4"
      style={{ width: '47%', minHeight: 110 }}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value} ${unit}`}
    >
      <View
        className="w-10 h-10 rounded-xl items-center justify-center mb-2"
        style={{ backgroundColor: `${tint}1A` }}
      >
        <Ionicons name={icon} size={20} color={tint} />
      </View>
      <Text className="text-xl font-bold text-gray-900">{value}</Text>
      <Text className="text-xs text-gray-400 mt-0.5">{unit}</Text>
      <Text className="text-xs text-gray-500 mt-1">{label}</Text>
    </TouchableOpacity>
  );
}

function MedReminderRow({ med }: { med: MedReminder }) {
  return (
    <View className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 mb-3 flex-row items-center">
      <View
        className="w-6 h-6 rounded-full border-2 items-center justify-center mr-4"
        style={{ borderColor: med.taken ? '#821A52' : '#9CA3AF' }}
      >
        {med.taken && <Ionicons name="checkmark" size={14} color="#821A52" />}
      </View>
      <View className="flex-1">
        <Text className="text-gray-900 font-semibold text-base">{med.name}</Text>
        <Text className="text-gray-500 text-sm">{med.dosage} · {med.time}</Text>
      </View>
      {med.taken && <Text className="text-primary-500 text-sm font-semibold">Taken</Text>}
    </View>
  );
}
