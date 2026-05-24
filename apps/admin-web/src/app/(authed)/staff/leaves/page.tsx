'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ErrorState } from '@/components/ui/ErrorState';

type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

type LeaveRequest = {
  id: string;
  leaveType: string;
  fromDate: string;
  toDate: string;
  reason: string;
  status: LeaveStatus;
  adminNote?: string;
  staff: { id: string; name: string; role: string };
  staffId?: string;
  createdAt: string;
};

type TabFilter = 'ALL' | LeaveStatus;

const TABS: Array<{ key: TabFilter; label: string }> = [
  { key: 'ALL', label: 'All' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'REJECTED', label: 'Rejected' },
];

const STATUS_META: Record<LeaveStatus, { label: string; color: string }> = {
  PENDING:  { label: 'Pending',  color: 'bg-amber-100 text-amber-700' },
  APPROVED: { label: 'Approved', color: 'bg-green-100 text-green-700' },
  REJECTED: { label: 'Rejected', color: 'bg-red-100 text-red-700' },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function StaffLeavesPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabFilter>('ALL');

  const { data: leaves, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-leaves'],
    queryFn: () => api.get<LeaveRequest[]>('/admin/leaves'),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/leaves/${id}/approve`, {}),
    onSuccess: () => {
      toast.success('Leave approved');
      qc.invalidateQueries({ queryKey: ['admin-leaves'] });
    },
    onError: (err: any) => toast.error(err?.message ?? 'Failed to approve leave'),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/leaves/${id}/reject`, {}),
    onSuccess: () => {
      toast.success('Leave rejected');
      qc.invalidateQueries({ queryKey: ['admin-leaves'] });
    },
    onError: (err: any) => toast.error(err?.message ?? 'Failed to reject leave'),
  });

  const dismissMutation = useMutation({
    mutationFn: (staffId: string) => api.patch(`/admin/staff/${staffId}/dismiss`, {}),
    onSuccess: () => {
      toast.success('Staff marked as left society');
      qc.invalidateQueries({ queryKey: ['admin-leaves'] });
    },
    onError: (err: any) => toast.error(err?.message ?? 'Failed to dismiss staff'),
  });

  const handleApprove = (id: string, staffName: string) => {
    if (!window.confirm(`Approve leave request for ${staffName}?`)) return;
    approveMutation.mutate(id);
  };

  const handleReject = (id: string, staffName: string) => {
    if (!window.confirm(`Reject leave request for ${staffName}?`)) return;
    rejectMutation.mutate(id);
  };

  const handleDismiss = (staffId: string, staffName: string) => {
    if (!window.confirm(`Mark ${staffName} as left society? This will set today as their leaving date and suspend their account.`)) return;
    dismissMutation.mutate(staffId);
  };

  const isResignationType = (leaveType: string) =>
    ['RESIGNATION', 'TERMINATION', 'EMERGENCY', 'LEAVE_REQUESTED'].includes(leaveType?.toUpperCase());

  const filtered = (leaves ?? []).filter((l) => tab === 'ALL' || l.status === tab);

  const countFor = (key: TabFilter) => {
    if (!leaves) return 0;
    if (key === 'ALL') return leaves.length;
    return leaves.filter((l) => l.status === key).length;
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Staff Leave Requests</h1>
        <p className="text-gray-500 text-sm mt-1">{leaves?.length ?? 0} total</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map(({ key, label }) => {
          const count = countFor(key);
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                'px-4 py-1.5 rounded-full text-sm font-medium border transition-colors flex items-center gap-1.5',
                tab === key
                  ? 'bg-primary-500 border-primary-500 text-white'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300',
              )}
            >
              {label}
              <span className={cn(
                'text-xs rounded-full px-1.5 py-0.5 font-semibold',
                tab === key ? 'bg-white text-primary-600' : 'bg-gray-100 text-gray-600',
              )}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState onRetry={refetch} message="Leave requests couldn't be loaded. Please try again." />
      ) : !filtered.length ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-gray-100 shadow-sm">
          <CalendarDays className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No leave requests yet</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-50">
                {['Staff Name', 'Role', 'Leave Type', 'From Date', 'To Date', 'Reason', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((leave) => {
                const meta = STATUS_META[leave.status];
                const isPending = leave.status === 'PENDING';
                const isMutating = approveMutation.isPending || rejectMutation.isPending || dismissMutation.isPending;
                return (
                  <tr key={leave.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                          <span className="text-primary-600 text-xs font-semibold">
                            {leave.staff.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <span className="font-medium text-gray-900">{leave.staff.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-xs capitalize">{leave.staff.role ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-700 capitalize">{leave.leaveType?.toLowerCase().replace('_', ' ') ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-600 text-xs whitespace-nowrap">{formatDate(leave.fromDate)}</td>
                    <td className="px-5 py-3 text-gray-600 text-xs whitespace-nowrap">{formatDate(leave.toDate)}</td>
                    <td className="px-5 py-3 text-gray-600 max-w-xs">
                      <p className="truncate" title={leave.reason}>{leave.reason || '—'}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', meta.color)}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-col gap-1.5">
                        {isPending && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleApprove(leave.id, leave.staff.name)}
                              disabled={isMutating}
                              className="text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleReject(leave.id, leave.staff.name)}
                              disabled={isMutating}
                              className="text-xs bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                        {isResignationType(leave.leaveType) && (leave.staff.id || leave.staffId) && (
                          <button
                            onClick={() => handleDismiss((leave.staff.id || leave.staffId)!, leave.staff.name)}
                            disabled={dismissMutation.isPending}
                            className="text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
                          >
                            Mark as Left Society
                          </button>
                        )}
                        {!isPending && leave.adminNote && (
                          <p className="text-xs text-gray-400 truncate max-w-[120px]" title={leave.adminNote}>
                            {leave.adminNote}
                          </p>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
