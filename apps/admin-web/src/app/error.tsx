'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function ErrorPage({
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6">
      <div className="text-6xl mb-4">😕</div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
      <p className="text-gray-500 max-w-md text-center mb-6">
        We&apos;ve been notified and are looking into it. You can try again or head back to the dashboard.
      </p>
      <pre className="max-w-lg max-h-32 overflow-auto bg-gray-100 rounded p-3 text-xs text-gray-600 mb-6">
        {error.message}
        {error.digest ? `\n\nDigest: ${error.digest}` : ''}
      </pre>
      <div className="flex gap-3">
        <button
          onClick={() => reset()}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg px-6 py-2"
        >
          Try again
        </button>
        <a
          href="/dashboard"
          className="bg-white border border-gray-300 text-gray-700 font-semibold rounded-lg px-6 py-2"
        >
          Dashboard
        </a>
      </div>
    </div>
  );
}
