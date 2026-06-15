import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import {
  setupNotificationHandler,
  setupNotificationCategories,
  setupTapRouting,
  ensureAndroidChannels,
  registerDeviceToken,
  subscribeToTokenRotation,
  subscribeToForegroundReceived,
} from '../src/lib/push';
import { NotificationProvider, useNotificationBanner } from '../src/contexts/NotificationContext';
import { InAppBanner } from '../src/components/InAppBanner';
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

/**
 * Bridges expo-notifications' foreground listener into the banner context.
 * Mounted inside <NotificationProvider> so it can call `showBanner`. Only
 * subscribes while authenticated to avoid surfacing notifications meant for
 * a previous session.
 */
function ForegroundBannerBridge({ active }: { active: boolean }) {
  const { showBanner } = useNotificationBanner();
  useEffect(() => {
    if (!active) return;
    const sub = subscribeToForegroundReceived((n) => {
      const c = n.request.content;
      const data = (c.data && typeof c.data === 'object' ? c.data : {}) as Record<string, unknown>;
      const imageUrl =
        typeof data.imageUrl === 'string'
          ? data.imageUrl
          : (c as any).attachments?.[0]?.url ?? undefined;
      showBanner({
        id: n.request.identifier,
        title: c.title ?? 'Notification',
        body: c.body ?? '',
        imageUrl,
        type: typeof data.type === 'string' ? data.type : undefined,
        entityId:
          typeof data.entityId === 'string'
            ? data.entityId
            : typeof data.visitId === 'string'
            ? data.visitId
            : undefined,
        actionGroup: typeof data.actionGroup === 'string' ? data.actionGroup : undefined,
        data,
      });
    });
    return () => sub.remove();
  }, [active, showBanner]);
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
      // iOS action categories — must be registered before any actionable
      // push arrives or the buttons won't render. Idempotent.
      await setupNotificationCategories();
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
            <NotificationProvider>
              <NetworkBanner />
              {token ? <RealtimeProvider /> : null}
              <StatusBar style="auto" />
              <Stack screenOptions={{ headerShown: false }} />
              {/* InAppBanner is mounted last so it overlays every screen,
                  including bottom tabs and modals. */}
              <ForegroundBannerBridge active={!!token} />
              <InAppBanner />
            </NotificationProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
