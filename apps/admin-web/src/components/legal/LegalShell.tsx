import Link from 'next/link';
import type { ReactNode } from 'react';

const ACCENT = '#821A52';

/**
 * Branded, login-free shell for the public legal pages (Privacy Policy +
 * Account Deletion). Lives OUTSIDE the (authed) route group, so it is reachable
 * without authentication — required by the App Store / Play Store, which crawl
 * these URLs anonymously.
 */
export function LegalShell({
  title,
  subtitle,
  updated,
  children,
}: {
  title: string;
  subtitle?: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white text-gray-800">
      <header className="border-b border-gray-200">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-5 py-4">
          <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg font-bold text-white"
            style={{ backgroundColor: ACCENT }}
          >
            M
          </span>
          <span className="font-semibold text-gray-900">Marzi · SocietyOS</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
        {subtitle ? <p className="mt-2 text-gray-500">{subtitle}</p> : null}
        <p className="mt-1 text-sm text-gray-400">Last updated: {updated}</p>

        <div className="mt-8 space-y-8">{children}</div>

        <footer className="mt-14 border-t border-gray-200 pt-6 text-sm text-gray-500">
          <p>
            Questions? Email{' '}
            <a href="mailto:support@marzi.in" className="font-medium" style={{ color: ACCENT }}>
              support@marzi.in
            </a>
            .
          </p>
          <p className="mt-3 flex gap-5">
            <Link href="/privacy-policy" className="hover:underline">
              Privacy Policy
            </Link>
            <Link href="/account-deletion" className="hover:underline">
              Delete Account
            </Link>
          </p>
          <p className="mt-3 text-gray-400">© 2026 Marzi. All rights reserved.</p>
        </footer>
      </main>
    </div>
  );
}

/** Section heading used inside the legal pages. */
export function H2({ children }: { children: ReactNode }) {
  return <h2 className="text-lg font-semibold text-gray-900">{children}</h2>;
}

/** Body paragraph. */
export function P({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-[15px] leading-relaxed text-gray-700">{children}</p>;
}

/** Bulleted list. */
export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-gray-700 marker:text-gray-400">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}
