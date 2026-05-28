'use client';
import { useEffect } from 'react';

/**
 * When a SUPER_ADMIN switches society in another tab, this tab's React Query
 * cache and in-memory state still belong to the old society. localStorage IS
 * shared across tabs, so the next request from this tab will silently send
 * the NEW X-Society-Id but the UI is showing OLD-society cached data.
 *
 * Fix: subscribe to the `storage` event for the tenant key and full-reload
 * when it changes. The single-tab path already does qc.clear() + reload via
 * SocietySwitcher.finalizeSwitch — this just extends the same guarantee to
 * sibling tabs.
 *
 * Mount once in (authed)/layout.tsx — renders nothing.
 */
export function CrossTabSocietySync() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const KEY = 'admin_selected_society_id';
    const onStorage = (e: StorageEvent) => {
      // `e.key === null` means localStorage.clear() was called — also treat
      // as a tenant-context invalidation (e.g. logout in another tab).
      if (e.key === KEY || e.key === null) {
        if (e.newValue !== e.oldValue) {
          window.location.reload();
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  return null;
}
