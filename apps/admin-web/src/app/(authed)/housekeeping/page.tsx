'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ErrorState } from '@/components/ui/ErrorState';

type HousekeepingBooking = {
  id: string;
  type: string;
  scheduledDate: string;
  status: string;
  staffId?: string;
  staffName?: string;
  resident?: { name: string; unit?: { flatNumber: string } };
};

type HKStatus = 'ALL' | 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED';

const STATUSES: HKStatus[] = ['ALL', 'PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED'];

const STATUS_META: Record<string, { label: string; color: string }> = {
  PENDING:     { label: 'Pending',     color: 'bg-amber-100 text-amber-700' },
  CONFIRMED:   { label: 'Confirmed',   color: 'bg-blue-100 text-blue-700' },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-purple-100 text-purple-700' },
  COMPLETED:   { label: 'Completed',   color: 'bg-green-100 text-green-700' },
  CANCELLED:   { label: 'Cancelled',   color: 'bg-gray-100 text-gray-600' },
};

function AssignModal({
  booking,
  onClose,
}: {
  booking: HousekeepingBooking;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [staffName, setStaffName] = useState(booking.staffName ?? '');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const mutation = useMutation({
    mutationFn: ({ status, staffId }: { status: string; staffId?: string }) =>
      api.patch(`/housekeeping/${booking.id}/status`, { status, ...(staffId ? { staffId } : {}) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['housekeeping'] });
      toast.success('Staff assigned');
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = staffName.trim();
    mutation.mutate({ status: 'CONFIRMED', staffId: trimmed || undefined });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold text-gray-900 mb-1">Assign Staff</h2>
        <p className="text-xs text-gray-500 mb-4">
          {booking.resident?.name} · {booking.resident?.unit?.flatNumber} · {booking.type}
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Staff Name / ID</label>
            <input
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
              placeholder="Enter staff name or ID"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary-400"
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 bg-primary-500 hover:bg-primary-600 text-white py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-60"
            >
              {mutation.isPending ? 'Assigning…' : 'Confirm & Assign'}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function HousekeepingPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<HKStatus>('ALL');
  const [page, setPage] = useState(1);
  const [assignTarget, setAssignTarget] = useState<HousekeepingBooking | null>(null);

  const buildQuery = (s: HKStatus, p: number) => {
    const params = new URLSearchParams();
    if (s !== 'ALL') params.set('status', s);
    params.set('page', String(p));
    return `/housekeeping?${params.toString()}`;
  };

  const { data: allBookings } = useQuery({
    queryKey: ['housekeeping', 'ALL', 1],
    queryFn: () => api.get<HousekeepingBooking[]>('/housekeeping'),
  });

  const { data: bookings, isLoading, isError, refetch } = useQuery({
    queryKey: ['housekeeping', statusFilter, page],
    queryFn: () => api.get<HousekeepingBooking[]>(buildQuery(statusFilter, page)),
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/housekeeping/${id}/status`, { status: 'COMPLETED' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['housekeeping'] });
      toast.success('Marked as completed');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const countFor = (s: HKStatus) => {
    if (!allBookings) return null;
    if (s === 'ALL') return allBookings.length;
    return allBookings.filter((b) => b.status === s).length;
  };

  const statsKeys: Exclude<HKStatus, 'ALL'>[] = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED'];

  return (
    <div className="p-6 lg:p-8">
      {assignTarget && (
        <AssignModal booking={assignTarget} onClose={() => setAssignTarget(null)} />
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Housekeeping</h1>
        <p className="text-gray-500 text-sm mt-1">Manage housekeeping schedules and staff assignments</p>
      </div>

      {/* Stats row */}
      {allBookings && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          {statsKeys.map((s) => {
            const meta = STATUS_META[s];
            const count = countFor(s) ?? 0;
            return (
              <div key={s} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <p className="text-xs text-gray-500 font-medium mb-1">{meta.label}</p>
                <p className="text-2xl font-bold text-gray-900">{count}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {STATUSES.map((s) => {
          const count = countFor(s);
          return (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={cn(
                'px-4 py-1.5 rounded-full text-sm font-medium border transition-colors flex items-center gap-1.5',
                statusFilter === s
                  ? 'bg-primary-500 border-primary-500 text-white'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300',
              )}
            >
              {s === 'ALL' ? 'All' : STATUS_META[s]?.label ?? s}
              {count !== null && (
                <span className={cn('text-xs rounded-full px-1.5 py-0.5 font-semibold',
                  statusFilter === s ? 'bg-white text-primary-600' : 'bg-gray-100 text-gray-600')}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-2xl" />)}
        </div>
      ) : isError ? (
        <ErrorState onRetry={refetch} message="Bookings couldn't be loaded. Please try again." />
      ) : !bookings?.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 flex flex-col items-center justify-center text-center">
          <Sparkles className="w-10 h-10 text-gray-300 mb-3" />
          <p className="font-medium text-gray-700">No housekeeping bookings</p>
          <p className="text-sm text-gray-400 mt-1">Resident bookings will appear here as they come in.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Resident</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Type</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Scheduled</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Status</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Assigned Staff</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => {
                const meta = STATUS_META[b.status] ?? { label: b.status, color: 'bg-gray-100 text-gray-600' };
                return (
                  <tr key={b.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900">{b.resident?.name ?? '—'}</p>
                      <p className="text-xs text-gray-400">{b.resident?.unit?.flatNumber ?? ''}</p>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{b.type}</td>
                    <td className="px-5 py-3 text-gray-600 text-xs">
                      {new Date(b.scheduledDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-3">
                      <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', meta.color)}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{b.staffName ?? '—'}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {b.status !== 'COMPLETED' && b.status !== 'CANCELLED' && (
                          <button
                            onClick={() => setAssignTarget(b)}
                            className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            Assign Staff
                          </button>
                        )}
                        {(b.status === 'CONFIRMED' || b.status === 'IN_PROGRESS') && (
                          <button
                            onClick={() => { if (window.confirm('Mark this booking as completed?')) completeMutation.mutate(b.id); }}
                            disabled={completeMutation.isPending}
                            className="text-xs bg-green-50 hover:bg-green-100 text-green-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
                          >
                            {completeMutation.isPending ? 'Saving…' : 'Mark Complete'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-50">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="text-xs text-gray-600 hover:text-gray-900 disabled:opacity-40 px-3 py-1.5 border border-gray-200 rounded-lg"
            >
              Previous
            </button>
            <span className="text-xs text-gray-500">Page {page}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              className="text-xs text-gray-600 hover:text-gray-900 px-3 py-1.5 border border-gray-200 rounded-lg"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
