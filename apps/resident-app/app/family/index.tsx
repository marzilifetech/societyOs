import { ScrollView, View, Text, TouchableOpacity, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';

type FamilyMember = {
  id: string;
  name: string;
  relationship: string;
  phone?: string;
  dateOfBirth?: string;
  bloodGroup?: string;
  isEmergencyContact: boolean;
};

export default function FamilyScreen() {
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery<FamilyMember[]>({
    queryKey: ['family-members'],
    queryFn: () => api.get<FamilyMember[]>('/family-members'),
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-2 flex-row items-center">
        <TouchableOpacity
          onPress={() => router.back()}
          className="mr-3 w-10 h-10 items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={24} color="#821A52" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-gray-900 text-2xl font-bold">Family Members</Text>
          <Text className="text-gray-500 text-sm mt-0.5">Registered under your account</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/family/add' as any)}
          className="bg-primary-500 rounded-2xl px-3.5 py-2.5 flex-row items-center"
          style={{ gap: 6 }}
          accessibilityRole="button"
          accessibilityLabel="Add family member"
        >
          <Ionicons name="person-add" size={16} color="#fff" />
          <Text className="text-white font-bold text-sm">Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#821A52" />}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 48 }}
      >
        {isLoading && [1, 2, 3].map((i: any) => (
          <View key={i} className="bg-gray-50 border border-gray-200 rounded-2xl mb-3" style={{ height: 80 }} />
        ))}

        {isError && (
          <View className="bg-gray-50 border border-gray-200 rounded-2xl p-6 items-center">
            <Text className="text-gray-700 text-base mb-3">Could not load family members</Text>
            <TouchableOpacity
              onPress={() => refetch()}
              className="bg-primary-500 rounded-2xl px-6 py-3"
              accessibilityRole="button"
              accessibilityLabel="Retry"
            >
              <Text className="text-white font-semibold text-base">Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {!isLoading && !isError && data?.length === 0 && (
          <View className="bg-gray-50 border border-gray-200 rounded-2xl p-8 items-center mt-10">
            <View className="w-20 h-20 rounded-full bg-primary-50 items-center justify-center mb-4">
              <Ionicons name="people" size={36} color="#821A52" />
            </View>
            <Text className="text-gray-900 text-lg font-semibold">No family members added</Text>
            <Text className="text-gray-500 text-sm text-center mt-2">Tap Add to register family members</Text>
          </View>
        )}

        {data?.map((member: any) => (
          <View
            key={member.id}
            className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-2.5 flex-row items-center"
          >
            <View className="w-12 h-12 rounded-full bg-primary-50 items-center justify-center mr-3.5">
              <Ionicons name="person" size={22} color="#821A52" />
            </View>
            <View className="flex-1">
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <Text className="text-gray-900 text-base font-bold">{member.name}</Text>
                {member.isEmergencyContact && (
                  <View className="bg-red-100 rounded-lg px-2 py-0.5">
                    <Text className="text-red-700 text-[11px] font-bold">SOS</Text>
                  </View>
                )}
              </View>
              <View className="flex-row items-center mt-1" style={{ gap: 6 }}>
                <View className="bg-primary-50 rounded-md px-2 py-0.5">
                  <Text className="text-primary-700 text-[11px] font-semibold">{member.relationship}</Text>
                </View>
              </View>
              {member.phone && (
                <View className="flex-row items-center mt-1.5" style={{ gap: 4 }}>
                  <Ionicons name="call" size={12} color="#6B7280" />
                  <Text className="text-gray-500 text-xs">{member.phone}</Text>
                </View>
              )}
            </View>
            {member.bloodGroup && (
              <View className="bg-red-50 border border-red-200 rounded-lg px-2.5 py-1">
                <Text className="text-red-600 font-bold text-xs">{member.bloodGroup}</Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
