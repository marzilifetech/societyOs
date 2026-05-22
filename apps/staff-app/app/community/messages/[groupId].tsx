import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView,
  Platform, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../src/lib/api';
import { subscribe } from '../../../src/lib/socket';

type Message = {
  id: string;
  body: string;
  senderId: string;
  senderName?: string;
  createdAt: string;
  pending?: boolean;
};

type Me = { id: string };

export default function GroupChatScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [optimistic, setOptimistic] = useState<Message[]>([]);
  const tempIdRef = useRef(0);

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<Me>('/staff/profile').catch(() => ({ id: 'self' } as Me)),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['msgs', groupId],
    queryFn: () =>
      api
        .get<Message[]>(`/staff/community/messages/${groupId}`)
        .catch((e) => {
          console.warn('[msgs] fetch failed', e?.message);
          return [] as Message[];
        }),
    enabled: !!groupId,
  });

  const sendMutation = useMutation({
    mutationFn: ({ body }: { body: string; tempId: string }) =>
      api.post<Message>(`/staff/community/messages/${groupId}`, { body }),
    onSuccess: (saved: Message, vars: { body: string; tempId: string }) => {
      setOptimistic((prev: Message[]) => prev.filter((m: Message) => m.id !== vars.tempId));
      qc.setQueryData<Message[]>(['msgs', groupId], (old: Message[] | undefined) => {
        const list = old ?? [];
        if (list.find((m: Message) => m.id === saved.id)) return list;
        return [saved, ...list];
      });
    },
    onError: (err: any, vars: { body: string; tempId: string }) => {
      setOptimistic((prev: Message[]) => prev.filter((m: Message) => m.id !== vars.tempId));
      console.warn('[send] failed', err?.message);
    },
  });

  // Live socket listener
  useEffect(() => {
    if (!groupId) return;
    const unsub = subscribe(`staff:msg:${groupId}`, (incoming: Message) => {
      qc.setQueryData<Message[]>(['msgs', groupId], (old: Message[] | undefined) => {
        const list = old ?? [];
        if (list.find((m: Message) => m.id === incoming.id)) return list;
        return [incoming, ...list];
      });
    });
    return unsub;
  }, [groupId, qc]);

  const handleSend = useCallback(() => {
    const body = text.trim();
    if (!body) return;
    const tempId = `tmp-${++tempIdRef.current}`;
    setOptimistic((prev: Message[]) => [
      {
        id: tempId,
        body,
        senderId: me?.id ?? 'self',
        senderName: 'You',
        createdAt: new Date().toISOString(),
        pending: true,
      } as Message,
      ...prev,
    ]);
    setText('');
    sendMutation.mutate({ body, tempId });
  }, [text, me, sendMutation]);

  // Combine: optimistic on top + server list (FlatList inverted means newest first)
  const list: Message[] = [...optimistic, ...((data ?? []) as Message[])];

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['bottom']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#821A52" />
          </View>
        ) : (
          <FlatList
            data={list}
            keyExtractor={(m) => m.id}
            inverted
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
            ItemSeparatorComponent={() => <View className="h-2" />}
            renderItem={({ item }) => {
              const mine = item.senderId === me?.id;
              return (
                <View className={`max-w-[80%] ${mine ? 'self-end' : 'self-start'}`}>
                  {!mine && item.senderName && (
                    <Text className="text-[10px] text-gray-500 ml-2 mb-0.5">{item.senderName}</Text>
                  )}
                  <View
                    className={`rounded-2xl px-4 py-2.5 ${
                      mine ? 'bg-primary-500' : 'bg-white border border-gray-100'
                    } ${item.pending ? 'opacity-60' : ''}`}
                  >
                    <Text className={`text-sm ${mine ? 'text-white' : 'text-gray-900'}`}>{item.body}</Text>
                    <Text className={`text-[10px] mt-1 ${mine ? 'text-white/70' : 'text-gray-400'}`}>
                      {new Date(item.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      {item.pending ? ' · sending…' : ''}
                    </Text>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <View className="items-center py-16">
                <Text className="text-4xl mb-2">💬</Text>
                <Text className="text-gray-400 text-sm">Say hello to your team</Text>
              </View>
            }
          />
        )}

        {/* Composer */}
        <View className="flex-row items-center bg-white border-t border-gray-100 px-3 py-2">
          <TextInput
            className="flex-1 bg-gray-50 rounded-2xl px-4 py-2.5 text-sm text-gray-900 mr-2"
            placeholder="Type a message…"
            placeholderTextColor="#9CA3AF"
            value={text}
            onChangeText={setText}
            multiline
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!text.trim()}
            className={`rounded-full px-4 py-2.5 ${text.trim() ? 'bg-primary-500' : 'bg-gray-200'}`}
          >
            <Text className={`text-sm font-semibold ${text.trim() ? 'text-white' : 'text-gray-400'}`}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
