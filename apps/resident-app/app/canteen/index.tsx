import { useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';

type IoniconName = keyof typeof Ionicons.glyphMap;

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MEAL_TYPES = ['BREAKFAST', 'LUNCH', 'SNACKS', 'DINNER'] as const;
const MEAL_LABELS: Record<string, string> = {
  BREAKFAST: 'Breakfast',
  LUNCH: 'Lunch',
  SNACKS: 'Snacks',
  DINNER: 'Dinner',
};
const MEAL_ICONS: Record<string, IoniconName> = {
  BREAKFAST: 'cafe',
  LUNCH: 'restaurant',
  SNACKS: 'ice-cream',
  DINNER: 'restaurant-outline',
};

type Dish = {
  id: string;
  name: string;
  isVeg: boolean;
  price: number;
  calories?: number;
  allergens?: string[];
  rating?: number;
  ratingCount?: number;
};

type Menu = {
  id: string;
  date: string;
  mealType: string;
  dishes?: Dish[];
};

function getWeekDates() {
  const today = new Date();
  const day = today.getDay();
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - day);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    return d;
  });
}

export default function CanteenScreen() {
  const weekDates = getWeekDates();
  const todayIdx = new Date().getDay();
  const [selectedDayIdx, setSelectedDayIdx] = useState(todayIdx);
  const [selectedMeal, setSelectedMeal] = useState<string>('BREAKFAST');
  const [refreshing, setRefreshing] = useState(false);

  const { data: menus, isLoading, isError, refetch } = useQuery<Menu[]>({
    queryKey: ['canteen-menu'],
    queryFn: () => api.get<Menu[]>('/canteen/menu'),
  });

  const selectedDate = weekDates[selectedDayIdx].toISOString().split('T')[0];
  const filtered: Menu[] = menus?.filter(
    (m: Menu) => m.date?.startsWith(selectedDate) && m.mealType === selectedMeal
  ) ?? [];
  const dishes: Dish[] = filtered.flatMap((m: Menu) => m.dishes ?? []);

  const popular: Dish[] = menus
    ?.flatMap((m: Menu) => m.dishes ?? [])
    .filter((d: Dish) => (d.rating ?? 0) >= 4)
    .slice(0, 5) ?? [];

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="px-6 pt-4 pb-3 flex-row items-center gap-3">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={24} color="#821A52" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-2xl font-bold text-gray-900">Canteen</Text>
          <Text className="text-sm text-gray-500">Community dining menu</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/canteen/pre-order' as any)}
          className="bg-primary-500 rounded-xl px-4 py-2 flex-row items-center gap-1.5"
          accessibilityRole="button"
          accessibilityLabel="Go to pre-order"
        >
          <Ionicons name="bag-handle" size={16} color="#FFFFFF" />
          <Text className="text-white font-semibold text-sm">Pre-Order</Text>
        </TouchableOpacity>
      </View>

      {/* Day strip */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4 mb-3" style={{ maxHeight: 76 }}>
        <View className="flex-row gap-2 py-2">
          {weekDates.map((d, i) => {
            const isToday = i === todayIdx;
            const isSelected = i === selectedDayIdx;
            return (
              <TouchableOpacity
                key={i}
                onPress={() => setSelectedDayIdx(i)}
                className={`min-w-[52px] min-h-[52px] rounded-2xl items-center justify-center px-2 border ${
                  isSelected
                    ? 'bg-primary-500 border-primary-500'
                    : isToday
                    ? 'bg-primary-50 border-primary-500'
                    : 'bg-gray-50 border-gray-200'
                }`}
                accessibilityRole="button"
                accessibilityLabel={`${DAYS[i]} ${d.getDate()}${isToday ? ', today' : ''}${isSelected ? ', selected' : ''}`}
              >
                <Text className={`text-xs ${isSelected ? 'text-white' : 'text-gray-500'}`}>{DAYS[i]}</Text>
                <Text className={`text-base font-bold ${isSelected ? 'text-white' : 'text-gray-900'}`}>{d.getDate()}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Meal tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4 mb-4" style={{ maxHeight: 52 }}>
        <View className="flex-row gap-2">
          {MEAL_TYPES.map((mt) => {
            const isSelected = selectedMeal === mt;
            return (
              <TouchableOpacity
                key={mt}
                onPress={() => setSelectedMeal(mt)}
                className={`px-4 py-2 rounded-full border flex-row items-center gap-1.5 ${
                  isSelected ? 'bg-primary-500 border-primary-500' : 'bg-gray-50 border-gray-200'
                }`}
                accessibilityRole="button"
                accessibilityLabel={`${MEAL_LABELS[mt]}${isSelected ? ', selected' : ''}`}
              >
                <Ionicons name={MEAL_ICONS[mt]} size={14} color={isSelected ? '#FFFFFF' : '#6B7280'} />
                <Text className={`font-semibold text-sm ${isSelected ? 'text-white' : 'text-gray-500'}`}>
                  {MEAL_LABELS[mt]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await refetch(); setRefreshing(false); }} tintColor="#821A52" />
        }
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {isLoading ? (
          <View className="flex-1 items-center justify-center py-20">
            <ActivityIndicator color="#821A52" size="large" />
          </View>
        ) : isError ? (
          <View className="items-center py-20 px-8">
            <View className="w-16 h-16 rounded-full bg-red-50 items-center justify-center mb-3">
              <Ionicons name="alert-circle" size={32} color="#DC2626" />
            </View>
            <Text className="text-lg font-semibold text-gray-900 mb-2">Failed to load menu</Text>
            <TouchableOpacity
              onPress={() => refetch()}
              className="bg-primary-500 rounded-xl px-6 py-3 mt-2"
              accessibilityRole="button"
              accessibilityLabel="Retry loading menu"
            >
              <Text className="text-white font-semibold text-base">Retry</Text>
            </TouchableOpacity>
          </View>
        ) : dishes.length === 0 ? (
          <View className="items-center py-20 px-8">
            <View className="w-20 h-20 rounded-full bg-primary-50 items-center justify-center mb-4">
              <Ionicons name="restaurant-outline" size={40} color="#821A52" />
            </View>
            <Text className="text-lg font-semibold text-gray-900 mb-2">No menu available</Text>
            <Text className="text-sm text-gray-500 text-center">
              No {MEAL_LABELS[selectedMeal].toLowerCase()} items for this day yet.
            </Text>
          </View>
        ) : (
          <View className="px-6 gap-3">
            {dishes.map((dish) => (
              <TouchableOpacity
                key={dish.id}
                onPress={() => router.push(`/canteen/${dish.id}` as any)}
                className="bg-gray-50 border border-gray-200 rounded-2xl p-4"
                accessibilityRole="button"
                accessibilityLabel={`View ${dish.name}, ₹${dish.price}, ${dish.isVeg ? 'vegetarian' : 'non-vegetarian'}`}
              >
                <View className="flex-row items-start justify-between">
                  <View className="flex-row items-center gap-2 flex-1 mr-3">
                    <View
                      className={`w-6 h-6 rounded items-center justify-center ${dish.isVeg ? 'bg-green-100' : 'bg-red-100'}`}
                    >
                      <Ionicons
                        name={dish.isVeg ? 'leaf' : 'flame'}
                        size={14}
                        color={dish.isVeg ? '#16A34A' : '#DC2626'}
                      />
                    </View>
                    <Text className="text-base font-semibold text-gray-900 flex-1">{dish.name}</Text>
                  </View>
                  <Text className="text-base font-bold text-primary-500">₹{dish.price}</Text>
                </View>
                <View className="flex-row items-center gap-4 mt-2 ml-8">
                  {dish.calories ? (
                    <View className="flex-row items-center gap-1">
                      <Ionicons name="flame-outline" size={12} color="#6B7280" />
                      <Text className="text-sm text-gray-500">{dish.calories} kcal</Text>
                    </View>
                  ) : null}
                  {dish.rating ? (
                    <View className="flex-row items-center gap-1 bg-amber-100 rounded-full px-2 py-0.5">
                      <Ionicons name="star" size={12} color="#F59E0B" />
                      <Text className="text-xs font-semibold text-amber-700">
                        {dish.rating.toFixed(1)} ({dish.ratingCount})
                      </Text>
                    </View>
                  ) : null}
                </View>
                {dish.allergens?.length ? (
                  <View className="flex-row items-center gap-1 mt-1 ml-8">
                    <Ionicons name="warning-outline" size={12} color="#F97316" />
                    <Text className="text-sm text-orange-500">Allergens: {dish.allergens.join(', ')}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {popular.length > 0 && (
          <View className="px-6 mt-8">
            <View className="flex-row items-center gap-2 mb-4">
              <Ionicons name="trending-up" size={20} color="#F97316" />
              <Text className="text-xl font-semibold text-gray-900">Popular Dishes</Text>
            </View>
            {popular.map((dish) => (
              <TouchableOpacity
                key={dish.id}
                onPress={() => router.push(`/canteen/${dish.id}` as any)}
                className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-3 flex-row items-center"
                accessibilityRole="button"
                accessibilityLabel={`View ${dish.name}, ₹${dish.price}, rated ${dish.rating?.toFixed(1)}`}
              >
                <View
                  className={`w-6 h-6 rounded items-center justify-center mr-3 ${dish.isVeg ? 'bg-green-100' : 'bg-red-100'}`}
                >
                  <Ionicons
                    name={dish.isVeg ? 'leaf' : 'flame'}
                    size={14}
                    color={dish.isVeg ? '#16A34A' : '#DC2626'}
                  />
                </View>
                <Text className="text-base font-semibold text-gray-900 flex-1">{dish.name}</Text>
                <View className="flex-row items-center gap-1 bg-amber-100 rounded-full px-2 py-0.5 mr-3">
                  <Ionicons name="star" size={12} color="#F59E0B" />
                  <Text className="text-xs font-semibold text-amber-700">{(dish.rating ?? 0).toFixed(1)}</Text>
                </View>
                <Text className="text-base font-bold text-primary-500">₹{dish.price}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
