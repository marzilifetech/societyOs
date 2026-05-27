import type { ReactNode } from 'react';
import { cn } from './cn';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        'py-12 px-6 bg-white rounded-xl border border-dashed border-gray-300',
        className,
      )}
    >
      {icon && (
        <div className="w-10 h-10 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center mb-3">
          {icon}
        </div>
      )}
      <h3 className="text-[14px] font-semibold text-gray-900">{title}</h3>
      {description && (
        <p className="text-[13px] text-gray-500 mt-1 max-w-sm">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
