'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Toaster } from 'sonner';
import { useCareAuth } from '@/store/care-auth.store';

/**
 * Resident "Care" portal shell. Renders a phone-width frame (mobile-first,
 * centered on larger screens) and gates every route except /care/login behind
 * a resident session. Kept entirely separate from the admin (authed) layout —
 * no sidebar, no admin chrome.
 */
export default function CareLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const token = useCareAuth((s) => s.token);
  const [mounted, setMounted] = useState(false);

  // Public routes that must render WITHOUT a session: the OTP login and the
  // app→web seamless-entry handoff (which establishes the session itself).
  const isPublic = pathname === '/care/login' || pathname === '/care/enter';

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    if (!token && !isPublic) {
      router.replace('/care/login');
    }
  }, [mounted, token, isPublic, router]);

  // Until the persisted store has hydrated we don't know auth state; render a
  // neutral frame to avoid a flash of the wrong screen.
  const gateReady = mounted && (isPublic || !!token);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="mx-auto max-w-md min-h-screen bg-gray-50 shadow-sm relative">
        {gateReady ? children : <div className="min-h-screen bg-gray-50" />}
      </div>
      <Toaster position="top-center" richColors closeButton />
    </div>
  );
}
