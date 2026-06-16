import { useEffect, useRef, useState } from 'react';
import { AppState, View, ActivityIndicator } from 'react-native';
import { Stack, router } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import {
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
} from '@expo-google-fonts/montserrat';
import { Lato_400Regular, Lato_700Bold } from '@expo-google-fonts/lato';
import * as SplashScreen from 'expo-splash-screen';
import { I18nextProvider } from 'react-i18next';
import '../src/lib/nativewind';
import './global.css';
import { queryClient } from '../src/lib/query-client';
import { useAuthStore } from '../src/store/auth.store';
import { useSettingsStore } from '../src/store/settings.store';
import i18n, { initI18n } from '../src/lib/i18n';
import { startOfflineDrainListener } from '../src/lib/offline-queue';
import {
  setupNotificationHandler,
  setupNotificationCategories,
  registerForPushNotifications,
  attachNotificationTapHandler,
  detachNotificationTapHandler,
  subscribeToForegroundReceived,
} from '../src/lib/notifications';
import { NotificationProvider, useNotificationBanner } from '../src/contexts/NotificationContext';
import { InAppBanner } from '../src/components/InAppBanner';
import { NotificationPermissionBanner } from '../src/components/NotificationPermissionBanner';
import { AppUpdateGate } from '../src/components/AppUpdateGate';
import { initSentry, setSentryUser } from '../src/lib/sentry';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { NetworkBanner } from '../src/components/NetworkBanner';
import { isPinSet } from './(auth)/pin-setup';
import { colorScheme, useColorScheme } from 'nativewind';
import { StatusBar } from 'expo-status-bar';

initSentry();

SplashScreen.preventAutoHideAsync().catch(() => {});

function ThemedStatusBar() {
  const { colorScheme: scheme } = useColorScheme();
  return <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />;
}

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'rq_cache_v2', // v1 had corrupt error-state entries from 403 loop; discard it
});

persistQueryClient({
  queryClient,
  persister,
  maxAge: 1000 * 60 * 60 * 24, // 24h
  dehydrateOptions: {
    shouldDehydrateQuery: (q) => {
      if (q.state.status !== 'success') return false;
      const k = JSON.stringify(q.queryKey);
      // Cache only the keys mentioned in BRD: summary, assigned, shifts
      return k.includes('summary') || k.includes('assigned') || k.includes('shifts');
    },
  },
});

export default function RootLayout() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const token = useAuthStore((s) => s.token);
  const settingsHydrate = useSettingsStore((s) => s.hydrate);
  const settingsTheme = useSettingsStore((s) => s.theme);
  const settingsHydrated = useSettingsStore((s) => s.hydrated);
  const autoLockMinutes = useSettingsStore((s) => s.autoLockMinutes);
  const biometricEnabled = useSettingsStore((s) => s.biometricEnabled);
  const [ready, setReady] = useState(false);
  const lastBackgroundedAt = useRef<number | null>(null);

  const [fontsLoaded] = useFonts({
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
    Lato_400Regular,
    Lato_700Bold,
  });

  useEffect(() => {
    (async () => {
      await Promise.all([hydrate(), settingsHydrate(), initI18n(), setupNotificationHandler()]);
      startOfflineDrainListener();
      // Remove any errored/stale queries left over from a previous unauthenticated
      // session so they don't block data loading after the user logs in.
      queryClient.removeQueries({ predicate: (q) => q.state.status === 'error' });
      setReady(true);
      if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
    })();
  }, [fontsLoaded]);

  // Keep NativeWind / Tailwind `dark:` in sync with persisted theme (Settings → Theme).
  useEffect(() => {
    if (!settingsHydrated) return;
    colorScheme.set(settingsTheme);
  }, [settingsHydrated, settingsTheme]);

  // Tag Sentry with the active user.
  useEffect(() => {
    const user = useAuthStore.getState().user;
    setSentryUser(user?.id ?? null);
  }, [token]);

  // Auth gating: when ready & token present, ensure PIN/biometric or send to phone-entry
  const gatedRef = useRef(false);
  useEffect(() => {
    if (!ready) return;
    if (gatedRef.current) return;
    gatedRef.current = true;
    (async () => {
      if (!token) return; // unauthenticated; phone-entry is the default
      const pinSet = await isPinSet();
      if (!pinSet && !biometricEnabled) {
        router.replace('/(auth)/pin-setup' as any);
        return;
      }
      router.replace('/(auth)/pin-login' as any);
    })();
    return () => {
      detachNotificationTapHandler();
    };
  }, [ready, token]);

  // Register push token whenever we have a session — fires after fresh OTP login
  // too, not just when we re-enter a persisted session via PIN.
  useEffect(() => {
    if (!ready || !token) return;
    (async () => {
      // Register iOS action categories BEFORE the first push can arrive, or
      // the lockscreen buttons won't render.
      await setupNotificationCategories();
      await registerForPushNotifications();
      attachNotificationTapHandler();
    })().catch(() => {});
  }, [ready, token]);

  // Auto-lock after idle
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        lastBackgroundedAt.current = Date.now();
      } else if (state === 'active' && lastBackgroundedAt.current) {
        const idleMs = Date.now() - lastBackgroundedAt.current;
        lastBackgroundedAt.current = null;
        if (idleMs >= autoLockMinutes * 60 * 1000 && useAuthStore.getState().token) {
          isPinSet().then((set) => {
            if (set || biometricEnabled) router.replace('/(auth)/pin-login' as any);
          });
        }
      }
    });
    return () => sub.remove();
  }, [autoLockMinutes, biometricEnabled]);

  if (!fontsLoaded || !ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#821A52' }}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <I18nextProvider i18n={i18n} defaultNS="translation">
            <ThemedStatusBar />
            <QueryClientProvider client={queryClient}>
              <NotificationProvider>
                <NetworkBanner />
                {/* Update gate wraps the navigation Stack: when the policy
                    is 'immediate' the Stack is replaced with the blocker
                    screen — staff cannot bypass even before PIN login. */}
                <AppUpdateGate>
                  <Stack screenOptions={{ headerShown: false }} />
                </AppUpdateGate>
                {/* Global "notifications are off" strip — zIndex 8000.
                    Beneath InAppBanner (9999) so a foreground push overlays
                    it. Only rendered while authenticated. */}
                {token ? <NotificationPermissionBanner /> : null}
                <ForegroundBannerBridge active={!!token} />
                <InAppBanner />
              </NotificationProvider>
            </QueryClientProvider>
          </I18nextProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

/** Pipes foreground-received notifications into the banner queue. */
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
            : typeof data.id === 'string'
            ? data.id
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
