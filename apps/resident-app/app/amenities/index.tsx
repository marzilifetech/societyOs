import { ScrollView, View, Text, TouchableOpacity, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';
import { ErrorCard } from '../../src/components/ErrorCard';
import { useTheme } from '../../src/hooks/useTheme';
import { SkeletonPlaceholder } from '../../src/components/common/SkeletonPlaceholder';

type IoniconName = keyof typeof Ionicons.glyphMap;

type Amenity = {
  id: string;
  name: string;
  description: string;
  category: string;
  availableFrom: string;
  availableTo: string;
  maxCapacity: number;
  pricePerHour: number;
  status: string;
};

const CATEGORY_ICONS: Record<string, IoniconName> = {
  pool: 'water',
  gym: 'barbell',
  tennis: 'fitness',
  clubhouse: 'home',
  badminton: 'fitness',
  garden: 'leaf',
  hall: 'home',
  default: 'business',
};

function getIcon(name: string, category: string): IoniconName {
  const key = (name + category).toLowerCase();
  for (const [k, v] of Object.entries(CATEGORY_ICONS)) {
    if (key.includes(k)) return v;
  }
  return CATEGORY_ICONS.default;
}

export default function AmenitiesScreen() {
  const t = useTheme();
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery<Amenity[]>({
    queryKey: ['amenities'],
    queryFn: () => api.get<Amenity[]>('/amenities'),
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2 mr-2" accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-2xl font-bold text-gray-900">Amenities</Text>
          <Text className="text-sm text-gray-500 mt-0.5">Book facilities in your society</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/amenities/bookings' as any)}
          className="bg-primary-50 border border-primary-500 rounded-xl px-3.5 py-2 flex-row items-center gap-1.5"
          accessibilityRole="button"
          accessibilityLabel="View my bookings"
        >
          <Ionicons name="calendar" size={14} color="#821A52" />
          <Text className="text-primary-500 text-sm font-semibold">My Bookings</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#821A52" />}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 48, paddingTop: 8 }}
      >
        {isLoading && (
          <SkeletonPlaceholder count={4} height={110} className="bg-gray-100" borderRadius={20} />
        )}

        {isError && (
          <ErrorCard
            message="Amenities couldn't be loaded. Your information is safe — please try again."
            onRetry={() => refetch()}
          />
        )}

        {!isLoading && !isError && data?.length === 0 && (
          <View className="bg-gray-50 border border-gray-200 rounded-2xl p-8 items-center mt-10">
            <View className="w-16 h-16 rounded-full bg-primary-50 items-center justify-center mb-3">
              <Ionicons name="business" size={32} color="#821A52" />
            </View>
            <Text className="text-lg font-semibold text-gray-900">No amenities listed</Text>
            <Text className="text-sm text-gray-500 text-center mt-1">Your society hasn't listed any amenities yet</Text>
          </View>
        )}

        {data?.map((amenity: any) => (
          <View
            key={amenity.id}
            className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-3"
          >
            <View className="flex-row items-center">
              <View className="w-12 h-12 rounded-xl bg-primary-50 items-center justify-center mr-3.5">
                <Ionicons name={getIcon(amenity.name, amenity.category)} size={24} color="#821A52" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-bold text-gray-900">{amenity.name}</Text>
                <Text className="text-xs text-gray-500 mt-0.5">{amenity.availableFrom} – {amenity.availableTo}</Text>
                <View className="flex-row items-center mt-1">
                  <View className={`rounded-full px-2 py-0.5 ${amenity.status === 'AVAILABLE' ? 'bg-green-100' : 'bg-red-100'}`}>
                    <Text className={`text-xs font-semibold ${amenity.status === 'AVAILABLE' ? 'text-green-700' : 'text-red-700'}`}>
                      {amenity.status === 'AVAILABLE' ? 'Available' : 'Unavailable'}
                    </Text>
                  </View>
                  {amenity.pricePerHour > 0 && (
                    <Text className="text-xs text-gray-500 ml-2">₹{amenity.pricePerHour}/hr</Text>
                  )}
                </View>
              </View>
              <TouchableOpacity
                onPress={() => router.push(`/amenities/${amenity.id}` as any)}
                disabled={amenity.status !== 'AVAILABLE'}
                className={`rounded-xl px-4 py-2.5 flex-row items-center gap-1 ${amenity.status === 'AVAILABLE' ? 'bg-primary-500' : 'bg-gray-200'}`}
                style={{ minHeight: t.touchTargetSm, justifyContent: 'center' }}
                accessibilityRole="button"
                accessibilityLabel={`Book ${amenity.name}`}
              >
                <Text className={`font-bold text-sm ${amenity.status === 'AVAILABLE' ? 'text-white' : 'text-gray-400'}`}>Book</Text>
                {amenity.status === 'AVAILABLE' && <Ionicons name="chevron-forward" size={14} color="#fff" />}
              </TouchableOpacity>
            </View>
            {amenity.description ? (
              <Text className="text-xs text-gray-500 mt-2.5" numberOfLines={2}>{amenity.description}</Text>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
