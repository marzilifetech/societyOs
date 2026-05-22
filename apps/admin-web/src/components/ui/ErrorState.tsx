'use client';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/cn';

interface Props {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({ message, onRetry, className }: Props) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-6 text-center', className)}>
      <AlertTriangle className="w-10 h-10 text-amber-500 mb-4" />
      <p className="text-gray-700 text-base mb-2 max-w-sm leading-relaxed">
        {message ?? "Something didn't load. Your data is safe — please try again."}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-xl font-medium transition-colors"
        >
          Try Again
        </button>
      )}
      <p className="mt-4 text-gray-400 text-sm">
        If this keeps happening, please contact technical support.
      </p>
    </div>
  );
}
