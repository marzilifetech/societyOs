import { AppState, type AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { QueryClient, focusManager, onlineManager } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      // Memory: evict inactive query data after 5 min so the cache can't grow
      // unbounded as the user navigates across the app's many screens.
      gcTime: 1000 * 60 * 5,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Wire react-query to the app lifecycle. Without this, react-query listens for
 * browser focus/online events that don't exist in React Native: screens with a
 * `refetchInterval` kept polling while the app sat in the background or the
 * phone was offline (data and battery on a low-end phone), and
 * `refetchOnReconnect` never fired, so a screen stayed on its error card after
 * a network blip.
 *
 * Called from an effect, not at module scope: NetInfo listeners registered at
 * import time have frozen the bundle on some Expo/RN combinations.
 */
export function startQueryLifecycle(): () => void {
  const onAppState = (status: AppStateStatus) => focusManager.setFocused(status === 'active');
  const appStateSub = AppState.addEventListener('change', onAppState);

  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      // Connectivity only. Android reports "no internet" (isInternetReachable
      // false) on networks that block Google's probe while our API works fine;
      // trusting it paused every request with no banner to explain why.
      setOnline(state.isConnected !== false);
    }),
  );

  return () => appStateSub.remove();
}
