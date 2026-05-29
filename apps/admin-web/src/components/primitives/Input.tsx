import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  leadingIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid, leadingIcon, className, ...rest },
  ref,
) {
  const ring = invalid
    ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
    : 'border-gray-300 focus:border-gray-900 focus:ring-gray-200';
  return (
    <div className="relative">
      {leadingIcon && (
        <span className="absolute inset-y-0 left-2.5 flex items-center text-gray-400 pointer-events-none">
          {leadingIcon}
        </span>
      )}
      <input
        ref={ref}
        className={cn(
          'w-full h-9 rounded-lg border bg-white text-sm text-gray-900 placeholder:text-gray-400',
          'px-3 outline-none transition-colors',
          'focus:ring-4 disabled:bg-gray-50 disabled:text-gray-500',
          !!leadingIcon && 'pl-8',
          ring,
          className,
        )}
        {...rest}
      />
    </div>
  );
});

export interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}

export function Field({ label, hint, error, required, children }: FieldProps) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-gray-800 flex items-center gap-1">
        {label}
        {required && <span className="text-red-500">*</span>}
      </span>
      {children}
      {error ? (
        <span className="text-[12px] text-red-600">{error}</span>
      ) : hint ? (
        <span className="text-[12px] text-gray-500">{hint}</span>
      ) : null}
    </label>
  );
}

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ invalid, className, ...rest }, ref) {
    const ring = invalid
      ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
      : 'border-gray-300 focus:border-gray-900 focus:ring-gray-200';
    return (
      <textarea
        ref={ref}
        className={cn(
          'w-full rounded-lg border bg-white text-sm text-gray-900 placeholder:text-gray-400',
          'px-3 py-2 outline-none transition-colors focus:ring-4 resize-y min-h-[80px]',
          ring,
          className,
        )}
        {...rest}
      />
    );
  },
);
