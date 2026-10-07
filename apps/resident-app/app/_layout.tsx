import { useEffect, useState } from 'react';
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
import { NotificationOnboarding } from '../src/components/NotificationOnboarding';
import { AppUpdateGate } from '../src/components/AppUpdateGate';
import { DeliveryApprovalModal, type DeliveryPayload } from '../src/components/DeliveryApprovalModal';
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
import { bootstrapWindowMetrics } from '../src/lib/safe-area-bootstrap';
import { queryClient } from '../src/lib/query-client';
import { useAuthStore } from '../src/store/auth.store';
import { initSentry, setSentryUser } from '../src/lib/sentry';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { NetworkBanner } from '../src/components/NetworkBanner';
import { useRealtime } from '../src/hooks/useRealtime';
import { useBootGate } from '../src/hooks/useBootGate';
import { primeReducedMotion } from '../src/hooks/useReducedMotion';
import { BootScreen } from '../src/components/BootScreen';
import { startOfflineDrainListener } from '../src/lib/offline-queue';
import { settleWindowBackground, SETTLE_FALLBACK_MS } from '../src/lib/window-background';
import '../src/lib/nativewind';
import './global.css';

initSentry();

// Configure foreground display before any notification can arrive.
setupNotificationHandler();

SplashScreen.preventAutoHideAsync().catch(() => {});

// Read the stored session NOW, at import time, not from an effect. Every
// expo-module async call — SecureStore and all nine font loads included —
// shares ONE native queue. Started from an effect, the session reads were
// queued behind the fonts, so on a slow phone they sat waiting for fonts and
// then ran into their own timeout: a signed-in resident shown the sign-in
// flow. First in the queue, they are never held up by anything cosmetic.
void useAuthStore.getState().hydrate();

// Known before the first screen renders, so no decorative animation ever
// starts for a resident who has turned animations off.
primeReducedMotion();

function RealtimeProvider() {
  useRealtime();
  return null;
}

/**
 * Bridges expo-notifications' foreground listener into the banner context.
 * Mounted inside <NotificationProvider> so it can call `showBanner`. Only
 * subscribes while authenticated to avoid surfacing notifications meant for
 * a previous session.
 *
 * Delivery branch: when data.type === 'DELIVERY_APPROVAL_REQUEST' arrives in
 * foreground we BYPASS the in-app banner and surface a full-screen
 * DeliveryApprovalModal instead. The resident must make a decision (Approve
 * / Leave at security / Reject) — the modal is intentionally not
 * dismissible. Guest pushes still ride the banner.
 */
function ForegroundBannerBridge({
  active,
  onDelivery,
}: {
  active: boolean;
  onDelivery: (payload: DeliveryPayload) => void;
}) {
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

      const dataType = typeof data.type === 'string' ? data.type : undefined;

      // Delivery → full-screen takeover. Pull out the fields the modal needs;
      // the banner queue is skipped so the resident isn't distracted by
      // two competing UIs. Match BOTH the legacy payload key and the current
      // category-registry key ('deliveries') the backend now sends, otherwise a
      // real delivery arriving in the foreground falls through to the plain
      // banner instead of the forced-decision modal.
      if (dataType === 'DELIVERY_APPROVAL_REQUEST' || dataType === 'deliveries') {
        const visitId =
          typeof data.entityId === 'string'
            ? data.entityId
            : typeof data.visitId === 'string'
            ? data.visitId
            : null;
        if (visitId) {
          onDelivery({
            visitId,
            visitorName: typeof data.visitorName === 'string' ? data.visitorName : c.title ?? 'Delivery',
            deliveryPartner: typeof data.deliveryPartner === 'string' ? data.deliveryPartner : null,
            photoUrl: imageUrl ?? null,
          });
          return;
        }
      }

      showBanner({
        id: n.request.identifier,
        title: c.title ?? 'Notification',
        body: c.body ?? '',
        imageUrl,
        type: dataType,
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
  }, [active, showBanner, onDelivery]);
  return null;
}

