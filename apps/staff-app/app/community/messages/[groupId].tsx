import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
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
    queryFn: () => api.get<Me>('/staff/profile').catch(() => ({ id: 'self' }) as Me),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['msgs', groupId],
    queryFn: () =>
      api.get<Message[]>(`/staff/community/messages/${groupId}`).catch((e) => {
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
    // The server emits event 'staff:msg' to this group's room; the socket is
    // already in every group the guard belongs to, so filter by group here.
    const unsub = subscribe('staff:msg', (data) => {
      const incoming = data as Message & { groupId?: string };
      if (incoming?.groupId !== groupId) return;
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
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={7}
            inverted
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
            ItemSeparatorComponent={() => <View className="h-2" />}
            renderItem={({ item }) => {
              const mine = item.senderId === me?.id;
              return (
                <View className={`max-w-[80%] ${mine ? 'self-end' : 'self-start'}`}>
                  {!mine && item.senderName && (
                    <Text className="mb-0.5 ml-2 text-[10px] text-gray-500">{item.senderName}</Text>
                  )}
                  <View
                    className={`rounded-2xl px-4 py-2.5 ${
                      mine ? 'bg-primary-500' : 'border border-gray-100 bg-white'
                    } ${item.pending ? 'opacity-60' : ''}`}
                  >
                    <Text className={`text-sm ${mine ? 'text-white' : 'text-gray-900'}`}>
                      {item.body}
                    </Text>
                    <Text
                      className={`mt-1 text-[10px] ${mine ? 'text-white/70' : 'text-gray-400'}`}
                    >
                      {new Date(item.createdAt).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {item.pending ? ' · sending…' : ''}
                    </Text>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <View className="items-center py-16">
                <Text className="mb-2 text-4xl">💬</Text>
                <Text className="text-sm text-gray-400">Say hello to your team</Text>
              </View>
            }
          />
        )}

        {/* Composer */}
        <View className="flex-row items-center border-t border-gray-100 bg-white px-3 py-2">
          <TextInput
            className="mr-2 flex-1 rounded-2xl bg-gray-50 px-4 py-2.5 text-sm text-gray-900"
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
            <Text
              className={`font-semibold text-sm ${text.trim() ? 'text-white' : 'text-gray-400'}`}
            >
              Send
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
