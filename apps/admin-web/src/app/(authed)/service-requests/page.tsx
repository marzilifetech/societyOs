'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ClipboardList } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ErrorState } from '@/components/ui/ErrorState';

const STATUSES = ['ALL', 'PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED'] as const;

const STATUS_META: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pending', color: 'bg-blue-100 text-blue-700' },
  ASSIGNED: { label: 'Assigned', color: 'bg-purple-100 text-purple-700' },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-amber-100 text-amber-700' },
  COMPLETED: { label: 'Completed', color: 'bg-green-100 text-green-700' },
  REJECTED: { label: 'Rejected', color: 'bg-red-100 text-red-700' },
  CLOSED: { label: 'Closed', color: 'bg-gray-100 text-gray-600' },
};

const NEXT_STATUS: Record<string, string[]> = {
  PENDING: ['ASSIGNED', 'REJECTED'],
  ASSIGNED: ['IN_PROGRESS'],
  IN_PROGRESS: ['COMPLETED'],
};

function getAgeHours(createdAt: string): number {
  return (Date.now() - new Date(createdAt).getTime()) / 3600000;
}

function AgeBadge({ createdAt }: { createdAt: string }) {
  const age = getAgeHours(createdAt);
  if (age > 96) {
    return (
      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 ml-1.5">
        Critical
      </span>
    );
  }
  if (age > 48) {
    return (
      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 ml-1.5">
        Urgent
      </span>
    );
  }
  return null;
}

