'use client';

import { Fragment, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, HardHat, CalendarDays } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ErrorState } from '@/components/ui/ErrorState';
import type { StaffUser, LeaveRequest, LeaveStatus } from '@societyos/api-client';

const DEPT_COLORS: Record<string, string> = {
  SECURITY: 'bg-blue-100 text-blue-700',
  HOUSEKEEPING: 'bg-green-100 text-green-700',
  MAINTENANCE: 'bg-amber-100 text-amber-700',
  ADMIN: 'bg-purple-100 text-purple-700',
  MEDICAL: 'bg-red-100 text-red-700',
};

const LEAVE_META: Record<LeaveStatus, { label: string; color: string }> = {
  PENDING: { label: 'Pending', color: 'bg-amber-100 text-amber-700' },
  APPROVED: { label: 'Approved', color: 'bg-green-100 text-green-700' },
  REJECTED: { label: 'Rejected', color: 'bg-red-100 text-red-700' },
  CANCELLED: { label: 'Cancelled', color: 'bg-gray-100 text-gray-600' },
};

type LeaveFilterTab = 'All' | 'PENDING' | 'APPROVED' | 'REJECTED';

type LeaveWithStaff = LeaveRequest & { staff?: Pick<StaffUser, 'name' | 'role'> };

type StaffDetail = StaffUser & {
  designation?: string;
  categories?: string[];
  joiningDate?: string;
  salary?: number;
};

