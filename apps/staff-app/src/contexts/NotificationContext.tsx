import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuthStore } from '../store/auth.store';

/**
 * Foreground rich-notification queue. Mirrors the resident-app implementation
 * intentionally — the staff app uses its own dark-blue theme but the queueing
 * + auto-dismiss + FIFO overflow behaviour is identical so support staff and
 * residents see consistent banner timing.
 */
export interface BannerNotification {
  id: string;
  title: string;
  body: string;
  imageUrl?: string;
  type?: string;
  entityId?: string;
  actionGroup?: string;
  data: Record<string, unknown>;
}

interface NotificationContextValue {
  current: BannerNotification | null;
  showBanner: (n: BannerNotification) => void;
  dismiss: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

/**
 * Coarse-grained type used for banner tint + auto-dismiss timing. Mirrors
 * the backend's NotificationType — see backend/src/common/notification/
 * notification-categories.ts.
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
    key === 'notices_urgent' ||
    key === 'approval_results' ||
    key === 'help' ||
    key === 'help_request' ||
    key.includes('task')
  ) {
    return 'DELIVERY';
  }
  return 'MARKETING';
}

const DISMISS_MS: Record<BannerType, number | null> = {
  MARKETING: 4_000,
  DELIVERY: 10_000,
  EMERGENCY: null, // sticky — staff must explicitly acknowledge SOS
};

const MAX_QUEUED = 5;

const isEmergency = (n: BannerNotification) => classifyBannerType(n) === 'EMERGENCY';

/**
 * Hold the queue to MAX_QUEUED by dropping ROUTINE banners from the back. An
 * SOS is never dropped, even if that means going over the cap: a missed
 * routine banner is still in the inbox, a missed SOS is a guard who never ran.
 */
function trimQueue(queue: BannerNotification[]): void {
  for (let i = queue.length - 1; i >= 0 && queue.length > MAX_QUEUED; i--) {
    if (!isEmergency(queue[i])) queue.splice(i, 1);
  }
}

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

  const present = useCallback(
    (n: BannerNotification | null) => {
      clearTimer();
      currentRef.current = n;
      setCurrent(n);
      if (!n) return;
      const ms = DISMISS_MS[classifyBannerType(n)];
      if (ms === null) return;
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
      const queue = queueRef.current;
      if (isEmergency(n)) {
        // An emergency never waits behind routine banners: it takes the screen
        // now and the interrupted banner goes back to the front of the queue.
        if (!isEmergency(showing)) {
          queue.unshift(showing);
          trimQueue(queue);
          present(n);
          return;
        }
        // Another SOS is up (sticky until acknowledged): this one is next —
        // after any SOS already waiting, ahead of every routine banner. It
        // used to join the BACK of the queue, or be dropped when it was full.
        const firstRoutine = queue.findIndex((q) => !isEmergency(q));
        queue.splice(firstRoutine === -1 ? queue.length : firstRoutine, 0, n);
        trimQueue(queue);
        return;
      }
      if (queue.length < MAX_QUEUED) queue.push(n);
    },
    [present],
  );

  // Sign-out: this guard's banners (and their action buttons) must not be
  // left on screen, or queued, for whoever signs in next.
  const token = useAuthStore((st) => st.token);
  useEffect(() => {
    if (token) return;
    queueRef.current = [];
    present(null);
  }, [token, present]);

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
