import { View, Text, FlatList, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';

type Tab = 'notices' | 'polls';

export default function NoticesScreen() {
  const [tab, setTab] = useState<Tab>('notices');

  const { data: notices, isLoading: noticesLoading } = useQuery({
    queryKey: ['notices'],
    queryFn: () => api.get<any[]>('/notices'),
    enabled: tab === 'notices',
  });

  const { data: polls, isLoading: pollsLoading } = useQuery({
    queryKey: ['polls'],
    queryFn: () => api.get<any[]>('/notices/polls'),
    enabled: tab === 'polls',
  });

  const isLoading = tab === 'notices' ? noticesLoading : pollsLoading;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-3">
        <Text className="text-2xl font-bold text-gray-900 mb-4">Updates</Text>

        <View className="flex-row bg-gray-100 rounded-2xl p-1">
          {(['notices', 'polls'] as Tab[]).map((tabItem) => (
            <TouchableOpacity
              key={tabItem}
              className={`flex-1 py-2 rounded-xl items-center ${tab === tabItem ? 'bg-primary-500' : 'bg-transparent'}`}
              onPress={() => setTab(tabItem)}
              accessibilityRole="button"
              accessibilityLabel={tabItem === 'notices' ? 'View notices' : 'View polls'}
            >
              <Text className={`font-semibold text-sm ${tab === tabItem ? 'text-white' : 'text-gray-500'}`}>
                {tabItem === 'notices' ? 'Notices' : 'Polls'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator color="#821A52" style={{ marginTop: 40 }} />
      ) : tab === 'notices' ? (
        <FlatList
          data={notices}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const dateStr = item.publishedAt ? new Date(item.publishedAt).toLocaleDateString('en-IN') : '';
            return (
              <TouchableOpacity
                onPress={() => router.push(('/notices/' + item.id) as any)}
                className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 mb-3"
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`${item.title} notice from ${dateStr}`}
              >
                {item.isPinned && (
                  <View className="flex-row items-center mb-2 gap-1">
                    <Ionicons name="bookmark" size={12} color="#821A52" />
                    <Text className="text-primary-500 font-semibold text-xs">PINNED</Text>
                  </View>
                )}
                <View className="flex-row items-start gap-3">
                  <View className="w-10 h-10 rounded-xl bg-primary-50 items-center justify-center">
                    <Ionicons name="megaphone" size={20} color="#821A52" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-gray-900 font-semibold mb-1 text-base">{item.title}</Text>
                    <Text className="text-gray-500 text-sm leading-5">{item.body}</Text>
                    <Text className="mt-2 text-xs text-gray-400">{dateStr}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View className="items-center mt-16">
              <View className="w-16 h-16 rounded-2xl bg-primary-50 items-center justify-center mb-4">
                <Ionicons name="megaphone" size={32} color="#821A52" />
              </View>
              <Text className="text-gray-500 text-base">No notices yet</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={polls}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => <PollCard poll={item} />}
          ListEmptyComponent={
            <View className="items-center mt-16">
              <View className="w-16 h-16 rounded-2xl bg-primary-50 items-center justify-center mb-4">
                <Ionicons name="stats-chart" size={32} color="#821A52" />
              </View>
              <Text className="text-gray-500 text-base">No active polls</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function PollCard({ poll }: { poll: any }) {
  const qc = useQueryClient();
  const options: string[] = poll.options ?? [];
  const deadline = new Date(poll.deadline);
  const isExpired = deadline < new Date();
  const [selected, setSelected] = useState<number | null>(null);
  const [voted, setVoted] = useState(false);

  const voteMutation = useMutation({
    mutationFn: (optionIndex: number) =>
      api.post(`/notices/polls/${poll.id}/vote`, { options: [optionIndex] }),
    onSuccess: () => {
      setVoted(true);
      qc.invalidateQueries({ queryKey: ['polls'] });
    },
    onError: (err: any) => Alert.alert('Error', err.message ?? 'Failed to submit vote'),
  });

  const handleVote = () => {
    if (selected === null) return;
    voteMutation.mutate(selected);
  };

  const isDisabled = isExpired || voted || voteMutation.isPending;

  return (
    <View className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 mb-3">
      <View className="flex-row items-start gap-3 mb-3">
        <View className="w-10 h-10 rounded-xl bg-primary-50 items-center justify-center">
          <Ionicons
            name={voted ? 'checkmark-done-circle' : 'stats-chart'}
            size={20}
            color={voted ? '#22C55E' : '#821A52'}
          />
        </View>
        <Text className="text-gray-900 font-semibold flex-1 text-base">{poll.question}</Text>
      </View>
      {options.map((option, i) => (
        <TouchableOpacity
          key={i}
          className={`border rounded-xl px-3 mb-2 min-h-[44px] justify-center ${
            selected === i ? 'border-primary-500 bg-primary-50' : 'border-gray-200 bg-white'
          }`}
          disabled={isDisabled}
          onPress={() => !isDisabled && setSelected(i)}
          accessibilityRole="button"
          accessibilityLabel={`Select option: ${option}`}
        >
          <Text
            className={`text-sm ${selected === i ? 'text-primary-500 font-semibold' : 'text-gray-500'}`}
          >
            {option}
          </Text>
        </TouchableOpacity>
      ))}
      {!isExpired && !voted && (
        <TouchableOpacity
          className={`mt-1 rounded-xl items-center justify-center min-h-[44px] ${
            selected !== null && !voteMutation.isPending ? 'bg-primary-500' : 'bg-gray-100'
          }`}
          disabled={selected === null || voteMutation.isPending}
          onPress={handleVote}
          accessibilityRole="button"
          accessibilityLabel="Submit vote"
        >
          <Text
            className={`font-semibold text-sm ${
              selected !== null && !voteMutation.isPending ? 'text-white' : 'text-gray-400'
            }`}
          >
            {voteMutation.isPending ? 'Submitting…' : 'Submit Vote'}
          </Text>
        </TouchableOpacity>
      )}
      {voted && (
        <View className="flex-row items-center justify-center mt-2 gap-1">
          <Ionicons name="checkmark-circle" size={14} color="#22C55E" />
          <Text className="text-green-600 font-medium text-xs">Vote submitted</Text>
        </View>
      )}
      <Text className="mt-2 text-xs text-gray-400">
        {isExpired ? 'Closed' : `Closes ${deadline.toLocaleDateString('en-IN')}`}
      </Text>
    </View>
  );
}