function StaffDrawer({ staffId }: { staffId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-staff', staffId],
    queryFn: () => api.get<StaffDetail>(`/admin/staff/${staffId}`),
  });

  if (isLoading) {
    return (
      <tr>
        <td colSpan={6} className="px-4 py-3 bg-gray-50 text-sm text-gray-400 text-center">
          Loading…
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td colSpan={6} className="px-4 py-4 bg-gray-50 border-b border-gray-100">
        <div className="flex flex-wrap gap-6 text-sm">
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Designation</p>
            <p className="text-gray-900">{data?.designation || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Categories</p>
            <div className="flex flex-wrap gap-1 mt-0.5">
              {data?.categories?.length
                ? data.categories.map((cat) => (
                    <span
                      key={cat}
                      className={cn('text-xs px-2 py-0.5 rounded-full font-medium', DEPT_COLORS[cat] ?? 'bg-gray-100 text-gray-600')}
                    >
                      {cat}
                    </span>
                  ))
                : <span className="text-gray-400">—</span>}
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Joining Date</p>
            <p className="text-gray-900">
              {data?.joiningDate
                ? new Date(data.joiningDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Monthly Salary</p>
            <p className="text-gray-900">{data?.salary != null ? `₹${data.salary.toLocaleString('en-IN')}` : '—'}</p>
          </div>
        </div>
      </td>
    </tr>
  );
}

export default function StaffPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [leaveFilterTab, setLeaveFilterTab] = useState<LeaveFilterTab>('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: staff, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-staff'],
    queryFn: () => api.get<StaffDetail[]>('/admin/staff'),
  });

  const { data: allLeaves } = useQuery({
    queryKey: ['admin-leaves-all'],
    queryFn: () => api.get<LeaveWithStaff[]>('/admin/leaves'),
  });

  const leaveActionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'reject' }) =>
      api.patch(`/admin/leaves/${id}/${action}`, {}),
    onSuccess: (_, { action }) => {
      qc.invalidateQueries({ queryKey: ['admin-leaves-pending'] });
      qc.invalidateQueries({ queryKey: ['admin-leaves-all'] });
      toast.success(action === 'approve' ? 'Leave approved.' : 'Leave rejected.');
    },
    onError: (err: Error & { code?: string }) => {
      if (err.code === 'LEAVE_ALREADY_DECIDED') {
        toast.error(`${err.message} Refresh the page if the list looks out of date.`);
        qc.invalidateQueries({ queryKey: ['admin-leaves-pending'] });
        qc.invalidateQueries({ queryKey: ['admin-leaves-all'] });
        return;
      }
      toast.error(err.code ? `${err.message} (${err.code})` : err.message);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/staff/${id}/deactivate`, {}),
    onSuccess: () => {
      toast.success('Staff member deactivated');
      qc.invalidateQueries({ queryKey: ['admin-staff'] });
    },
    onError: (err: any) => toast.error(err?.message ?? 'Failed to deactivate staff'),
  });

  const leaveCounts: Record<LeaveFilterTab, number> = {
    All: allLeaves?.length ?? 0,
    PENDING: allLeaves?.filter(l => l.status === 'PENDING').length ?? 0,
    APPROVED: allLeaves?.filter(l => l.status === 'APPROVED').length ?? 0,
    REJECTED: allLeaves?.filter(l => l.status === 'REJECTED').length ?? 0,
  };

  const displayedLeaves = leaveFilterTab === 'All'
    ? (allLeaves ?? [])
    : (allLeaves?.filter(l => l.status === leaveFilterTab) ?? []);

  const handleRowClick = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  const handleDeactivate = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to deactivate this staff member?')) return;
    deactivateMutation.mutate(id);
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Staff</h1>
            <p className="text-gray-500 text-sm mt-1">{staff?.length ?? 0} staff members</p>
          </div>
          <button
            onClick={() => router.push('/staff/add')}
            className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-xl text-sm font-medium inline-flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Staff
          </button>
        </div>
      </div>

      {/* Leave requests with filter tabs */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Leave Requests
        </h2>
        {/* Filter tabs */}
        <div className="flex gap-2 mb-3 flex-wrap">
          {(['All', 'PENDING', 'APPROVED', 'REJECTED'] as LeaveFilterTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setLeaveFilterTab(tab)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium border transition-colors flex items-center gap-1.5',
                leaveFilterTab === tab
                  ? 'bg-primary-500 border-primary-500 text-white'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300',
              )}
            >
              {tab === 'All' ? 'All' : LEAVE_META[tab as LeaveStatus]?.label ?? tab}
              <span className={cn('text-xs rounded-full px-1.5 py-0.5', leaveFilterTab === tab ? 'bg-white text-primary-600' : 'bg-gray-100 text-gray-600')}>
                {leaveCounts[tab]}
              </span>
            </button>
          ))}
        </div>

        {displayedLeaves.length > 0 ? (
          <div className="space-y-3">
            {displayedLeaves.map((leave) => {
              const dayCount = Math.ceil(
                (new Date(leave.toDate).getTime() - new Date(leave.fromDate).getTime()) / (1000 * 60 * 60 * 24)
              );
              const isPending = leave.status === 'PENDING';
              return (
                <div key={leave.id} className={cn('bg-white rounded-2xl border shadow-sm p-4 flex items-center justify-between gap-4', isPending ? 'border-amber-200' : 'border-gray-100')}>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-900">
                        {leave.staff?.name ?? 'Unknown'} — {leave.leaveType}
                      </p>
                      {leave.staff?.role && (
                        <span className="text-xs text-gray-500">{leave.staff.role}</span>
                      )}
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                        {dayCount} day{dayCount !== 1 ? 's' : ''}
                      </span>
                      <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', LEAVE_META[leave.status]?.color)}>
                        {LEAVE_META[leave.status]?.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {new Date(leave.fromDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} –{' '}
                      {new Date(leave.toDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{leave.reason}</p>
                    {(leave as any).adminNote && (
                      <p className="text-xs text-gray-400 italic mt-0.5">{(leave as any).adminNote}</p>
                    )}
                  </div>
                  {isPending && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        className="text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg transition-colors"
                        onClick={() => leaveActionMutation.mutate({ id: leave.id, action: 'approve' })}
                      >
                        Approve
                      </button>
                      <button
                        className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded-lg transition-colors"
                        onClick={() => leaveActionMutation.mutate({ id: leave.id, action: 'reject' })}
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-8 text-center">
            <CalendarDays className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No leave requests</p>
          </div>
        )}
      </div>

      {/* Staff table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-gray-400">Loading…</div>
        ) : isError ? (
          <ErrorState onRetry={refetch} message="Staff couldn't be loaded. Your data is safe — please try again." />
        ) : !staff?.length ? (
          <div className="py-16 text-center">
            <HardHat className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No staff yet</p>
            <button
              onClick={() => router.push('/staff/add')}
              className="mt-4 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-xl text-sm font-medium inline-flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Staff
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {['Name', 'Phone', 'Role', 'Department', 'Joined', ''].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {staff.map((s) => (
                <Fragment key={s.id}>
                  <tr
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleRowClick(s.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                          <span className="text-primary-600 text-xs font-semibold">
                            {s.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-gray-900">{s.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{s.phone}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{s.role}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <span className={cn('inline-block px-2 py-0.5 rounded-full text-xs', DEPT_COLORS[s.categories?.[0] ?? ''] ?? 'bg-gray-100 text-gray-600')}>
                        {s.categories?.join(', ') || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {s.joiningDate
                        ? new Date(s.joiningDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
                        : '-'}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => handleDeactivate(e, s.id)}
                        disabled={deactivateMutation.isPending}
                        className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                      >
                        Deactivate
                      </button>
                    </td>
                  </tr>
                  {expandedId === s.id && <StaffDrawer staffId={s.id} />}
                </Fragment>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}
