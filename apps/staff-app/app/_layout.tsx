import { useEffect } from 'react';
import { AppState, View } from 'react-native';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
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
import { colorScheme, useColorScheme } from 'nativewind';
import { StatusBar } from 'expo-status-bar';
import { toBannerPayload, useBootGate } from '@societyos/mobile-core';
import '../src/lib/nativewind';
import './global.css';
import { bootstrapWindowMetrics } from '../src/lib/safe-area-bootstrap';
import { queryClient, startQueryLifecycle, startQueryPersistence } from '../src/lib/query-client';
import { useAuthStore } from '../src/store/auth.store';
import { useLockStore } from '../src/store/lock.store';
import { useSettingsStore } from '../src/store/settings.store';
import i18n, { startI18n, useI18nReady } from '../src/lib/i18n';
import { startOfflineDrainListener } from '../src/lib/offline-queue';
import {
  setupNotificationHandler,
  setupTapRouting,
  subscribeToForegroundReceived,
} from '../src/lib/notifications';
import { NotificationProvider, useNotificationBanner } from '../src/contexts/NotificationContext';
import { InAppBanner } from '../src/components/InAppBanner';
import { NotificationOnboarding } from '../src/components/NotificationOnboarding';
import { AppUpdateGate } from '../src/components/AppUpdateGate';
import { AppLock } from '../src/components/AppLock';
import { BootScreen } from '../src/components/BootScreen';
import { initSentry, setSentryUser } from '../src/lib/sentry';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { NetworkBanner } from '../src/components/NetworkBanner';

initSentry();

// Configure foreground display before any notification can arrive.
setupNotificationHandler();

SplashScreen.preventAutoHideAsync().catch(() => {});

// Read the stored session NOW, at import time, not from an effect. Every
// expo-module async call — SecureStore and the six font loads included —
// shares ONE native queue. Started from an effect, the session reads queued
// behind the fonts. First in the queue, they are never held up by anything
// cosmetic. Each of these is bounded and never rejects (see the stores), so
// none of them can hold the app on the splash.
void useAuthStore.getState().hydrate();
void useSettingsStore.getState().hydrate();
void startI18n();
startQueryPersistence();

