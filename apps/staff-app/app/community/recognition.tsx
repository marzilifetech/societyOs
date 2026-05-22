import { useState, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Modal, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../src/lib/api';

type Recognition = {
  id: string;
  staffId: string;
  staffName?: string;
  staffPhotoUrl?: string;
  message: string;
  awardedById?: string;
  awardedByName?: string;
  createdAt: string;
};

type StaffOption = { id: string; name: string };

const TABS = ['All', 'You earned this'] as const;
type Tab = typeof TABS[number];

export default function RecognitionScreen() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('All');
  const [showSend, setShowSend] = useState(false);
  const [staffId, setStaffId] = useState('');
  const [message, setMessage] = useState('');

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<{ id: string }>('/staff/profile').catch(() => ({ id: '' })),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['recognition'],
    queryFn: () =>
      api
        .get<Recognition[]>('/staff/community/recognition')
        .catch((e) => {
          console.warn('[recognition] fetch failed', e?.message);
          return [] as Recognition[];
        }),
  });

  const { data: staffList } = useQuery({
    queryKey: ['staff-options'],
    queryFn: () =>
      api
        .get<StaffOption[]>('/staff/community/staff-list')
        .catch(() => [] as StaffOption[]),
    enabled: showSend,
  });

  const filtered = useMemo(() => {
    const list = data ?? [];
    if (tab === 'You earned this') return list.filter((r) => r.staffId === me?.id);
    return list;
  }, [data, tab, me?.id]);

  const sendMutation = useMutation({
    mutationFn: (payload: { staffId: string; message: string }) =>
      api.post('/staff/community/recognition', payload),
    onSuccess: () => {
      Alert.alert('Sent', 'Your kudos has been submitted for admin review.');
      setShowSend(false);
      setStaffId('');
      setMessage('');
      qc.invalidateQueries({ queryKey: ['recognition'] });
    },
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="px-6 pt-4 pb-3 bg-white">
        <View className="flex-row gap-2 mb-2">
          {TABS.map((t) => (
            <TouchableOpacity
              key={t}
              className={`px-3 py-1.5 rounded-full border ${
                tab === t ? 'bg-primary-500 border-primary-500' : 'bg-white border-gray-200'
              }`}
              onPress={() => setTab(t)}
            >
              <Text className={`text-xs font-medium ${tab === t ? 'text-white' : 'text-gray-600'}`}>{t}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            className="ml-auto bg-primary-500 rounded-full px-3 py-1.5"
            onPress={() => setShowSend(true)}
          >
            <Text className="text-white text-xs font-semibold">+ Send Kudos</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#821A52" />
        </View>
      ) : filtered.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-4xl mb-3">🏆</Text>
          <Text className="text-gray-400">No recognitions yet</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 16 }}
          ItemSeparatorComponent={() => <View className="h-3" />}
          renderItem={({ item }) => {
            const mine = item.staffId === me?.id;
            return (
              <View className={`rounded-2xl p-4 ${mine ? 'bg-amber-50 border border-amber-200' : 'bg-white'}`}>
                {mine && (
                  <View className="bg-amber-500 self-start rounded-full px-2 py-0.5 mb-2">
                    <Text className="text-[10px] text-white font-bold">⭐ You earned this!</Text>
                  </View>
                )}
                <View className="flex-row items-center mb-2">
                  <View className="bg-primary-50 w-10 h-10 rounded-full items-center justify-center mr-3">
                    <Text className="text-primary-600 font-bold">
                      {item.staffName?.[0]?.toUpperCase() ?? '?'}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-gray-900">{item.staffName ?? 'Staff member'}</Text>
                    <Text className="text-[10px] text-gray-400">
                      {new Date(item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      {item.awardedByName ? ` · by ${item.awardedByName}` : ''}
                    </Text>
                  </View>
                </View>
                <Text className="text-sm text-gray-700 leading-5">"{item.message}"</Text>
              </View>
            );
          }}
        />
      )}

      {/* Send Kudos modal */}
      <Modal visible={showSend} transparent animationType="slide" onRequestClose={() => setShowSend(false)}>
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-white rounded-t-3xl p-5">
            <Text className="text-base font-semibold text-gray-900 mb-1">Send Kudos</Text>
            <Text className="text-xs text-gray-500 mb-4">Admin will review before publishing</Text>

            <Text className="text-xs font-medium text-gray-600 mb-1">Staff member</Text>
            <View className="bg-gray-50 rounded-xl mb-3 max-h-40">
              <FlatList
                data={staffList ?? []}
                keyExtractor={(s) => s.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    className={`px-4 py-2.5 ${staffId === item.id ? 'bg-primary-50' : ''}`}
                    onPress={() => setStaffId(item.id)}
                  >
                    <Text className={`text-sm ${staffId === item.id ? 'text-primary-600 font-semibold' : 'text-gray-700'}`}>
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View className="px-4 py-3">
                    <Text className="text-xs text-gray-400">No staff list available</Text>
                  </View>
                }
              />
            </View>

            <Text className="text-xs font-medium text-gray-600 mb-1">Message</Text>
            <TextInput
              className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm text-gray-900 min-h-[80px] mb-4"
              placeholder="What did they do great?"
              placeholderTextColor="#9CA3AF"
              value={message}
              onChangeText={setMessage}
              multiline
              textAlignVertical="top"
            />

            <View className="flex-row gap-2">
              <TouchableOpacity
                className="flex-1 bg-gray-100 rounded-xl py-3 items-center"
                onPress={() => setShowSend(false)}
              >
                <Text className="text-sm font-semibold text-gray-700">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`flex-1 rounded-xl py-3 items-center ${staffId && message.trim().length >= 5 ? 'bg-primary-500' : 'bg-gray-200'}`}
                disabled={!staffId || message.trim().length < 5 || sendMutation.isPending}
                onPress={() => sendMutation.mutate({ staffId, message: message.trim() })}
              >
                {sendMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className={`text-sm font-semibold ${staffId && message.trim().length >= 5 ? 'text-white' : 'text-gray-400'}`}>
                    Send
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
