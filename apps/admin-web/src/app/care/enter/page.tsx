'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { HeartPulse, AlertCircle } from 'lucide-react';
import { CARE_API_BASE } from '@/lib/care-api';
import { useCareAuth, type CareUser } from '@/store/care-auth.store';

/**
 * Seamless entry from the mobile app. The app mints a one-time handoff token
 * (POST /auth/care-handoff) and opens this page with it; we exchange it for a
 * real resident session and drop straight into /care — no second OTP.
 *
 * Uses a raw fetch (not careApi) so a bad/expired token shows a friendly
 * "reopen from the app" screen instead of the client's silent 401→login bounce.
 */
function EnterInner() {
  const router = useRouter();
  const params = useSearchParams();
  const setAuth = useCareAuth((s) => s.setAuth);
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  const token = params.get('t') ?? params.get('token') ?? '';

  useEffect(() => {
    if (ran.current) return; // exchange is one-shot — never fire twice
    ran.current = true;

    if (!token) {
      setError('This link is missing its sign-in code. Please reopen it from the app.');
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${CARE_API_BASE}/auth/care-handoff/exchange`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const json = await res.json().catch(() => ({}));
        const data = (json?.data ?? json) as {
          accessToken?: string;
          refreshToken?: string;
          user?: Partial<CareUser>;
        };
        if (!res.ok || !data?.accessToken || !data?.refreshToken || !data?.user?.id) {
          const msg =
            json?.error?.message ||
            'This sign-in link has expired. Please reopen it from the app.';
          throw new Error(msg);
        }
        setAuth(data.accessToken, data.refreshToken, {
          id: data.user.id!,
          name: data.user.name ?? '',
          phone: data.user.phone ?? '',
          role: data.user.role ?? 'RESIDENT',
          status: data.user.status ?? 'ACTIVE',
          societyId: data.user.societyId ?? '',
          societyName: data.user.societyName,
        });
        router.replace('/care');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not sign you in. Please try again.');
      }
    })();
  }, [token, setAuth, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-primary-700 to-primary-800 text-white px-8 text-center">
      {!error ? (
        <>
          <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center mb-5">
            <HeartPulse className="w-7 h-7" />
          </div>
          <p className="text-[16px] font-semibold">Signing you in…</p>
          <div className="mt-4 w-6 h-6 border-2 border-white/40 border-t-white rounded-full animate-spin" />
        </>
      ) : (
        <>
          <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center mb-5">
            <AlertCircle className="w-7 h-7" />
          </div>
          <p className="text-[16px] font-semibold">Couldn&apos;t sign you in</p>
          <p className="text-[13px] text-white/80 mt-2 max-w-xs">{error}</p>
          <button
            onClick={() => router.replace('/care/login')}
            className="mt-6 px-5 h-11 rounded-xl bg-white text-primary-800 text-[14px] font-semibold"
          >
            Sign in with OTP instead
          </button>
        </>
      )}
    </div>
  );
}

export default function CareEnterPage() {
  return (
    <Suspense fallback={null}>
      <EnterInner />
    </Suspense>
  );
}
