import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

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

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<BannerNotification | null>(null);
  const queueRef = useRef<BannerNotification[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const showNext = useCallback(() => {
    const next = queueRef.current.shift() ?? null;
    setCurrent(next);
    clearTimer();
    if (next) {
      timerRef.current = setTimeout(() => {
        setCurrent(null);
        showNext();
      }, 10_000);
    }
  }, []);

  const dismiss = useCallback(() => {
    clearTimer();
    setCurrent(null);
    showNext();
  }, [showNext]);

  const showBanner = useCallback(
    (n: BannerNotification) => {
      if (current) {
        if (queueRef.current.length < 5) {
          queueRef.current.push(n);
        }
        return;
      }
      setCurrent(n);
      clearTimer();
      timerRef.current = setTimeout(() => {
        setCurrent(null);
        showNext();
      }, 10_000);
    },
    [current, showNext],
  );

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