function exportCSV(requests: any[]) {
  const headers = ['ID', 'Category', 'Status', 'Resident', 'Unit', 'Created At', 'Age (hours)'];
  const rows = requests.map((sr) => {
    const ageH = getAgeHours(sr.createdAt).toFixed(1);
    return [
      sr.id,
      sr.category,
      sr.status,
      sr.resident?.name ?? '',
      sr.unit?.flatNumber ?? '',
      new Date(sr.createdAt).toISOString(),
      ageH,
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
  });
  const csv = [headers.join(','), ...rows].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `service-requests-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function isDisputed(sr: any): boolean {
  return sr.status === 'COMPLETED' && sr.rating != null && Number(sr.rating) <= 2;
}

export default function ServiceRequestsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<typeof STATUSES[number]>('ALL');
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [selectedStaff, setSelectedStaff] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [disputeId, setDisputeId] = useState<string | null>(null);
  const [disputeNote, setDisputeNote] = useState('');

  // Fetch all for tab counts
  const { data: allRequests } = useQuery({
    queryKey: ['admin-service-requests', 'ALL'],
    queryFn: () => api.get<any[]>('/service-requests'),
  });

  const { data: requests, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-service-requests', status],
    queryFn: () =>
      api.get<any[]>(`/service-requests${status !== 'ALL' ? `?status=${status}` : ''}`),
  });

  const { data: staff } = useQuery({
    queryKey: ['admin-staff'],
    queryFn: () => api.get<any[]>('/admin/staff'),
    enabled: assigningId !== null,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, newStatus }: { id: string; newStatus: string }) =>
      api.patch(`/service-requests/${id}/status`, { status: newStatus }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-service-requests'] });
      toast.success('Status updated');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to update status'),
  });

  const assignMutation = useMutation({
    mutationFn: ({ id, staffId, scheduledTime }: { id: string; staffId: string; scheduledTime?: string }) =>
      api.patch(`/service-requests/${id}/assign`, { staffId, scheduledTime: scheduledTime || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-service-requests'] });
      setAssigningId(null);
      setSelectedStaff('');
      setScheduledTime('');
      toast.success('Staff assigned successfully');
    },
    onError: (err: any) => {
      if ((err as any).code === 'STAFF_OVERLOADED') {
        toast.error(err.message ?? 'Staff member already has 3 or more active assignments. Please choose another staff member.');
      } else {
        toast.error(err?.message ?? 'Failed to assign staff');
      }
    },
  });

  const autoAssignMutation = useMutation({
    mutationFn: (id: string) => api.post(`/service-requests/${id}/auto-assign`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-service-requests'] });
      toast.success('Auto-assigned to available staff');
    },
    onError: (err: any) => toast.error(err?.message ?? 'Auto-assign failed'),
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      api.patch(`/service-requests/${id}/status`, { status: 'CLOSED', adminNote: note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-service-requests'] });
      setDisputeId(null);
      setDisputeNote('');
      toast.success('Dispute resolved');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const countFor = (s: typeof STATUSES[number]) => {
    if (!allRequests) return null;
    if (s === 'ALL') return allRequests.length;
    return allRequests.filter((r) => r.status === s).length;
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Service Requests</h1>
          <p className="text-gray-500 text-sm mt-1">{requests?.length ?? 0} requests</p>
        </div>
        <button
          className="bg-white border border-gray-200 hover:border-gray-300 text-gray-700 text-sm font-medium px-4 py-2 rounded-xl transition-colors"
          onClick={() => requests && exportCSV(requests)}
          disabled={!requests?.length}
        >
          Export CSV
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {STATUSES.map((s) => {
          const count = countFor(s);
          return (
            <button
              key={s}
              className={cn(
                'px-4 py-1.5 rounded-full text-sm font-medium border transition-colors flex items-center gap-1.5',
                status === s
                  ? 'bg-primary-500 border-primary-500 text-white'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300',
              )}
              onClick={() => setStatus(s)}
            >
              {s === 'ALL' ? 'All' : STATUS_META[s]?.label ?? s}
              {count !== null && (
                <span className={cn('text-xs rounded-full px-1.5 py-0.5 font-semibold', status === s ? 'bg-white text-primary-600' : 'bg-gray-100 text-gray-600')}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-gray-400">Loading…</div>
        ) : isError ? (
          <div className="p-6"><ErrorState onRetry={refetch} message="Service requests couldn't be loaded. Your data is safe — please try again." /></div>
        ) : !requests?.length ? (
          <div className="py-16 flex flex-col items-center text-center">
            <ClipboardList className="w-10 h-10 text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No service requests yet</p>
            <p className="text-gray-400 text-sm mt-1">New requests from residents will show up here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto"><table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {['ID', 'Category', 'Resident', 'Unit', 'Status', 'Created / Scheduled', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {requests.map((sr) => {
                const meta = STATUS_META[sr.status] ?? STATUS_META.PENDING;
                const nextActions = NEXT_STATUS[sr.status] ?? [];
                const disputed = isDisputed(sr) || (sr.status === 'IN_PROGRESS' && sr.disputeReason);
                const awaitingConfirm = sr.status === 'COMPLETED' && !sr.confirmedAt;
                return (
                  <tr key={sr.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs text-gray-400 font-mono">
                      #{sr.id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 flex-wrap">
                        <p className="text-sm font-medium text-gray-900">{sr.category}</p>
                        <AgeBadge createdAt={sr.createdAt} />
                        {disputed && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 ml-1">
                            Disputed
                          </span>
                        )}
                        {awaitingConfirm && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 ml-1">
                            Awaiting Confirm
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 truncate max-w-[200px]">{sr.description}</p>
                      {sr.rating != null && (
                        <p className="text-xs text-gray-400 mt-0.5">Rating: {Number(sr.rating).toFixed(1)}/5</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{sr.resident?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{sr.unit?.flatNumber ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', meta.color)}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      <div>{new Date(sr.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
                      {sr.scheduledTime && (
                        <div className="text-primary-600 font-medium mt-0.5">
                          Sched: {new Date(sr.scheduledTime).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                      {sr.preferredTime && !sr.scheduledTime && (
                        <div className="text-gray-400 mt-0.5">Pref: {sr.preferredTime}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5 flex-wrap">
                        {sr.status === 'PENDING' && (
                          <>
                            <button
                              className="text-xs bg-primary-50 hover:bg-primary-100 text-primary-600 px-2.5 py-1 rounded-lg transition-colors"
                              onClick={() => { setAssigningId(sr.id); setSelectedStaff(''); setScheduledTime(''); }}
                            >
                              Assign
                            </button>
                            <button
                              className="text-xs bg-violet-50 hover:bg-violet-100 text-violet-700 px-2.5 py-1 rounded-lg transition-colors"
                              onClick={() => autoAssignMutation.mutate(sr.id)}
                              disabled={autoAssignMutation.isPending}
                            >
                              Auto-Assign
                            </button>
                          </>
                        )}
                        {disputed && (
                          <button
                            className="text-xs bg-orange-50 hover:bg-orange-100 text-orange-700 px-2.5 py-1 rounded-lg transition-colors"
                            onClick={() => { setDisputeId(sr.id); setDisputeNote(''); }}
                          >
                            Resolve Dispute
                          </button>
                        )}
                        {nextActions.map((action) => (
                          <button
                            key={action}
                            className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2.5 py-1 rounded-lg transition-colors"
                            onClick={() => {
                              if (action === 'REJECTED' && !window.confirm('Reject this service request?')) return;
                              updateMutation.mutate({ id: sr.id, newStatus: action });
                            }}
                          >
                            → {STATUS_META[action]?.label ?? action}
                          </button>
                        ))}
                      </div>
                      {assigningId === sr.id && (
                        <div className="mt-2 p-3 bg-gray-50 rounded-lg space-y-2">
                          <select
                            className="w-full text-sm border rounded p-1"
                            value={selectedStaff}
                            onChange={(e) => setSelectedStaff(e.target.value)}
                          >
                            <option value="">Select staff...</option>
                            {staff?.map((s: any) => (
                              <option key={s.id} value={s.id}>
                                {s.user?.name ?? s.designation}
                              </option>
                            ))}
                          </select>
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">Scheduled arrival (optional)</label>
                            <input
                              type="datetime-local"
                              className="w-full text-sm border rounded p-1"
                              value={scheduledTime}
                              onChange={(e) => setScheduledTime(e.target.value)}
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              className="flex-1 text-xs bg-primary-500 text-white py-1.5 rounded font-medium disabled:opacity-50"
                              onClick={() => {
                                if (selectedStaff) {
                                  assignMutation.mutate({ id: sr.id, staffId: selectedStaff, scheduledTime });
                                }
                              }}
                              disabled={!selectedStaff || assignMutation.isPending}
                            >
                              {assignMutation.isPending ? 'Assigning…' : 'Confirm'}
                            </button>
                            <button
                              className="flex-1 text-xs bg-gray-200 text-gray-700 py-1.5 rounded"
                              onClick={() => { setAssigningId(null); setSelectedStaff(''); setScheduledTime(''); }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        )}
      </div>

      {disputeId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-2">Resolve Dispute</h2>
            <p className="text-sm text-gray-500 mb-4">
              Provide an admin resolution note for this disputed service request.
            </p>
            <textarea
              value={disputeNote}
              onChange={(e) => setDisputeNote(e.target.value)}
              rows={4}
              placeholder="Describe how the dispute was resolved..."
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-50 transition-colors mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setDisputeId(null); setDisputeNote(''); }}
                className="flex-1 py-2 border border-gray-200 rounded-xl text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => disputeId && resolveMutation.mutate({ id: disputeId, note: disputeNote })}
                disabled={!disputeNote.trim() || resolveMutation.isPending}
                className="flex-1 py-2 bg-primary-500 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
              >
                {resolveMutation.isPending ? 'Resolving…' : 'Mark Resolved'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
