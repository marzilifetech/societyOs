import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

/**
 * Shape of the rich notification displayed in the foreground banner.
 * Mirrors `expo-notifications` content but flattened so the banner doesn't need
 * to know about Expo internals.
 */
export interface BannerNotification {
  id: string;
  title: string;
  body: string;
  imageUrl?: string;
  /** Routing key the backend sent (e.g. VISITOR_APPROVAL_REQUEST). */
  type?: string;
  /** Entity ID for tap-to-detail routing. */
  entityId?: string;
  /** iOS action group id; presence enables Approve/Reject buttons. */
  actionGroup?: string;
  /** Free-form data echoed from the backend payload. */
  data: Record<string, unknown>;
}

interface NotificationContextValue {
  current: BannerNotification | null;
  /** Push a notification onto the visible-queue. Only one shows at a time. */
  showBanner: (n: BannerNotification) => void;
  /** Dismiss the current banner (called by the banner on tap / swipe / timeout). */
  dismiss: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

/**
 * Coarse-grained type used for banner tint + auto-dismiss timing. Mirrors
 * the backend's NotificationType — see backend/src/common/notification/
 * notification-categories.ts. We re-derive it on the client (rather than
 * trusting a backend-sent field) so payloads from older backend builds
 * still classify correctly.
 */
export type BannerType = 'MARKETING' | 'DELIVERY' | 'EMERGENCY';

export function classifyBannerType(n: BannerNotification | null): BannerType {
  if (!n) return 'MARKETING';
  const key = (n.type ?? '').toLowerCase();
  if (key === 'sos' || key.includes('emergency') || key.includes('sos_')) return 'EMERGENCY';
  if (
    key.includes('visitor') ||
    key.includes('delivery') ||
    key.includes('package') ||
    key === 'deliveries' ||
    key === 'visitors_gate' ||
    key === 'notices_urgent'
  ) {
    return 'DELIVERY';
  }
  return 'MARKETING';
}

/**
 * Senior-citizen banner queue. The user must have time to read each card, so we
 * NEVER overlap multiple banners — incoming notifications wait in a small FIFO
 * (max 5 — anything beyond that is dropped to avoid memory growth from a
 * runaway sender), except an emergency, which never waits behind routine
 * banners. Auto-dismiss is TYPE-AWARE:
 *
 *   MARKETING  → 4 s   (gentle, doesn't demand attention)
 *   DELIVERY   → 10 s  (matches NoBrokerHood's elderly-tested visitor timing)
 *   EMERGENCY  → never (sticky until the user dismisses or taps through —
 *                we explicitly do NOT auto-dismiss SOS alerts so the screen
 *                holds the message until acknowledged)
 */
const DISMISS_MS: Record<BannerType, number | null> = {
  MARKETING: 4_000,
  DELIVERY: 10_000,
  EMERGENCY: null,
};

const MAX_QUEUED = 5;

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<BannerNotification | null>(null);
  // The banner on screen, as a ref: `showBanner` used to read `current` from
  // its render closure, so two pushes landing in the same frame both saw an
  // empty slot and the second silently replaced the first.
  const currentRef = useRef<BannerNotification | null>(null);
  const queueRef = useRef<BannerNotification[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /** The one place a banner goes on (or off) screen, with its own timer. */
  const present = useCallback(
    (n: BannerNotification | null) => {
      clearTimer();
      currentRef.current = n;
      setCurrent(n);
      if (!n) return;
      const ms = DISMISS_MS[classifyBannerType(n)];
      if (ms === null) return; // sticky — no auto-dismiss
      timerRef.current = setTimeout(() => present(queueRef.current.shift() ?? null), ms);
    },
    [clearTimer],
  );

  const dismiss = useCallback(() => {
    present(queueRef.current.shift() ?? null);
  }, [present]);

  const showBanner = useCallback(
    (n: BannerNotification) => {
      const showing = currentRef.current;
      if (!showing) {
        present(n);
        return;
      }
      // An emergency never waits behind routine banners: it takes the screen
      // now and the interrupted banner goes back to the front of the queue.
      if (classifyBannerType(n) === 'EMERGENCY' && classifyBannerType(showing) !== 'EMERGENCY') {
        queueRef.current.unshift(showing);
        queueRef.current.length = Math.min(queueRef.current.length, MAX_QUEUED);
        present(n);
        return;
      }
      if (queueRef.current.length < MAX_QUEUED) queueRef.current.push(n);
    },
    [present],
  );

  useEffect(() => clearTimer, [clearTimer]);

  const value = useMemo(() => ({ current, showBanner, dismiss }), [current, showBanner, dismiss]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotificationBanner(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotificationBanner must be used inside <NotificationProvider>');
  }
  return ctx;
}
