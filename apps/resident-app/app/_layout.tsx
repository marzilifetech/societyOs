import { useEffect, useState } from 'react';
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
import { NotificationPermissionBanner } from '../src/components/NotificationPermissionBanner';
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
  const hydrate = useAuthStore((s) => s.hydrate);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const token = useAuthStore((s) => s.token);
  // Failsafe so the app can NEVER get trapped on the maroon splash. If either
  // hydration or font loading stalls (device Keystore hiccup, a font asset that
  // won't decode, etc.), we proceed anyway after a few seconds — fonts fall back
  // to system defaults and a null token simply routes to the login flow. Far
  // better than an infinite splash.
  const [failsafeReady, setFailsafeReady] = useState(false);

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

  // Boot failsafe — if we're still gated after 3.5s, log WHY (so logcat reveals
  // whether hydration or fonts stalled) and force the app past the splash.
  useEffect(() => {
    const timer = setTimeout(() => {
      const st = useAuthStore.getState();
      if (!st.isHydrated || !fontsLoaded) {
        console.warn(
          `[boot] splash failsafe fired — isHydrated=${st.isHydrated} ` +
            `fontsLoaded=${fontsLoaded} fontError=${fontError ? String(fontError) : 'none'}`,
        );
      }
      setFailsafeReady(true);
    }, 3500);
    return () => clearTimeout(timer);
  }, [fontsLoaded, fontError]);

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
  // while React commits the isHydrated state update. `fontError` counts as
  // "fonts done" (fall back to system fonts) and the failsafe timer guarantees
  // we never hang here indefinitely.
  const bootReady = (isHydrated && (fontsLoaded || !!fontError)) || failsafeReady;
  if (!bootReady) return <View style={{ flex: 1, backgroundColor: '#6E0043' }} />;

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
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
  return (
    <>
      <NetworkBanner />
      {token ? <RealtimeProvider /> : null}
      <StatusBar style="auto" />
      {/* Global "notifications are off" strip — IN-FLOW, above the navigator so
          it pushes screens down instead of overlaying their headers (mirrors
          NetworkBanner). Only rendered while authenticated so we don't pester a
          brand new user before the primer modal has had its chance. A foreground
          push (InAppBanner, absolute zIndex 9999) still overlays it cleanly. */}
      {token ? <NotificationPermissionBanner /> : null}
      {/* AppUpdateGate wraps the navigation Stack so when the policy says
          'immediate' we replace the entire app with the blocker screen —
          even unauthenticated boot can't bypass it. */}
      <AppUpdateGate>
        <Stack screenOptions={{ headerShown: false }} />
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
