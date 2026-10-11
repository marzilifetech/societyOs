import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { colors } from '@societyos/theme';
import { flatLabel } from '@societyos/api-client';
import { AppHeader, Card, EmptyState } from '../../src/components/ui';
import { ErrorCard } from '../../src/components/ErrorCard';
import {
  HOUSEKEEPING_KEY,
  fetchMyHousekeeping,
  housekeepingTypeLabel,
} from '../../src/lib/housekeeping';

/** Housekeeping jobs an admin assigned to me. The completion screen had no way in. */
export default function HousekeepingJobsScreen() {
  const { data = [], isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: HOUSEKEEPING_KEY,
    queryFn: fetchMyHousekeeping,
  });
  const open = data.filter((j) => j.status !== 'COMPLETED' && j.status !== 'CANCELLED');

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <AppHeader title="Housekeeping jobs" />
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary[500]} />
        </View>
      ) : isError ? (
        <ErrorCard
          message="Jobs couldn't be loaded."
          detail={error instanceof Error ? error.message : undefined}
          onRetry={() => void refetch()}
        />
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="p-5 gap-3"
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />}
        >
          {open.length === 0 ? (
            <Card padding="none">
              <EmptyState icon="sparkles-outline" title="No housekeeping jobs assigned" />
            </Card>
          ) : (
            open.map((job) => {
              const flat = flatLabel(job.resident?.flat) ?? job.resident?.unit?.flatNumber;
              return (
                <TouchableOpacity
                  key={job.id}
                  onPress={() => router.push(`/housekeeping/${job.id}/complete` as never)}
                  accessibilityRole="button"
                >
                  <Card>
                    <Text className="text-base font-semibold text-gray-900 dark:text-gray-100">
                      {housekeepingTypeLabel(job.type)}
                    </Text>
                    <Text className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {job.resident?.user?.name ?? job.resident?.name ?? 'Resident'}
                      {flat ? ` · Flat ${flat}` : ''}
                    </Text>
                    <Text className="mt-0.5 text-xs text-gray-400">
                      {new Date(job.scheduledAt).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </Card>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
