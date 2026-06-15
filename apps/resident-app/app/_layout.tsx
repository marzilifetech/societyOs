import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import {
  setupNotificationHandler,
  setupTapRouting,
  ensureAndroidChannels,
  registerDeviceToken,
  subscribeToTokenRotation,
} from '../src/lib/push';
import {
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
} from '@expo-google-fonts/montserrat';
import { Lato_400Regular, Lato_700Bold } from '@expo-google-fonts/lato';
import {
  PlayfairDisplay_500Medium,
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
} from '@expo-google-fonts/playfair-display';
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

// Configure foreground display before any notification can arrive.
setupNotificationHandler();

SplashScreen.preventAutoHideAsync().catch(() => {});

function RealtimeProvider() {
  useRealtime();
  return null;
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
    PlayfairDisplay_500Medium,
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_700Bold,
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

  // Tap routing for notification responses (warm taps + cold start). Set up
  // once on mount; deep-links into the app via the router.
  useEffect(() => {
    const sub = setupTapRouting();
    return () => sub.remove();
  }, []);

  // Register the NATIVE FCM device token with the backend once per token, and
  // re-register whenever the token rotates. Runs only after auth has hydrated
  // AND we have a session — otherwise the /notifications/devices call would 401.
  useEffect(() => {
    if (!isHydrated || !token) return;
    let sub: ReturnType<typeof subscribeToTokenRotation> | undefined;
    (async () => {
      // Channels must exist before requesting the token so the first push
      // lands on the correct (high-importance) channel.
      await ensureAndroidChannels();
      await registerDeviceToken();
      sub = subscribeToTokenRotation();
    })();
    return () => sub?.remove();
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
