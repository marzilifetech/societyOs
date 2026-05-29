import type { HTMLAttributes, ReactNode, ThHTMLAttributes, TdHTMLAttributes } from 'react';
import { cn } from './cn';

export function Table({ className, children, ...rest }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className={cn('w-full text-sm', className)} {...rest}>
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-gray-50/80 text-[12px] uppercase tracking-wide text-gray-500">
      {children}
    </thead>
  );
}

export function TH({ className, children, ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn('text-left font-medium px-4 py-2.5 first:pl-5 last:pr-5', className)}
      {...rest}
    >
      {children}
    </th>
  );
}

export function TR({ className, children, ...rest }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        'border-t border-gray-100 hover:bg-gray-50/60 transition-colors',
        className,
      )}
      {...rest}
    >
      {children}
    </tr>
  );
}

export function TD({ className, children, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn('px-4 py-3 first:pl-5 last:pr-5', className)} {...rest}>
      {children}
    </td>
  );
}
