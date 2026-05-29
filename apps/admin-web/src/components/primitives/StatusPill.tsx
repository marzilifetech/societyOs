import type { ReactNode } from 'react';
import { cn } from './cn';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const tones: Record<Tone, string> = {
  // Lower-saturation than typical badge libraries — reads as data, not decoration.
  neutral: 'bg-gray-100 text-gray-700 ring-gray-200',
  success: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-800 ring-amber-200',
  danger: 'bg-red-50 text-red-700 ring-red-200',
  info: 'bg-blue-50 text-blue-800 ring-blue-200',
};

export interface StatusPillProps {
  tone?: Tone;
  children: ReactNode;
  dot?: boolean;
  className?: string;
}

export function StatusPill({ tone = 'neutral', children, dot, className }: StatusPillProps) {
  const dotColor: Record<Tone, string> = {
    neutral: 'bg-gray-400',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-red-500',
    info: 'bg-blue-500',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-[11px] font-medium leading-none',
        'px-2 py-1 rounded-full ring-1 ring-inset',
        tones[tone],
        className,
      )}
    >
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full', dotColor[tone])} />}
      {children}
    </span>
  );
}

export function SocietyStatusPill({ status }: { status: string }) {
  if (status === 'ACTIVE') return <StatusPill tone="success" dot>Active</StatusPill>;
  if (status === 'SUSPENDED') return <StatusPill tone="warning" dot>Suspended</StatusPill>;
  if (status === 'ARCHIVED') return <StatusPill tone="neutral">Archived</StatusPill>;
  return <StatusPill>{status}</StatusPill>;
}
