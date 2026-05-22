import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  FlatList,
} from 'react-native';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { api } from '../../../src/lib/api';

const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  PENDING:     { label: 'Pending',     bg: 'bg-blue-900',   color: 'text-blue-300' },
  ASSIGNED:    { label: 'Assigned',    bg: 'bg-purple-900', color: 'text-purple-300' },
  IN_PROGRESS: { label: 'In Progress', bg: 'bg-amber-900',  color: 'text-amber-300' },
  COMPLETED:   { label: 'Completed',   bg: 'bg-green-900',  color: 'text-green-300' },
  REJECTED:    { label: 'Rejected',    bg: 'bg-red-900',    color: 'text-red-300' },
  DISPUTED:    { label: 'Disputed',    bg: 'bg-red-900',    color: 'text-red-300' },
};

const TIMELINE = ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED'];

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const [viewerUri, setViewerUri] = useState<string | null>(null);

  const { data: task, isLoading } = useQuery({
    queryKey: ['task', id],
    queryFn: () => api.get<any>(`/service-requests/${id}`),
    enabled: !!id,
  });

  const accept = useMutation({
    mutationFn: () => api.patch(`/service-requests/${id}/status`, { status: 'IN_PROGRESS' }),
    onSuccess: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      qc.invalidateQueries({ queryKey: ['task', id] });
      qc.invalidateQueries({ queryKey: ['my-tasks'] });
    },
    onError: (e: any) => Alert.alert('Error', e.message),
  });

  if (isLoading || !task) {
    return (
      <SafeAreaView className="flex-1 bg-gray-950 items-center justify-center">
        <Stack.Screen options={{ title: 'Task' }} />
        <ActivityIndicator color="#fff" />
      </SafeAreaView>
    );
  }

  const meta = STATUS_META[task.status] ?? STATUS_META.PENDING;
  const photos: any[] = task.photos ?? [];
  const isPending = task.status === 'PENDING' || task.status === 'ASSIGNED';
  const isInProgress = task.status === 'IN_PROGRESS';
  const isDisputed = task.status === 'DISPUTED' || (task.status === 'IN_PROGRESS' && task.disputeReason);
  const timelineStep = TIMELINE.indexOf(task.status);

  return (
    <SafeAreaView className="flex-1 bg-gray-950">
      <Stack.Screen options={{ headerShown: false }} />
      <View className="bg-gray-900 px-5 py-4 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center">
          <Text className="text-white text-2xl">‹</Text>
        </TouchableOpacity>
        <View className="flex-1 ml-2">
          <Text className="text-white text-lg font-bold">{task.category}</Text>
        </View>
        <View className={`rounded-full px-3 py-1 ${meta.bg}`}>
          <Text className={`text-xs font-semibold ${meta.color}`}>{meta.label}</Text>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="p-5 gap-4 pb-32">
        {/* Resident */}
        {task.unit && (
          <View className="bg-gray-900 rounded-2xl p-5">
            <Text className="text-xs text-gray-400 uppercase tracking-wider mb-2">Resident</Text>
            <Text className="text-white text-base font-semibold">
              {task.requestedBy?.name ?? task.unit?.owner?.name ?? 'Resident'}
            </Text>
            <Text className="text-gray-400 text-sm mt-0.5">Flat {task.unit.flatNumber}</Text>
            {task.unit.floor && (
              <Text className="text-gray-500 text-xs mt-0.5">Floor {task.unit.floor}</Text>
            )}
          </View>
        )}

        {/* Scheduled arrival */}
        {task.scheduledTime && (
          <View className="bg-[#821A52]/20 border border-[#821A52]/40 rounded-2xl p-5">
            <Text className="text-xs text-[#821A52] uppercase tracking-wider mb-1">Scheduled Arrival</Text>
            <Text className="text-white text-lg font-bold">
              {new Date(task.scheduledTime).toLocaleString('en-IN', {
                weekday: 'short', day: 'numeric', month: 'short',
                hour: '2-digit', minute: '2-digit',
              })}
            </Text>
          </View>
        )}

        {/* Dispute alert */}
        {task.disputeReason && (
          <View className="bg-red-900/30 border border-red-700/50 rounded-2xl p-5">
            <Text className="text-xs text-red-400 uppercase tracking-wider mb-1">Resident Dispute</Text>
            <Text className="text-red-200 text-sm">{task.disputeReason}</Text>
          </View>
        )}

        {/* Description */}
        <View className="bg-gray-900 rounded-2xl p-5">
          <Text className="text-xs text-gray-400 uppercase tracking-wider mb-2">Description</Text>
          <Text className="text-gray-100 text-sm leading-5">{task.description}</Text>
        </View>

        {/* Timeline */}
        <View className="bg-gray-900 rounded-2xl p-5">
          <Text className="text-xs text-gray-400 uppercase tracking-wider mb-4">Timeline</Text>
          <View className="flex-row items-center justify-between">
            {TIMELINE.map((step, idx) => (
              <View key={step} className="flex-1 items-center">
                <View
                  className={`w-8 h-8 rounded-full items-center justify-center ${
                    idx <= timelineStep ? 'bg-green-600' : 'bg-gray-800'
                  }`}
                >
                  <Text className="text-white text-xs font-bold">{idx + 1}</Text>
                </View>
                <Text className="text-gray-500 text-[9px] mt-1 text-center">
                  {step.replace('_', ' ')}
                </Text>
                {idx < TIMELINE.length - 1 && (
                  <View
                    className={`absolute top-4 left-1/2 h-0.5 w-full ${
                      idx < timelineStep ? 'bg-green-600' : 'bg-gray-700'
                    }`}
                    style={{ zIndex: -1 }}
                  />
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Photos */}
        {photos.length > 0 && (
          <View className="bg-gray-900 rounded-2xl p-5">
            <Text className="text-xs text-gray-400 uppercase tracking-wider mb-3">Photos</Text>
            <FlatList
              data={photos}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(p, i) => p.id ?? String(i)}
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => setViewerUri(item.url)} className="mr-2">
                  <Image
                    source={{ uri: item.url }}
                    style={{ width: 140, aspectRatio: 16 / 9, borderRadius: 8 }}
                    resizeMode="cover"
                  />
                  {item.phase && (
                    <View className="absolute top-1 left-1 bg-black/70 rounded-full px-2 py-0.5">
                      <Text className="text-[10px] text-white font-semibold">{item.phase}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* Notes history */}
        {task.notes?.length > 0 && (
          <View className="bg-gray-900 rounded-2xl p-5">
            <Text className="text-xs text-gray-400 uppercase tracking-wider mb-3">Notes</Text>
            <View className="gap-3">
              {(task.notes as any[]).map((n: any) => (
                <View key={n.id} className="bg-gray-800 rounded-xl p-3">
                  <Text className="text-gray-100 text-sm">{n.body}</Text>
                  <Text className="text-gray-500 text-[10px] mt-1">
                    {new Date(n.createdAt).toLocaleString('en-IN')}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Action bar */}
      <View className="absolute bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 px-5 py-4 gap-3">
        {isPending && (
          <TouchableOpacity
            onPress={() => router.push(`/tasks/${id}/start` as any)}
            className="bg-amber-500 rounded-2xl py-4 items-center"
            style={{ minHeight: 56 }}
          >
            <Text className="text-white font-bold text-base">Accept & Start</Text>
          </TouchableOpacity>
        )}
        {isInProgress && !task.disputeReason && (
          <TouchableOpacity
            onPress={() => router.push(`/tasks/${id}/complete` as any)}
            className="bg-green-600 rounded-2xl py-4 items-center"
            style={{ minHeight: 56 }}
          >
            <Text className="text-white font-bold text-base">Complete Work</Text>
          </TouchableOpacity>
        )}
        {(isDisputed || task.disputeReason) && (
          <TouchableOpacity
            onPress={() => router.push(`/tasks/${id}/dispute` as any)}
            className="bg-red-600 rounded-2xl py-4 items-center"
            style={{ minHeight: 56 }}
          >
            <Text className="text-white font-bold text-base">Respond to Dispute</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Full-screen photo viewer */}
      {viewerUri && (
        <TouchableOpacity
          onPress={() => setViewerUri(null)}
          className="absolute inset-0 bg-black/90 items-center justify-center"
        >
          <Image source={{ uri: viewerUri }} style={{ width: '100%', height: '70%' }} resizeMode="contain" />
          <Text className="text-gray-400 text-xs mt-4">Tap to close</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}
