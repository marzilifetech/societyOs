'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ConciergeBell } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ErrorState } from '@/components/ui/ErrorState';

type ConciergeRequest = {
  id: string;
  type: string;
  description?: string;
  status: string;
  note?: string;
  createdAt: string;
  resident?: { user?: { name?: string }; flat?: { flatNumber?: string } };
};

const STATUSES = ['ALL', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;

const STATUS_META: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pending', color: 'bg-amber-100 text-amber-700' },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-blue-100 text-blue-700' },
  COMPLETED: { label: 'Completed', color: 'bg-green-100 text-green-700' },
  CANCELLED: { label: 'Cancelled', color: 'bg-gray-100 text-gray-600' },
};

export default function ConciergeRequestsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<typeof STATUSES[number]>('ALL');
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState('');

  const { data: allRequests } = useQuery({
    queryKey: ['admin-concierge', 'ALL'],
    queryFn: () => api.get<ConciergeRequest[]>('/concierge/admin/requests'),
  });

  const { data: requests, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-concierge', status],
    queryFn: () =>
      api.get<ConciergeRequest[]>(
        `/concierge/admin/requests${status !== 'ALL' ? `?status=${status}` : ''}`,
      ),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, newStatus, note }: { id: string; newStatus: string; note?: string }) =>
      api.patch(`/concierge/admin/requests/${id}/status`, {
        status: newStatus,
        ...(note ? { note } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-concierge'] });
      toast.success('Status updated');
      setCompletingId(null);
      setNoteInput('');
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to update status');
    },
  });

  const countFor = (s: typeof STATUSES[number]) => {
    if (!allRequests) return null;
    if (s === 'ALL') return allRequests.length;
    return allRequests.filter((r) => r.status === s).length;
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Concierge Requests</h1>
        <p className="text-gray-500 text-sm mt-1">Manage resident concierge service requests</p>
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

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden overflow-x-auto">
        {isLoading ? (
          <div className="py-16 text-center text-gray-400">Loading…</div>
        ) : isError ? (
          <ErrorState
            onRetry={refetch}
            message="Concierge requests couldn't be loaded. Your data is safe — please try again."
          />
        ) : !requests?.length ? (
          <div className="py-16 flex flex-col items-center justify-center text-center">
            <ConciergeBell className="w-10 h-10 text-gray-300 mb-3" />
            <p className="font-medium text-gray-700">No concierge requests yet</p>
            <p className="text-sm text-gray-400 mt-1">Resident concierge requests will appear here.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {['Resident', 'Flat', 'Type', 'Description', 'Status', 'Date', 'Actions'].map(
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
              {requests.map((req) => {
                const meta = STATUS_META[req.status] ?? STATUS_META.PENDING;
                return (
                  <tr key={req.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {req.resident?.user?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {req.resident?.flat?.flatNumber ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{req.type}</td>
                    <td className="px-4 py-3 text-sm text-gray-400 max-w-[200px] truncate">
                      {req.description ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn('text-xs font-medium px-2.5 py-1 rounded-full', meta.color)}
                      >
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {new Date(req.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex gap-1.5">
                          {req.status === 'PENDING' && (
                            <button
                              className="text-xs bg-primary-50 hover:bg-primary-100 text-primary-600 px-2.5 py-1 rounded-lg transition-colors"
                              onClick={() =>
                                updateMutation.mutate({ id: req.id, newStatus: 'IN_PROGRESS' })
                              }
                              disabled={updateMutation.isPending}
                            >
                              Start
                            </button>
                          )}
                          {req.status === 'IN_PROGRESS' && completingId !== req.id && (
                            <button
                              className="text-xs bg-green-50 hover:bg-green-100 text-green-700 px-2.5 py-1 rounded-lg transition-colors"
                              onClick={() => {
                                setCompletingId(req.id);
                                setNoteInput('');
                              }}
                            >
                              Complete
                            </button>
                          )}
                        </div>
                        {completingId === req.id && (
                          <div className="flex flex-col gap-1.5">
                            <input
                              type="text"
                              value={noteInput}
                              onChange={(e) => setNoteInput(e.target.value)}
                              placeholder="Add a note (optional)…"
                              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-primary-400 w-48"
                            />
                            <div className="flex gap-1.5">
                              <button
                                className="text-xs bg-primary-500 hover:bg-primary-600 text-white px-2.5 py-1 rounded-lg transition-colors"
                                onClick={() =>
                                  updateMutation.mutate({
                                    id: req.id,
                                    newStatus: 'COMPLETED',
                                    note: noteInput || undefined,
                                  })
                                }
                                disabled={updateMutation.isPending}
                              >
                                Confirm
                              </button>
                              <button
                                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2.5 py-1 rounded-lg transition-colors"
                                onClick={() => setCompletingId(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
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