export default function RootLayout() {
  const authHydrated = useAuthStore((s) => s.isHydrated);
  const settingsHydrated = useSettingsStore((s) => s.hydrated);
  const i18nReady = useI18nReady();

  const [fontsLoaded, fontError] = useFonts({
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
    Lato_400Regular,
    Lato_700Bold,
  });

  // Everything the first route depends on is bounded, and fonts are only waited
  // on for FONT_WAIT_MS, so this can't hold the app indefinitely. The old gate
  // waited on an unbounded `Promise.all` with no catch: one rejected step (a
  // Keystore error reading the session) and it never opened.
  const bootReady = useBootGate({
    isHydrated: authHydrated && settingsHydrated && i18nReady,
    fontsSettled: fontsLoaded || !!fontError,
  });

  useEffect(() => startQueryLifecycle(), []);

  useEffect(() => {
    // Deferred — NetInfo listeners registered at module scope have frozen the
    // bundle on some Expo/RN combinations.
    startOfflineDrainListener();
  }, []);

  // Tap routing for notification responses (warm taps + the tap that launched
  // the app). Set up once, signed in or not; navigation itself waits for the
  // signed-in, unlocked shell (see lib/navigation.ts).
  useEffect(() => {
    const sub = setupTapRouting();
    return () => sub.remove();
  }, []);

  useEffect(() => {
    // BootScreen hides the native splash as soon as it draws; this is the
    // backstop. ErrorBoundary covers a render crash.
    if (bootReady) SplashScreen.hideAsync().catch(() => {});
  }, [bootReady]);

  if (!bootReady) return <BootScreen />;

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        {/* initialMetrics is NOT optional. SafeAreaProvider renders its native
            view but NO CHILDREN while `insets` is null, and insets start null
            unless seeded — the provider then waits on an async native
            onInsetsChange event that is sometimes never delivered on Android
            cold starts, leaving a blank window. */}
        <SafeAreaProvider initialMetrics={bootstrapWindowMetrics}>
          <I18nextProvider i18n={i18n} defaultNS="translation">
            <QueryClientProvider client={queryClient}>
              <NotificationProvider>
                <RootShell />
              </NotificationProvider>
            </QueryClientProvider>
          </I18nextProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

function RootShell() {
  const token = useAuthStore((s) => s.token);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const locked = useLockStore((s) => s.locked);
  const theme = useSettingsStore((s) => s.theme);

  // Keep NativeWind / Tailwind `dark:` in sync with Settings → Theme.
  useEffect(() => {
    colorScheme.set(theme);
  }, [theme]);

  useEffect(() => {
    setSentryUser(userId);
  }, [userId]);

  useAutoLock();

  return (
    <>
      <ThemedStatusBar />
      <NetworkBanner />
      {/* The update gate wraps the navigator: when the policy is 'immediate'
          the Stack is replaced with the blocker screen. */}
      {/* While locked, the app underneath is hidden from screen readers too —
          the overlay covers it visually, but Android's accessibility tree
          still exposed it (accessibilityViewIsModal is iOS-only). */}
      <View
        style={{ flex: 1 }}
        importantForAccessibility={token && locked ? 'no-hide-descendants' : 'auto'}
      >
        <AppUpdateGate>
          <Stack screenOptions={{ headerShown: false }}>
            {/* The root index only redirects. Entering the app from it is a cut,
              like splash → app: a slide made the first screen visibly arrive
              twice right after launch. */}
            <Stack.Screen name="index" options={{ animation: 'none' }} />
            <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
            <Stack.Screen name="(auth)" options={{ animation: 'none' }} />
          </Stack>
        </AppUpdateGate>
      </View>
      {/* The PIN lock covers the app instead of replacing routes — see
          src/store/lock.store.ts. */}
      {token && locked ? <AppLock /> : null}
      {/* Requests notification permission once per session, after unlock (not
          over the PIN screen), and keeps this device registered to whoever is
          signed in. Renders nothing. */}
      <NotificationOnboarding userId={token && !locked ? userId : null} />
      {/* Not while the PIN lock is up: the banner draws above the lock and
          its buttons (accept a task, take a help request) acted for the
          signed-in guard without the PIN. Pushes arriving meanwhile get the OS
          banner instead (setupNotificationHandler), and taps on those are held
          until unlock (lib/navigation.ts). */}
      <ForegroundBannerBridge active={!!token && !locked} />
      {/* Last, so it overlays every screen. Hides itself while locked. */}
      <InAppBanner />
    </>
  );
}

function ThemedStatusBar() {
  const { colorScheme: scheme } = useColorScheme();
  return <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />;
}

/**
 * Lock again after the app has been in the background for the configured idle
 * time. Only flips lock state — no navigation, so nothing the guard had open is
 * lost.
 */
function useAutoLock() {
  const autoLockMinutes = useSettingsStore((s) => s.autoLockMinutes);
  useEffect(() => {
    let backgroundedAt: number | null = null;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        backgroundedAt ??= Date.now();
        return;
      }
      if (state !== 'active' || backgroundedAt === null) return;
      const idleMs = Date.now() - backgroundedAt;
      backgroundedAt = null;
      const { token } = useAuthStore.getState();
      const { hasPin, lock } = useLockStore.getState();
      if (token && hasPin && idleMs >= autoLockMinutes * 60_000) lock();
    });
    return () => sub.remove();
  }, [autoLockMinutes]);
}

/** Pipes foreground-received notifications into the banner queue. */
function ForegroundBannerBridge({ active }: { active: boolean }) {
  const { showBanner } = useNotificationBanner();
  useEffect(() => {
    if (!active) return undefined;
    const sub = subscribeToForegroundReceived((n) => {
      const c = n.request.content;
      showBanner(
        toBannerPayload({
          identifier: n.request.identifier,
          title: c.title,
          body: c.body,
          data: c.data,
          attachments: (c as { attachments?: { url?: string }[] }).attachments,
        }),
      );
    });
    return () => sub.remove();
  }, [active, showBanner]);
  return null;
}
