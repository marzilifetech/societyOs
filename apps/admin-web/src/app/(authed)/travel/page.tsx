'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plane } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ErrorState } from '@/components/ui/ErrorState';

type TravelPauseStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

const STATUS_META: Record<TravelPauseStatus, { label: string; color: string }> = {
  PENDING:   { label: 'Pending',   color: 'bg-amber-100 text-amber-700' },
  ACTIVE:    { label: 'Active',    color: 'bg-green-100 text-green-700' },
  COMPLETED: { label: 'Completed', color: 'bg-blue-100 text-blue-700' },
  CANCELLED: { label: 'Cancelled', color: 'bg-gray-100 text-gray-600' },
};

const FILTER_OPTIONS = ['ALL', 'PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED'] as const;
type FilterOption = typeof FILTER_OPTIONS[number];

type TravelPause = {
  id: string;
  startDate: string;
  returnDate: string;
  actualReturnDate?: string;
  servicesPaused: string[];
  reason?: string;
  status: TravelPauseStatus;
  createdAt: string;
  resident?: {
    user?: { name: string; email: string };
    flat?: { number: string; block: string };
  };
};

function PauseCard({
  pause,
  onApprove,
  onReject,
  loading,
}: {
  pause: TravelPause;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  loading: boolean;
}) {
  const meta = STATUS_META[pause.status] ?? STATUS_META.PENDING;
  const resident = pause.resident;
  const name = resident?.user?.name ?? 'Resident';
  const flat = resident?.flat ? `${resident.flat.block}-${resident.flat.number}` : '—';

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <p className="font-semibold text-gray-900">{name}</p>
          <p className="text-xs text-gray-500 mt-0.5">Flat {flat}</p>
        </div>
        <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full', meta.color)}>
          {meta.label}
        </span>
      </div>

      <div className="flex gap-4 text-sm text-gray-700 mb-3">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Departure</p>
          <p className="font-medium">
            {new Date(pause.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Return</p>
          <p className="font-medium">
            {new Date(pause.returnDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
        {pause.actualReturnDate && (
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Actual Return</p>
            <p className="font-medium text-green-600">
              {new Date(pause.actualReturnDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </p>
          </div>
        )}
      </div>

      {pause.servicesPaused.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {pause.servicesPaused.map((s) => (
            <span key={s} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{s}</span>
          ))}
        </div>
      )}

      {pause.reason && (
        <p className="text-sm text-gray-600 italic mb-3">{pause.reason}</p>
      )}

      {pause.status === 'PENDING' && (
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => onApprove(pause.id)}
            disabled={loading}
            className="flex-1 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-xl py-2 transition disabled:opacity-50"
          >
            Approve
          </button>
          <button
            onClick={() => onReject(pause.id)}
            disabled={loading}
            className="flex-1 bg-white border border-red-300 text-red-600 hover:bg-red-50 text-sm font-semibold rounded-xl py-2 transition disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
}

export default function TravelPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<FilterOption>('ALL');

  const { data: pauses = [], isLoading, isError, refetch } = useQuery<TravelPause[]>({
    queryKey: ['admin-travel-pauses', filter],
    queryFn: () =>
      api.get<TravelPause[]>(
        filter === 'ALL' ? '/admin/travel-pauses' : `/admin/travel-pauses?status=${filter}`,
      ),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/travel-pauses/${id}/approve`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-travel-pauses'] });
      toast.success('Travel pause approved');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to approve'),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/travel-pauses/${id}/reject`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-travel-pauses'] });
      toast.success('Travel pause rejected');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to reject'),
  });

  const pendingCount = pauses.filter((p) => p.status === 'PENDING').length;
  const activeCount = pauses.filter((p) => p.status === 'ACTIVE').length;
  const loading = approveMutation.isPending || rejectMutation.isPending;

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Travel Pauses</h1>
        <p className="text-gray-500 text-sm mt-1">Manage resident travel pause requests</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6 sm:grid-cols-4">
        {[
          { label: 'Pending', value: pendingCount, color: 'text-amber-600' },
          { label: 'Active', value: activeCount, color: 'text-green-600' },
          { label: 'Total', value: pauses.length, color: 'text-gray-900' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
            <p className="text-xs text-gray-500 uppercase tracking-wide">{stat.label}</p>
            <p className={cn('text-2xl font-bold mt-1', stat.color)}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {FILTER_OPTIONS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium border transition',
              filter === f
                ? 'bg-primary-500 text-white border-primary-500'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300',
            )}
          >
            {f === 'ALL' ? 'All' : STATUS_META[f as TravelPauseStatus]?.label ?? f}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : isError ? (
        <ErrorState onRetry={refetch} message="Travel pauses couldn't be loaded. Please try again." />
      ) : pauses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm py-16 flex flex-col items-center justify-center text-center">
          <Plane className="w-10 h-10 text-gray-300 mb-3" />
          <p className="font-medium text-gray-700">No travel pauses yet</p>
          <p className="text-sm text-gray-400 mt-1">Resident travel pause requests will appear here.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {pauses.map((pause) => (
            <PauseCard
              key={pause.id}
              pause={pause}
              onApprove={(id) => approveMutation.mutate(id)}
              onReject={(id) => { if (window.confirm('Reject this travel pause?')) rejectMutation.mutate(id); }}
              loading={loading}
            />
          ))}
        </div>
      )}
    </div>
  );
}
