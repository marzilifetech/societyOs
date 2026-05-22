import { ScrollView, View, Text, TouchableOpacity, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';
import { avatarBg } from '../../src/lib/vendorConfig';
import { SkeletonPlaceholder } from '../../src/components/common/SkeletonPlaceholder';

type Vendor = {
  id: string;
  name: string;
  category: string;
  phone: string;
};

const CATEGORIES = ['All', 'Grocery', 'Pharmacy', 'Dairy', 'Bakery', 'Vegetables'];

export default function VendorsScreen() {
  const [filter, setFilter] = useState('All');
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery<Vendor[]>({
    queryKey: ['vendors'],
    queryFn: () => api.get<Vendor[]>('/vendors'),
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const filtered = filter === 'All' ? data : data?.filter((v: Vendor) => v.category === filter);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center mr-2" accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={24} color="#374151" />
        </TouchableOpacity>
        <Text className="text-2xl font-bold text-gray-900 flex-1">Vendors</Text>
      </View>

      {/* Category filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 8, gap: 10 }}
        style={{ flexGrow: 0 }}
      >
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            onPress={() => setFilter(cat)}
            className={`rounded-xl px-4 py-2 min-h-[44px] justify-center border ${filter === cat ? 'bg-primary-500 border-primary-500' : 'bg-gray-50 border-gray-200'}`}
          >
            <Text className={`font-semibold text-sm ${filter === cat ? 'text-white' : 'text-gray-500'}`}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#821A52" />}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 80 }}
      >
        {isLoading && (
          <SkeletonPlaceholder count={4} height={90} className="bg-gray-100" borderRadius={20} />
        )}

        {isError && (
          <View className="bg-gray-50 border border-gray-200 rounded-3xl p-6 items-center mt-4">
            <View className="w-16 h-16 rounded-2xl bg-primary-50 items-center justify-center mb-4">
              <Ionicons name="alert-circle" size={32} color="#821A52" />
            </View>
            <Text className="text-gray-500 text-base mb-3">Could not load vendors</Text>
            <TouchableOpacity onPress={() => refetch()} className="bg-primary-500 rounded-2xl px-6 py-3">
              <Text className="text-white font-semibold">Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {!isLoading && !isError && filtered?.length === 0 && (
          <View className="bg-gray-50 border border-gray-200 rounded-3xl p-8 items-center mt-8">
            <View className="w-16 h-16 rounded-2xl bg-primary-50 items-center justify-center mb-4">
              <Ionicons name="storefront" size={32} color="#821A52" />
            </View>
            <Text className="text-gray-900 text-lg font-semibold">No vendors found</Text>
            <Text className="text-gray-500 text-sm text-center mt-2">
              {filter === 'All' ? 'No vendors available yet' : `No ${filter} vendors registered`}
            </Text>
          </View>
        )}

        {filtered?.map((vendor: Vendor) => {
          return (
            <TouchableOpacity
              key={vendor.id}
              onPress={() => router.push(`/vendors/${vendor.id}` as any)}
              className="bg-gray-50 border border-gray-200 rounded-3xl p-4 mb-3 flex-row items-center min-h-[80px]"
              activeOpacity={0.7}
            >
              {/* Avatar */}
              <View
                style={{ backgroundColor: avatarBg(vendor.name) }}
                className="w-12 h-12 rounded-xl items-center justify-center mr-3.5"
              >
                <Text className="text-white text-xl font-extrabold">{vendor.name.charAt(0).toUpperCase()}</Text>
              </View>

              <View className="flex-1">
                <View className="flex-row items-center gap-2 mb-1 flex-wrap">
                  <Text className="text-gray-900 text-base font-bold">{vendor.name}</Text>
                  <View className="bg-primary-50 rounded-md px-2 py-0.5">
                    <Text className="text-primary-500 text-[11px] font-bold">{vendor.category}</Text>
                  </View>
                </View>
                <View className="flex-row items-center gap-1.5">
                  <Ionicons name="call" size={12} color="#6B7280" />
                  <Text className="text-gray-500 text-[13px]">{vendor.phone}</Text>
                </View>
              </View>

              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
