'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { ChevronLeft, Home, Stethoscope, HeartPulse } from 'lucide-react';
import { cn } from '@/components/primitives';

/**
 * Mobile-first app bar. `back` shows a chevron that pops the router; `right`
 * renders an optional trailing action. Sticky so it stays put while the page
 * scrolls under it.
 */
export function CareHeader({
  title,
  subtitle,
  back = false,
  right,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  right?: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-gray-100">
      <div className="h-14 px-4 flex items-center gap-3">
        {back && (
          <button
            onClick={() => router.back()}
            aria-label="Back"
            // Circular bordered chevron — mirrors the native app's back button
            // (40px white circle, hairline border) so the portal feels identical.
            className="-ml-1 w-10 h-10 shrink-0 rounded-full bg-white border border-black/[0.07] shadow-sm flex items-center justify-center text-gray-900 active:bg-gray-50 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-[16px] font-semibold text-gray-950 truncate leading-tight">{title}</h1>
          {subtitle && <p className="text-[12px] text-gray-500 truncate">{subtitle}</p>}
        </div>
        {right}
      </div>
    </header>
  );
}

const TABS = [
  { href: '/care', label: 'Home', icon: Home, match: (p: string) => p === '/care' },
  { href: '/care/medical', label: 'Medical', icon: Stethoscope, match: (p: string) => p.startsWith('/care/medical') },
  { href: '/care/health', label: 'Health', icon: HeartPulse, match: (p: string) => p.startsWith('/care/health') },
];

/** Fixed bottom tab bar. Mounted by the care layout on the main sections. */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-20 mx-auto max-w-md bg-white border-t border-gray-100 pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-3">
        {TABS.map((t) => {
          const active = t.match(pathname);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                className={cn(
                  'flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors',
                  active ? 'text-primary-700' : 'text-gray-400 hover:text-gray-600',
                )}
              >
                <t.icon className="w-5 h-5" />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Consistent page scroll region that clears the bottom nav. */
export function CareBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <main className={cn('px-4 pt-4 pb-28', className)}>{children}</main>;
}
