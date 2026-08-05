'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Client-side gate for the entire `(authed)` route segment.
 *
 * Without this, visiting `/dashboard` (or any deep link) with no session would
 * still render the authed layout + page, which then fires React Query requests
 * that 401 — producing a flash of error UI and a bounce loop before the
 * api-client's 401 handler finally navigates to /login.
 *
 * Here we check for the access token BEFORE any authed child mounts:
 *   - no token  → replace() to /login (no history entry, no back-button loop)
 *   - has token → render children (real auth is still enforced server-side;
 *     an expired/invalid token 401s on the first request and the api-client
 *     redirects to /login?reason=session-expired)
 *
 * We read `admin_token` (the key lib/api.ts actually sends) rather than the
 * zustand store, so this stays correct even before the store rehydrates.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token =
      typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    if (!token) {
      router.replace('/login');
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-sm text-gray-400">Loading…</div>
      </div>
    );
  }

  return <>{children}</>;
}
