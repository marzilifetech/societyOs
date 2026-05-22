import * as React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
}

export function Card({ children, className = '', padding = true }: CardProps) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm ${padding ? 'p-6' : ''} ${className}`}>
      {children}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: string;
  color?: string;
}

export function StatCard({ label, value, icon, color = 'bg-primary-50 text-primary-600' }: StatCardProps) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500">{label}</p>
        {icon && (
          <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg ${color}`}>
            {icon}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </Card>
  );
}
