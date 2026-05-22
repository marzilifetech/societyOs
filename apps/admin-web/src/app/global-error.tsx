'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Application error</h1>
          <p style={{ color: '#666', marginBottom: 16 }}>A critical error occurred. Please try reloading.</p>
          <button onClick={() => reset()} style={{ background: '#2563EB', color: 'white', borderRadius: 8, padding: '8px 24px', border: 'none', fontWeight: 600 }}>
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
