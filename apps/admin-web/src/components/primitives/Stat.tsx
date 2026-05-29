import type { ReactNode } from 'react';
import { cn } from './cn';

export interface StatProps {
  label: string;
  value: ReactNode;
  hint?: string;
  trend?: { value: string; direction?: 'up' | 'down' | 'flat' };
  className?: string;
}

export function Stat({ label, value, hint, trend, className }: StatProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-gray-200 px-5 py-4 flex flex-col gap-1',
        className,
      )}
    >
      <span className="text-[12px] font-medium text-gray-500 uppercase tracking-wide">
        {label}
      </span>
      <span className="text-[28px] font-semibold tracking-tight text-gray-950 tabular-nums leading-none mt-1">
        {value}
      </span>
      {(hint || trend) && (
        <div className="flex items-center gap-2 mt-1">
          {trend && (
            <span
              className={cn(
                'text-[12px] font-medium',
                trend.direction === 'up' && 'text-emerald-700',
                trend.direction === 'down' && 'text-red-600',
                (!trend.direction || trend.direction === 'flat') && 'text-gray-500',
              )}
            >
              {trend.value}
            </span>
          )}
          {hint && <span className="text-[12px] text-gray-500">{hint}</span>}
        </div>
      )}
    </div>
  );
}
