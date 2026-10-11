import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, FlatList } from 'react-native';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader, Card, StatusChip } from '../../../src/components/ui';
import { QueryScreen } from '../../../src/components/QueryScreen';
import { TaskSummaryCard } from '../../../src/components/task/TaskSummaryCard';
import { useTask } from '../../../src/hooks/useTask';
import { TASK_STATUS_TONES, toneFor } from '../../../src/lib/status-theme';

const TIMELINE = ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED'];

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const query = useTask(id);

  return (
    <QueryScreen query={query} title="Task">
      {(task) => {
        const tone = toneFor(TASK_STATUS_TONES, task.status, 'PENDING');
        const photos = task.photos ?? [];
        const isPending = task.status === 'PENDING' || task.status === 'ASSIGNED';
        const isInProgress = task.status === 'IN_PROGRESS';
        const timelineStep = TIMELINE.indexOf(task.status);

        return (
          <SafeAreaView edges={['top']} className="flex-1 bg-gray-50 dark:bg-gray-950">
            <Stack.Screen options={{ headerShown: false }} />
            <AppHeader title={task.category} right={<StatusChip tone={tone} />} />

            <ScrollView className="flex-1" contentContainerClassName="p-5 gap-4 pb-32">
              <TaskSummaryCard task={task} />

              {/* Scheduled arrival */}
              {task.scheduledTime && (
                <View className="rounded-2xl border border-primary-100 bg-primary-50 p-5 dark:border-primary-800 dark:bg-primary-900/40">
                  <Text className="mb-1 text-xs uppercase tracking-wider text-primary-600 dark:text-primary-200">
                    Scheduled Arrival
                  </Text>
                  <Text className="font-heading text-lg text-gray-900 dark:text-gray-100">
                    {new Date(task.scheduledTime).toLocaleString('en-IN', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              )}

              {/* Dispute alert */}
              {task.disputeReason && (
                <View className="rounded-2xl border border-red-200 bg-red-50 p-5 dark:border-red-900 dark:bg-red-950/40">
                  <Text className="mb-1 text-xs uppercase tracking-wider text-red-600 dark:text-red-400">
                    Resident Dispute
                  </Text>
                  <Text className="text-sm text-red-700 dark:text-red-200">
                    {task.disputeReason}
                  </Text>
                </View>
              )}

              {/* Timeline */}
              <Card padding="lg">
                <Text className="mb-4 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Timeline
                </Text>
                <View className="flex-row items-center justify-between">
                  {TIMELINE.map((step, idx) => (
                    <View key={step} className="flex-1 items-center">
                      <View
                        className={`h-8 w-8 items-center justify-center rounded-full ${
                          idx <= timelineStep ? 'bg-green-600' : 'bg-gray-200 dark:bg-gray-800'
                        }`}
                      >
                        <Text
                          className={`font-bold text-xs ${
                            idx <= timelineStep ? 'text-white' : 'text-gray-500 dark:text-gray-400'
                          }`}
                        >
                          {idx + 1}
                        </Text>
                      </View>
                      <Text className="mt-1 text-center text-[9px] text-gray-500 dark:text-gray-400">
                        {step.replace('_', ' ')}
                      </Text>
                      {idx < TIMELINE.length - 1 && (
                        <View
                          className={`absolute left-1/2 top-4 h-0.5 w-full ${
                            idx < timelineStep ? 'bg-green-600' : 'bg-gray-200 dark:bg-gray-700'
                          }`}
                          style={{ zIndex: -1 }}
                        />
                      )}
                    </View>
                  ))}
                </View>
              </Card>

              {/* Photos */}
              {photos.length > 0 && (
                <Card padding="lg">
                  <Text className="mb-3 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Photos
                  </Text>
                  <FlatList
                    data={photos}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={(p) => p.id}
                    renderItem={({ item }) => (
                      <TouchableOpacity onPress={() => setViewerUri(item.url)} className="mr-2">
                        <Image
                          source={{ uri: item.url }}
                          style={{ width: 140, aspectRatio: 16 / 9, borderRadius: 8 }}
                          resizeMode="cover"
                        />
                        {item.phase && (
                          <View className="absolute left-1 top-1 rounded-full bg-black/70 px-2 py-0.5">
                            <Text className="font-semibold text-[10px] text-white">
                              {item.phase}
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    )}
                  />
                </Card>
              )}

              {/* Notes history */}
              {task.notes?.length ? (
                <Card padding="lg">
                  <Text className="mb-3 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Notes
                  </Text>
                  <View className="gap-3">
                    {task.notes.map((n) => (
                      <View key={n.id} className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800">
                        <Text className="text-sm text-gray-800 dark:text-gray-100">{n.body}</Text>
                        <Text className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">
                          {new Date(n.createdAt).toLocaleString('en-IN')}
                        </Text>
                      </View>
                    ))}
                  </View>
                </Card>
              ) : null}
            </ScrollView>

            {/* Action bar */}
            <View className="absolute bottom-0 left-0 right-0 gap-3 border-t border-gray-200 bg-white px-5 py-4 dark:border-gray-800 dark:bg-gray-900">
              {isPending && (
                <TouchableOpacity
                  onPress={() => router.push(`/tasks/${id}/start` as any)}
                  className="items-center rounded-full bg-amber-500 py-4"
                  style={{ minHeight: 56 }}
                >
                  <Text className="font-bold text-base text-white">Accept & Start</Text>
                </TouchableOpacity>
              )}
              {isInProgress && !task.disputeReason && (
                <TouchableOpacity
                  onPress={() => router.push(`/tasks/${id}/complete` as any)}
                  className="items-center rounded-full bg-green-600 py-4"
                  style={{ minHeight: 56 }}
                >
                  <Text className="font-bold text-base text-white">Complete Work</Text>
                </TouchableOpacity>
              )}
              {task.disputeReason ? (
                <TouchableOpacity
                  onPress={() => router.push(`/tasks/${id}/dispute` as any)}
                  className="items-center rounded-full bg-red-600 py-4"
                  style={{ minHeight: 56 }}
                >
                  <Text className="font-bold text-base text-white">Respond to Dispute</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Full-screen photo viewer */}
            {viewerUri && (
              <TouchableOpacity
                onPress={() => setViewerUri(null)}
                className="absolute inset-0 items-center justify-center bg-black/90"
              >
                <Image
                  source={{ uri: viewerUri }}
                  style={{ width: '100%', height: '70%' }}
                  resizeMode="contain"
                />
                <Text className="mt-4 text-xs text-gray-400">Tap to close</Text>
              </TouchableOpacity>
            )}
          </SafeAreaView>
        );
      }}
    </QueryScreen>
  );
}
