import { ScrollView, View, Text, TouchableOpacity, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';

type Resolution = {
  id: string;
  title: string;
  description: string;
  votingDeadline: string;
  myVote?: string;
  forCount?: number;
  againstCount?: number;
  abstainCount?: number;
};

type Meeting = {
  id: string;
  title: string;
  date: string;
  status: string;
  resolutions: Resolution[];
};

type IoniconName = keyof typeof Ionicons.glyphMap;

const VOTE_OPTIONS: {
  value: string;
  label: string;
  icon: IoniconName;
  bgClass: string;
  textClass: string;
  borderClass: string;
}[] = [
  { value: 'FOR', label: 'For', icon: 'checkmark-circle', bgClass: 'bg-green-100', textClass: 'text-green-700', borderClass: 'border-green-700' },
  { value: 'AGAINST', label: 'Against', icon: 'close-circle', bgClass: 'bg-red-100', textClass: 'text-red-700', borderClass: 'border-red-700' },
  { value: 'ABSTAIN', label: 'Abstain', icon: 'remove-circle', bgClass: 'bg-amber-100', textClass: 'text-amber-700', borderClass: 'border-amber-700' },
];

export default function AGMMeetingScreen() {
  const { meetingId } = useLocalSearchParams<{ meetingId: string }>();
  const qc = useQueryClient();

  const { data: meetings, isLoading, isError, refetch } = useQuery<Meeting[]>({
    queryKey: ['agm-meetings'],
    queryFn: () => api.get<Meeting[]>('/agm/meetings'),
  });

  const meeting = meetings?.find((m: any) => m.id === meetingId);

  const voteMutation = useMutation({
    mutationFn: ({ resolutionId, vote }: { resolutionId: string; vote: string }) =>
      api.post(`/agm/resolutions/${resolutionId}/vote`, { vote }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agm-meetings'] }),
    onError: () => Alert.alert('Error', 'Could not submit vote. Please try again.'),
  });

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <Text className="text-gray-500 text-base">Loading…</Text>
      </SafeAreaView>
    );
  }

  if (isError || !meeting) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center px-6">
        <Text className="text-gray-700 text-base mb-4">Could not load meeting</Text>
        <TouchableOpacity onPress={() => refetch()} className="bg-primary-500 rounded-2xl px-6 py-3">
          <Text className="text-white font-semibold">Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="min-h-[52px] justify-center mr-3 flex-row items-center">
          <Ionicons name="chevron-back" size={20} color="#821A52" />
          <Text className="text-primary-500 text-base ml-1">Back</Text>
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-gray-900 text-xl font-bold" numberOfLines={1}>{meeting.title}</Text>
          <Text className="text-gray-500 text-xs mt-0.5">
            {new Date(meeting.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
          </Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 48 }}>
        {meeting.resolutions.length === 0 && (
          <View className="bg-gray-50 rounded-2xl border border-gray-200 p-8 items-center mt-5">
            <View className="w-16 h-16 rounded-2xl bg-primary-50 items-center justify-center mb-4">
              <Ionicons name="people" size={32} color="#821A52" />
            </View>
            <Text className="text-gray-700 text-base">No resolutions for this meeting</Text>
          </View>
        )}

        {meeting.resolutions.map((resolution: any, idx: any) => {
          const deadline = new Date(resolution.votingDeadline);
          const isOpen = !resolution.myVote && deadline > new Date();
          const isPast = deadline <= new Date();
          const total = (resolution.forCount ?? 0) + (resolution.againstCount ?? 0) + (resolution.abstainCount ?? 0);

          return (
            <View key={resolution.id} className="bg-gray-50 rounded-2xl border border-gray-200 p-4 mb-4">
              <Text className="text-gray-400 text-xs font-semibold mb-1.5">RESOLUTION {idx + 1}</Text>
              <Text className="text-gray-900 text-base font-bold mb-2">{resolution.title}</Text>
              <Text className="text-gray-600 text-sm leading-5 mb-3">{resolution.description}</Text>

              <Text className="text-gray-400 text-xs mb-3">
                Voting deadline: {deadline.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </Text>

              {resolution.myVote && (
                <View className="mb-3 flex-row items-center">
                  <Ionicons name="checkmark-circle" size={16} color="#15803D" />
                  <Text className="text-gray-500 text-sm ml-1.5">
                    Your vote: <Text className="text-gray-900 font-bold">{resolution.myVote}</Text>
                  </Text>
                </View>
              )}

              {isOpen && (
                <View className="flex-row" style={{ gap: 8 }}>
                  {VOTE_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => voteMutation.mutate({ resolutionId: resolution.id, vote: opt.value })}
                      disabled={voteMutation.isPending}
                      className={`flex-1 rounded-xl py-2.5 items-center min-h-[52px] justify-center border ${opt.bgClass} ${opt.borderClass}`}
                    >
                      <Ionicons name={opt.icon} size={18} color={opt.value === 'FOR' ? '#15803D' : opt.value === 'AGAINST' ? '#B91C1C' : '#B45309'} />
                      <Text className={`font-bold text-xs mt-0.5 ${opt.textClass}`}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {isPast && !resolution.myVote && (
                <Text className="text-gray-400 text-sm italic">Voting period has ended</Text>
              )}

              {total > 0 && (
                <View className="mt-3 border-t border-gray-200 pt-3">
                  <Text className="text-gray-400 text-xs mb-2">RESULTS ({total} votes)</Text>
                  <View className="flex-row" style={{ gap: 12 }}>
                    <Text className="text-green-700 text-sm font-semibold">For: {resolution.forCount ?? 0}</Text>
                    <Text className="text-red-700 text-sm font-semibold">Against: {resolution.againstCount ?? 0}</Text>
                    <Text className="text-amber-700 text-sm font-semibold">Abstain: {resolution.abstainCount ?? 0}</Text>
                  </View>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
