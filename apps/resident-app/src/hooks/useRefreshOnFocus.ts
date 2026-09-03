import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

/**
 * Refetch a query whenever the screen comes back into focus.
 *
 * The query client is configured with `refetchOnWindowFocus: false` and a
 * two-minute `staleTime`, which is right for a mobile app — but it means a list
 * screen shows whatever it cached the first time. A resident who opened Service
 * History, went away while staff progressed the job, and came back saw the old
 * status with no way to force a refresh: the "under past requests, updates are
 * not processed" report.
 *
 * Skips the first focus, because the query has just fetched on mount.
 */
export function useRefreshOnFocus(refetch: () => unknown) {
  const [firstFocus, setFirstFocus] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (firstFocus) {
        setFirstFocus(false);
        return;
      }
      refetch();
      // `refetch` from React Query is stable; `firstFocus` gates the initial run.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [firstFocus]),
  );
}

/**
 * Pull-to-refresh state paired with a query's `refetch`.
 *
 * Returns `{ refreshing, onRefresh }` for a `<RefreshControl>`.
 */
export function usePullToRefresh(refetch: () => Promise<unknown> | unknown) {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);
  return { refreshing, onRefresh };
}
