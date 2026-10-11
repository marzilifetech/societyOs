import { AppState, type AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, focusManager, onlineManager } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { APP_VERSION_LABEL } from './app-version';

const PERSIST_MAX_AGE_MS = 1000 * 60 * 60 * 24;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      // Persisted queries must outlive maxAge in memory too, or they are
      // garbage-collected (and then dropped from storage) long before they
      // could be shown offline.
      gcTime: PERSIST_MAX_AGE_MS,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Root query keys worth keeping across launches: what a guard needs to see on
 * Home with no signal (BRD 4.8 "offline mode for task viewing"). The old filter
 * matched substrings ('assigned'), which never matched the real tasks key
 * (['my-tasks']), so tasks were not cached at all.
 */
const PERSISTED_ROOT_KEYS = new Set([
  'staff-summary',
  'my-tasks',
  'shifts-today',
  'staff-profile-brief',
]);

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'rq_cache_v2', // v1 had corrupt error-state entries from a 403 loop; discarded
});

let persistenceStarted = false;

/** Restore the persisted cache and keep it in sync. Call once at launch. */
export function startQueryPersistence(): void {
  if (persistenceStarted) return;
  persistenceStarted = true;
  persistQueryClient({
    queryClient,
    persister,
    maxAge: PERSIST_MAX_AGE_MS,
    // A new build may change response shapes; never restore an old build's cache.
    buster: APP_VERSION_LABEL,
    dehydrateOptions: {
      shouldDehydrateQuery: (q) =>
        q.state.status === 'success' && PERSISTED_ROOT_KEYS.has(String(q.queryKey[0])),
    },
  });
}

/**
 * Wire react-query to the app lifecycle. Without this, `refetchOnWindowFocus`
 * and `refetchOnReconnect` were silently inert (react-query's defaults listen
 * to browser events that don't exist in React Native), so Home stayed on its
 * error card after a network blip, and `refetchInterval` kept polling while the
 * app was in the background.
 *
 * Called from an effect, not at module scope: NetInfo listeners registered at
 * import time have frozen the bundle on some Expo/RN combinations.
 */
export function startQueryLifecycle(): () => void {
  const onAppState = (status: AppStateStatus) => focusManager.setFocused(status === 'active');
  const appStateSub = AppState.addEventListener('change', onAppState);

  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      // `isInternetReachable` is null while unknown — treat unknown as online
      // so a slow reachability probe never blocks requests.
      setOnline(!!state.isConnected && state.isInternetReachable !== false);
    }),
  );

  return () => appStateSub.remove();
}

/**
 * Drop every cached response, in memory and on disk. Called on sign-out so the
 * next person to use a shared guard phone can't see the previous session's
 * tasks, visitors or salary.
 */
export async function clearQueryCache(): Promise<void> {
  queryClient.clear();
  try {
    await persister.removeClient();
  } catch {
    /* best-effort */
  }
}
