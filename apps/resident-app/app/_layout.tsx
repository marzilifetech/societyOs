import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../src/lib/api';
import {
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
} from '@expo-google-fonts/montserrat';
import { Lato_400Regular, Lato_700Bold } from '@expo-google-fonts/lato';
import { QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { queryClient } from '../src/lib/query-client';
import { useAuthStore } from '../src/store/auth.store';
import { initSentry, setSentryUser } from '../src/lib/sentry';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { NetworkBanner } from '../src/components/NetworkBanner';
import { useRealtime } from '../src/hooks/useRealtime';
import { startOfflineDrainListener } from '../src/lib/offline-queue';
import '../src/lib/nativewind';
import './global.css';

initSentry();

SplashScreen.preventAutoHideAsync().catch(() => {});

function RealtimeProvider() {
  useRealtime();
  return null;
}

const PUSH_TOKEN_KEY = 'expo_push_token';

async function registerPushTokenOnce() {
  try {
    const stored = await AsyncStorage.getItem(PUSH_TOKEN_KEY);

    const { status: existing } = await Notifications.getPermissionsAsync();
    let granted = existing === 'granted';
    if (!granted) {
      const { status } = await Notifications.requestPermissionsAsync();
      granted = status === 'granted';
    }
    if (!granted) return;

    const projectId =
      (Constants.expoConfig as any)?.extra?.eas?.projectId ??
      (Constants as any).easConfig?.projectId;
    // getExpoPushTokenAsync throws on iOS Simulator (no APNS) — caught below.
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenData.data;
    if (!token || token === stored) return;

    await api.post('/auth/device-token', { token, platform: Platform.OS });
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
  } catch {
    /* swallow — push registration is best-effort (e.g. iOS Simulator) */
  }
}

export default function RootLayout() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const token = useAuthStore((s) => s.token);

  const [fontsLoaded] = useFonts({
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
    Lato_400Regular,
    Lato_700Bold,
  });

  useEffect(() => {
    // Hide splash as soon as hydration resolves (success or failure).
    // ErrorBoundary.componentDidCatch is a second safety net if a render crash
    // prevents this effect from running.
    hydrate().finally(() => SplashScreen.hideAsync().catch(() => {}));
    // Deferred — calling NetInfo.addEventListener at module scope freezes the
    // JS bundle under Expo Go SDK 52 + New Architecture (same class of issue
    // documented in useRealtime.ts).
    startOfflineDrainListener();
  }, [hydrate]);

  useEffect(() => {
    if (isHydrated) {
      const u = useAuthStore.getState() as { user?: { id?: string } | null };
      setSentryUser(u.user?.id ?? null);
    }
  }, [isHydrated]);

  // Register the Expo push token with the backend exactly once per token.
  // Runs only after auth has hydrated AND we have a session — otherwise the
  // /auth/device-token call would 401 and the token wouldn't be saved.
  useEffect(() => {
    if (isHydrated && token) {
      registerPushTokenOnce();
    }
  }, [isHydrated, token]);

  // Show a solid view matching the splash background — avoids a white flash
  // while React commits the isHydrated state update.
  if (!isHydrated || !fontsLoaded) return <View style={{ flex: 1, backgroundColor: '#3B3FBF' }} />;

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <NetworkBanner />
            {token ? <RealtimeProvider /> : null}
            <StatusBar style="auto" />
            <Stack screenOptions={{ headerShown: false }} />
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
