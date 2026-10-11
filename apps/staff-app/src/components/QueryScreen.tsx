import type { ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import type { UseQueryResult } from '@tanstack/react-query';
import { colors } from '@societyos/theme';
import { AppHeader } from './ui/AppHeader';
import { ErrorCard } from './ErrorCard';

/**
 * A detail screen's three states — loading, failed, loaded — in one place.
 *
 * Eight screens guarded with `if (isLoading || !data) return <Spinner />`.
 * When the request FAILED, `data` stayed undefined and the spinner ran
 * forever: no message, no retry, only the back button. This renders the
 * error with its reason and a retry instead.
 */
export function QueryScreen<T>({
  query,
  title,
  children,
}: {
  query: Pick<UseQueryResult<T>, 'data' | 'isError' | 'error' | 'refetch' | 'isRefetching'>;
  title: string;
  children: (data: T) => ReactNode;
}) {
  if (query.data !== undefined && query.data !== null) return <>{children(query.data)}</>;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-gray-50 dark:bg-gray-950">
      <Stack.Screen options={{ headerShown: false }} />
      <AppHeader title={title} />
      {query.isError ? (
        <ErrorCard
          message="This couldn't be loaded."
          detail={query.error instanceof Error ? query.error.message : undefined}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary[500]} />
        </View>
      )}
    </SafeAreaView>
  );
}
