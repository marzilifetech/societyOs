'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Landing route. Can't read localStorage on the server, so this is a client
 * redirect: send authenticated users to /dashboard and everyone else to
 * /login. Previously this did an unconditional server redirect('/dashboard'),
 * which let unauthenticated visitors reach the dashboard shell and trigger a
 * 401 error-bounce loop before finally landing on /login.
 */
export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token =
      typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    router.replace(token ? '/dashboard' : '/login');
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-sm text-gray-400">Loading…</div>
    </div>
  );
}