export default function RootLayout() {
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const token = useAuthStore((s) => s.token);

  const [fontsLoaded, fontError] = useFonts({
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

  // Hydration bounds itself (HYDRATE_BUDGET_MS) and fonts are only waited on
  // for FONT_WAIT_MS, so this can't hold the app indefinitely. While it is
  // closed the BootScreen — a continuation of the native splash with a
  // spinner once launch is slow — is what the resident sees.
  const bootReady = useBootGate({ isHydrated, fontsSettled: fontsLoaded || !!fontError });

  useEffect(() => {
    // Deferred — calling NetInfo.addEventListener at module scope freezes the
    // JS bundle under Expo Go SDK 52 + New Architecture (same class of issue
    // documented in useRealtime.ts).
    startOfflineDrainListener();
  }, []);

  useEffect(() => {
    // BootScreen hides the native splash as soon as its logo is drawn. This
    // is the backstop in case that image never reports loading.
    // ErrorBoundary.componentDidCatch covers a render crash.
    if (bootReady) SplashScreen.hideAsync().catch(() => {});
  }, [bootReady]);

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

  if (!bootReady) return <BootScreen />;

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        {/* initialMetrics is NOT optional here. SafeAreaProvider renders its
            native view but NO CHILDREN while `insets` is null, and insets start
            null unless seeded — the provider then waits on an async native
            onInsetsChange event. Under Fabric/bridgeless startup on Android that
            event is sometimes never delivered, and the ENTIRE app tree silently
            never mounts: no crash, no log, just the maroon window background.
            Measured ~50% of cold starts on Android 15 before this was added.
            `initialWindowMetrics` is read synchronously from a native constant
            at module load, so the first render already has insets. */}
        <SafeAreaProvider initialMetrics={bootstrapWindowMetrics}>
          <QueryClientProvider client={queryClient}>
            <NotificationProvider>
              <RootShell token={token} />
            </NotificationProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

/**
 * Carved out so the delivery-takeover state can live inside the React tree
 * AND consume the notification context. Putting useState on RootLayout
 * itself would force RootShell to re-render on every state flip, but the
 * isolation here keeps Stack remount-free.
 */
function RootShell({ token }: { token: string | null }) {
  const [deliveryPayload, setDeliveryPayload] = useState<DeliveryPayload | null>(null);
  // The tabs and sign-in layouts settle the window background as soon as
  // they are up; this covers a launch that goes straight elsewhere (e.g. a
  // deep link). See src/lib/window-background.ts.
  useEffect(() => settleWindowBackground(SETTLE_FALLBACK_MS), []);
  return (
    <>
      <NetworkBanner />
      {token ? <RealtimeProvider /> : null}
      {/* "dark" (dark icons), not "auto": the app is light-only, but "auto"
          follows the PHONE's theme, so with dark mode on — common on Samsung —
          the clock and battery turned white on our white screens and vanished.
          Screens with a dark header still override this locally. */}
      <StatusBar style="dark" />
      {/* Asks the OS for notification permission once, just after sign-in, and
          keeps the device token current. Renders nothing.

          This replaces the old permanent "notifications are off" strip that sat
          above the navigator on EVERY screen for as long as permission was
          denied. It cost every user a band of screen height forever, duplicated
          the OS's own dialog, and could not be dismissed. Recovery now lives in
          Settings → Notifications and the setup screen, on demand. */}
      <NotificationOnboarding active={!!token} />
      {/* AppUpdateGate wraps the navigation Stack so when the policy says
          'immediate' we replace the entire app with the blocker screen —
          even unauthenticated boot can't bypass it. */}
      <AppUpdateGate>
        <Stack screenOptions={{ headerShown: false }}>
          {/* The root index only redirects (see app/index.tsx). Entering the
              app from it is a cut, like any splash → app: the default slide
              made the first screen visibly arrive a second time right after
              launch, and a cross-fade would show the window background
              through both screens. */}
          <Stack.Screen name="index" options={{ animation: 'none' }} />
          <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
          <Stack.Screen name="(auth)" options={{ animation: 'none' }} />
        </Stack>
      </AppUpdateGate>
      {/* InAppBanner is mounted last so it overlays every screen, including
          bottom tabs and modals. Delivery pushes are diverted from the
          banner into a full-screen modal (DeliveryApprovalModal) below. */}
      <ForegroundBannerBridge active={!!token} onDelivery={setDeliveryPayload} />
      <InAppBanner />
      <DeliveryApprovalModal
        payload={deliveryPayload}
        onResolved={() => setDeliveryPayload(null)}
      />
    </>
  );
}
