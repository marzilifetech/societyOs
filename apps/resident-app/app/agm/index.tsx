import { ScrollView, View, Text, TouchableOpacity, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';

type Resolution = {
  id: string;
  title: string;
  description: string;
  votingDeadline: string;
  myVote?: string;
};

type Meeting = {
  id: string;
  title: string;
  date: string;
  status: string;
  resolutions: Resolution[];
};

const MEETING_STATUS_META: Record<string, { badgeClass: string; label: string }> = {
  UPCOMING: { badgeClass: 'bg-primary-50 text-primary-500', label: 'Upcoming' },
  ONGOING: { badgeClass: 'bg-green-100 text-green-700', label: 'Ongoing' },
  COMPLETED: { badgeClass: 'bg-gray-100 text-gray-500', label: 'Completed' },
};

export default function AgmScreen() {
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery<Meeting[]>({
    queryKey: ['agm-meetings'],
    queryFn: () => api.get<Meeting[]>('/agm/meetings'),
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="min-h-[52px] justify-center mr-3 flex-row items-center">
          <Ionicons name="chevron-back" size={20} color="#821A52" />
          <Text className="text-primary-500 text-base ml-1">Back</Text>
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-gray-900 text-3xl font-bold">AGM & Meetings</Text>
          <Text className="text-gray-500 text-sm mt-0.5">Society meetings and resolutions</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#821A52" />}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 48 }}
      >
        {isLoading && [1, 2].map((i: any) => (
          <View key={i} className="bg-gray-50 rounded-2xl mb-4" style={{ height: 160 }} />
        ))}

        {isError && (
          <View className="bg-gray-50 rounded-2xl border border-gray-200 p-6 items-center">
            <Text className="text-gray-700 text-base mb-3">Could not load meetings</Text>
            <TouchableOpacity onPress={() => refetch()} className="bg-primary-500 rounded-2xl px-6 py-3">
              <Text className="text-white font-semibold">Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {!isLoading && !isError && data?.length === 0 && (
          <View className="bg-gray-50 rounded-2xl border border-gray-200 p-8 items-center mt-10">
            <View className="w-16 h-16 rounded-2xl bg-primary-50 items-center justify-center mb-4">
              <Ionicons name="business" size={32} color="#821A52" />
            </View>
            <Text className="text-gray-900 text-lg font-semibold">No meetings scheduled</Text>
            <Text className="text-gray-500 text-sm text-center mt-2">Upcoming AGM meetings will appear here</Text>
          </View>
        )}

        {data?.map((meeting: any) => {
          const meta = MEETING_STATUS_META[meeting.status] ?? MEETING_STATUS_META.UPCOMING;
          const openResolutions = meeting.resolutions?.filter((r: any) => !r.myVote && new Date(r.votingDeadline) > new Date()) ?? [];
          const [bgClass, textClass] = meta.badgeClass.split(' ');
          return (
            <View key={meeting.id} className="bg-gray-50 rounded-2xl border border-gray-200 p-4 mb-4">
              <View className="flex-row justify-between items-start mb-2">
                <View className="flex-1 mr-2.5">
                  <Text className="text-gray-900 text-lg font-bold">{meeting.title}</Text>
                  <View className="flex-row items-center mt-1">
                    <Ionicons name="calendar-outline" size={14} color="#6B7280" />
                    <Text className="text-gray-500 text-sm ml-1.5">
                      {new Date(meeting.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
                    </Text>
                  </View>
                </View>
                <View className={`${bgClass} rounded-lg px-2.5 py-1`}>
                  <Text className={`${textClass} text-xs font-bold`}>{meta.label}</Text>
                </View>
              </View>

              {meeting.resolutions?.length > 0 && (
                <Text className="text-gray-500 text-sm mb-2.5">
                  {meeting.resolutions.length} resolution{meeting.resolutions.length !== 1 ? 's' : ''}
                  {openResolutions.length > 0 ? ` · ${openResolutions.length} awaiting your vote` : ''}
                </Text>
              )}

              <TouchableOpacity
                onPress={() => router.push(`/agm/${meeting.id}` as any)}
                className={`rounded-2xl py-3 items-center min-h-[52px] justify-center flex-row ${
                  openResolutions.length > 0 ? 'bg-primary-500' : 'bg-white border border-gray-200'
                }`}
              >
                <Text className={`font-bold text-base ${openResolutions.length > 0 ? 'text-white' : 'text-gray-700'}`}>
                  {openResolutions.length > 0 ? `Vote Now (${openResolutions.length})` : 'View Details'}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={openResolutions.length > 0 ? '#FFFFFF' : '#374151'}
                  style={{ marginLeft: 4 }}
                />
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
