'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Shirt } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ErrorState } from '@/components/ui/ErrorState';

type LaundryBooking = {
  id: string;
  date: string;
  timeSlot: string;
  type: string;
  status: string;
  createdAt: string;
  resident?: { user?: { name?: string }; flat?: { flatNumber?: string } };
};

const STATUSES = ['ALL', 'PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] as const;

const STATUS_META: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pending', color: 'bg-amber-100 text-amber-700' },
  CONFIRMED: { label: 'Confirmed', color: 'bg-blue-100 text-blue-700' },
  COMPLETED: { label: 'Completed', color: 'bg-green-100 text-green-700' },
  CANCELLED: { label: 'Cancelled', color: 'bg-gray-100 text-gray-600' },
};

export default function LaundryBookingsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<typeof STATUSES[number]>('ALL');
  const [dateFilter, setDateFilter] = useState('');

  const buildQuery = (s: typeof STATUSES[number], date: string) => {
    const params = new URLSearchParams();
    if (s !== 'ALL') params.set('status', s);
    if (date) params.set('date', date);
    const qs = params.toString();
    return `/laundry/admin/laundry/bookings${qs ? `?${qs}` : ''}`;
  };

  const { data: allBookings } = useQuery({
    queryKey: ['admin-laundry', 'ALL', ''],
    queryFn: () => api.get<LaundryBooking[]>('/laundry/admin/laundry/bookings'),
  });

  const { data: bookings, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-laundry', status, dateFilter],
    queryFn: () => api.get<LaundryBooking[]>(buildQuery(status, dateFilter)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, newStatus }: { id: string; newStatus: string }) =>
      api.patch(`/laundry/admin/laundry/bookings/${id}/status`, { status: newStatus }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-laundry'] });
      toast.success('Status updated');
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to update status');
    },
  });

  const countFor = (s: typeof STATUSES[number]) => {
    if (!allBookings) return null;
    if (s === 'ALL') return allBookings.length;
    return allBookings.filter((b) => b.status === s).length;
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Laundry Bookings</h1>
        <p className="text-gray-500 text-sm mt-1">Manage laundry slot bookings</p>
      </div>

      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-xl px-3 py-1.5 outline-none focus:border-primary-400"
        />
        {dateFilter && (
          <button
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            onClick={() => setDateFilter('')}
          >
            Clear date
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {STATUSES.map((s) => {
          const count = countFor(s);
          return (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={cn(
                'px-4 py-1.5 rounded-full text-sm font-medium border transition-colors flex items-center gap-1.5',
                status === s
                  ? 'bg-primary-500 border-primary-500 text-white'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300',
              )}
            >
              {s === 'ALL' ? 'All' : STATUS_META[s]?.label ?? s}
              {count !== null && (
                <span
                  className={cn(
                    'text-xs rounded-full px-1.5 py-0.5 font-semibold',
                    status === s ? 'bg-white text-primary-600' : 'bg-gray-100 text-gray-600',
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
        {isLoading ? (
          <div className="py-16 text-center text-gray-400">Loading…</div>
        ) : isError ? (
          <ErrorState
            onRetry={refetch}
            message="Laundry bookings couldn't be loaded. Your data is safe — please try again."
          />
        ) : !bookings?.length ? (
          <div className="py-16 text-center">
            <Shirt className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="font-medium text-gray-700">No laundry bookings</p>
            <p className="text-sm text-gray-400 mt-1">Resident bookings will appear here as they&apos;re scheduled.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {['Resident', 'Flat', 'Date', 'Time Slot', 'Type', 'Status', 'Actions'].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {bookings.map((booking) => {
                const meta = STATUS_META[booking.status] ?? STATUS_META.PENDING;
                return (
                  <tr key={booking.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {booking.resident?.user?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {booking.resident?.flat?.flatNumber ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {new Date(booking.date).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{booking.timeSlot}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{booking.type}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn('text-xs font-medium px-2.5 py-1 rounded-full', meta.color)}
                      >
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        {booking.status === 'PENDING' && (
                          <button
                            className="text-xs bg-primary-50 hover:bg-primary-100 text-primary-600 px-2.5 py-1 rounded-lg transition-colors"
                            onClick={() =>
                              updateMutation.mutate({ id: booking.id, newStatus: 'CONFIRMED' })
                            }
                            disabled={updateMutation.isPending}
                          >
                            Confirm
                          </button>
                        )}
                        {booking.status === 'CONFIRMED' && (
                          <button
                            className="text-xs bg-green-50 hover:bg-green-100 text-green-700 px-2.5 py-1 rounded-lg transition-colors"
                            onClick={() =>
                              updateMutation.mutate({ id: booking.id, newStatus: 'COMPLETED' })
                            }
                            disabled={updateMutation.isPending}
                          >
                            Complete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
