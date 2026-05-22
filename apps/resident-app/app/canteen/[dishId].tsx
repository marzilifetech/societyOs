import { ScrollView, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';

type Review = { id: string; rating: number; comment?: string; residentName: string; createdAt: string };
type DishDetail = {
  id: string;
  name: string;
  description?: string;
  isVeg: boolean;
  price: number;
  calories?: number;
  allergens?: string[];
  avgRating?: number;
  ratingCount?: number;
  reviews?: Review[];
};

function Stars({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <View className="flex-row">
      {[1, 2, 3, 4, 5].map((s) => (
        <Ionicons
          key={s}
          name={s <= rating ? 'star' : 'star-outline'}
          size={size}
          color={s <= rating ? '#F59E0B' : '#D1D5DB'}
        />
      ))}
    </View>
  );
}

export default function DishDetailScreen() {
  const { dishId } = useLocalSearchParams<{ dishId: string }>();

  const { data: dish, isLoading, isError, refetch } = useQuery<DishDetail>({
    queryKey: ['dish', dishId],
    queryFn: () => api.get<DishDetail>(`/canteen/dishes/${dishId}`),
    enabled: !!dishId,
  });

  const canRate = new Date().getHours() >= 9;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-3 flex-row items-center gap-3">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={24} color="#821A52" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900 flex-1" numberOfLines={1}>{dish?.name ?? 'Dish Detail'}</Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#821A52" size="large" />
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-16 h-16 rounded-full bg-red-50 items-center justify-center mb-3">
            <Ionicons name="alert-circle" size={32} color="#DC2626" />
          </View>
          <Text className="text-lg font-semibold text-gray-900 mb-4">Failed to load</Text>
          <TouchableOpacity onPress={() => refetch()} className="bg-primary-500 rounded-xl px-6 py-3">
            <Text className="text-white font-semibold">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : dish ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
          {/* Main card */}
          <View className="bg-gray-50 border border-gray-200 rounded-2xl p-5 mb-4">
            <View className="flex-row items-center gap-2 mb-3">
              <View
                className={`w-7 h-7 rounded items-center justify-center ${dish.isVeg ? 'bg-green-100' : 'bg-red-100'}`}
              >
                <Ionicons
                  name={dish.isVeg ? 'leaf' : 'flame'}
                  size={16}
                  color={dish.isVeg ? '#16A34A' : '#DC2626'}
                />
              </View>
              <Text className="text-sm text-gray-500">{dish.isVeg ? 'Vegetarian' : 'Non-Vegetarian'}</Text>
            </View>
            <Text className="text-2xl font-bold text-gray-900 mb-2">{dish.name}</Text>
            {dish.description ? (
              <Text className="text-base leading-6 text-gray-500 mb-4">{dish.description}</Text>
            ) : null}
            <View className="flex-row items-center justify-between">
              <Text className="text-2xl font-bold text-primary-500">₹{dish.price}</Text>
              {dish.calories ? (
                <View className="flex-row items-center gap-1">
                  <Ionicons name="flame-outline" size={14} color="#6B7280" />
                  <Text className="text-sm text-gray-500">{dish.calories} kcal</Text>
                </View>
              ) : null}
            </View>
          </View>

          {dish.allergens?.length ? (
            <View className="bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-4">
              <View className="flex-row items-center gap-1.5 mb-1">
                <Ionicons name="warning" size={16} color="#F97316" />
                <Text className="font-semibold text-orange-600">Allergens</Text>
              </View>
              <Text className="text-sm text-orange-600 ml-6">{dish.allergens.join(' · ')}</Text>
            </View>
          ) : null}

          {/* Rating */}
          {dish.avgRating !== undefined && (
            <View className="bg-gray-50 border border-gray-200 rounded-2xl p-5 mb-4">
              <Text className="text-lg font-semibold text-gray-900 mb-3">Rating</Text>
              <View className="flex-row items-center gap-3">
                <View className="bg-amber-100 rounded-2xl px-3 py-2 flex-row items-center gap-1.5">
                  <Ionicons name="star" size={20} color="#F59E0B" />
                  <Text className="text-3xl font-bold text-amber-700">{dish.avgRating.toFixed(1)}</Text>
                </View>
                <View>
                  <Stars rating={Math.round(dish.avgRating)} size={18} />
                  <Text className="text-xs text-gray-400 mt-1">{dish.ratingCount ?? 0} ratings</Text>
                </View>
              </View>
            </View>
          )}

          {/* Reviews */}
          {dish.reviews?.length ? (
            <View className="mb-6">
              <Text className="text-xl font-semibold text-gray-900 mb-3">Recent Reviews</Text>
              {dish.reviews.map((r) => (
                <View key={r.id} className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-3">
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="font-semibold text-gray-900">{r.residentName}</Text>
                    <Stars rating={r.rating} />
                  </View>
                  {r.comment ? <Text className="text-sm leading-5 text-gray-500">{r.comment}</Text> : null}
                  <View className="flex-row items-center gap-1 mt-2">
                    <Ionicons name="calendar-outline" size={11} color="#9CA3AF" />
                    <Text className="text-xs text-gray-400">
                      {new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {canRate && (
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/canteen/rate', params: { dishId } } as any)}
              className="bg-primary-500 rounded-2xl py-4 items-center justify-center flex-row gap-2"
            >
              <Ionicons name="star" size={20} color="#FFFFFF" />
              <Text className="text-white font-bold text-base">Rate this Dish</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}
