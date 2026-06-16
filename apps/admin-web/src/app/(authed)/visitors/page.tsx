'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ErrorState } from '@/components/ui/ErrorState';
import type { Visitor, VisitorStatus } from '@societyos/api-client';

const STATUS_META: Record<VisitorStatus, { label: string; color: string }> = {
  PENDING: { label: 'Expected', color: 'bg-blue-100 text-blue-700' },
  CHECKED_IN: { label: 'Inside', color: 'bg-green-100 text-green-700' },
  CHECKED_OUT: { label: 'Checked Out', color: 'bg-gray-100 text-gray-600' },
  DENIED: { label: 'Denied', color: 'bg-red-100 text-red-700' },
  EXPIRED: { label: 'Expired', color: 'bg-amber-100 text-amber-700' },
};

const APPROVAL_META: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Needs Approval', color: 'bg-amber-100 text-amber-700' },
  APPROVED: { label: 'Approved', color: 'bg-green-100 text-green-700' },
  REJECTED: { label: 'Rejected', color: 'bg-red-100 text-red-700' },
};

const STATUS_FILTERS = ['ALL', 'PENDING', 'CHECKED_IN', 'CHECKED_OUT', 'DENIED'] as const;
type StatusFilter = typeof STATUS_FILTERS[number];

type DateFilter = 'TODAY' | 'WEEK' | 'ALL';
type ApprovalFilter = 'ALL' | 'NEEDS_APPROVAL';

const DATE_TABS: Array<{ key: DateFilter; label: string }> = [
  { key: 'TODAY', label: 'Today' },
  { key: 'WEEK', label: 'This Week' },
  { key: 'ALL', label: 'All' },
];

type VisitorWithResident = Visitor & {
  resident?: { name: string; unit?: { flatNumber: string } };
  approvalStatus?: string;
  type?: 'GUEST' | 'DELIVERY';
  deliveryPartner?: string | null;
};

function formatTime(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function VisitorAvatar({ name }: { name: string }) {
  const initials = name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
      <span className="text-gray-500 text-xs font-semibold">{initials}</span>
    </div>
  );
}

export default function VisitorsPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [dateFilter, setDateFilter] = useState<DateFilter>('TODAY');
  const [approvalFilter, setApprovalFilter] = useState<ApprovalFilter>('ALL');
  const [search, setSearch] = useState('');

  const queryParams = new URLSearchParams();
  if (dateFilter === 'TODAY') queryParams.set('date', 'today');
  if (dateFilter === 'WEEK') queryParams.set('date', 'week');
  if (statusFilter !== 'ALL') queryParams.set('status', statusFilter);
  const queryString = queryParams.toString();

  const { data: visitors, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-visitors', dateFilter, statusFilter],
    queryFn: () => api.get<VisitorWithResident[]>(`/admin/visitors${queryString ? `?${queryString}` : ''}`),
  });

  const checkInMutation = useMutation({
    mutationFn: (qrToken: string) => api.post('/visitors/check-in', { qrToken }),
    onSuccess: () => {
      toast.success('Visitor checked in');
      qc.invalidateQueries({ queryKey: ['admin-visitors'] });
    },
    onError: (err: any) => toast.error(err?.message ?? 'Failed to check in visitor'),
  });

  const checkOutMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/visitors/${id}/check-out`, {}),
    onSuccess: () => {
      toast.success('Visitor checked out');
      qc.invalidateQueries({ queryKey: ['admin-visitors'] });
    },
    onError: (err: any) => toast.error(err?.message ?? 'Failed to check out visitor'),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/visitors/${id}/approve`, {}),
    onSuccess: () => {
      toast.success('Visitor approved');
      qc.invalidateQueries({ queryKey: ['admin-visitors'] });
    },
    onError: (err: any) => toast.error(err?.message ?? 'Failed to approve visitor'),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/visitors/${id}/reject`, {}),
    onSuccess: () => {
      toast.success('Visitor rejected');
      qc.invalidateQueries({ queryKey: ['admin-visitors'] });
    },
    onError: (err: any) => toast.error(err?.message ?? 'Failed to reject visitor'),
  });

  const needsApprovalCount = visitors?.filter((v) => v.approvalStatus === 'PENDING').length ?? 0;

  const filtered = (visitors ?? []).filter((v) => {
    if (approvalFilter === 'NEEDS_APPROVAL' && v.approvalStatus !== 'PENDING') return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      v.name.toLowerCase().includes(q) ||
      v.phone?.includes(q) ||
      v.purpose.toLowerCase().includes(q) ||
      v.resident?.name?.toLowerCase().includes(q)
    );
  });

  const counts: Partial<Record<StatusFilter, number>> = {
    ALL: visitors?.length ?? 0,
    PENDING: visitors?.filter((v) => v.status === 'PENDING').length ?? 0,
    CHECKED_IN: visitors?.filter((v) => v.status === 'CHECKED_IN').length ?? 0,
    CHECKED_OUT: visitors?.filter((v) => v.status === 'CHECKED_OUT').length ?? 0,
    DENIED: visitors?.filter((v) => v.status === 'DENIED').length ?? 0,
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Visitors</h1>
        <p className="text-gray-500 text-sm mt-1">{visitors?.length ?? 0} total</p>
      </div>

      {/* Date filter tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-xl w-fit">
        {DATE_TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setDateFilter(key)}
            className={cn(
              'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
              dateFilter === key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Approval filter */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setApprovalFilter('ALL')}
          className={cn(
            'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
            approvalFilter === 'ALL'
              ? 'bg-primary-500 border-primary-500 text-white'
              : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300',
          )}
        >
          All Visitors
        </button>
        <button
          onClick={() => setApprovalFilter('NEEDS_APPROVAL')}
          className={cn(
            'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors flex items-center gap-1.5',
            approvalFilter === 'NEEDS_APPROVAL'
              ? 'bg-amber-500 border-amber-500 text-white'
              : 'bg-white border-amber-200 text-amber-700 hover:border-amber-300',
          )}
        >
          Pending Approval
          {needsApprovalCount > 0 && (
            <span className={cn(
              'text-xs rounded-full px-1.5 py-0.5 font-semibold',
              approvalFilter === 'NEEDS_APPROVAL' ? 'bg-white text-amber-600' : 'bg-amber-100 text-amber-700',
            )}>
              {needsApprovalCount}
            </span>
          )}
        </button>
      </div>

      {/* Search + status filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <input
          type="text"
          placeholder="Search by name, phone, purpose..."
          className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary-400 w-64"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex gap-2 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors flex items-center gap-1.5',
                statusFilter === f
                  ? 'bg-primary-500 border-primary-500 text-white'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300',
              )}
            >
              {f === 'ALL' ? 'All' : STATUS_META[f as VisitorStatus]?.label ?? f}
              <span className={cn(
                'text-xs rounded-full px-1.5 py-0.5',
                statusFilter === f ? 'bg-white text-primary-600' : 'bg-gray-100 text-gray-600',
              )}>
                {counts[f] ?? 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-gray-400">Loading…</div>
        ) : isError ? (
          <ErrorState onRetry={refetch} message="Visitors couldn't be loaded. Your data is safe — please try again." />
        ) : !filtered.length ? (
          <div className="py-16 text-center">
            <KeyRound className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No visitors found</p>
            <p className="text-gray-400 text-xs mt-1">Visitor entries will appear here as they are added.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {['Visitor', 'Type', 'Partner', 'Phone', 'Purpose', 'Host', 'Flat', 'Entry', 'Exit', 'Valid', 'Approval', 'Status', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((v) => {
                const meta = STATUS_META[v.status];
                const approvalMeta = APPROVAL_META[v.approvalStatus ?? 'APPROVED'];
                const isPending = v.status === 'PENDING';
                const isInside = v.status === 'CHECKED_IN';
                const needsApproval = v.approvalStatus === 'PENDING';
                return (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <VisitorAvatar name={v.name} />
                        <span className="text-sm font-medium text-gray-900">{v.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {v.type === 'DELIVERY' ? (
                        <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                          Delivery
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-full">
                          Guest
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {v.deliveryPartner ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{v.phone ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{v.purpose}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{v.resident?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{v.resident?.unit?.flatNumber ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{formatTime(v.checkedInAt)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{formatTime(v.checkedOutAt)}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {new Date(v.validFrom).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      {' – '}
                      {new Date(v.validTill).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </td>
                    <td className="px-4 py-3">
                      {approvalMeta && (
                        <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', approvalMeta.color)}>
                          {approvalMeta.label}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', meta.color)}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {needsApproval && (
                          <>
                            <button
                              onClick={() => approveMutation.mutate(v.id)}
                              disabled={approveMutation.isPending}
                              className="text-xs bg-green-100 hover:bg-green-200 text-green-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap font-medium"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => rejectMutation.mutate(v.id)}
                              disabled={rejectMutation.isPending}
                              className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap font-medium"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {isPending && !needsApproval && (
                          <button
                            onClick={() => checkInMutation.mutate(v.qrToken)}
                            disabled={checkInMutation.isPending}
                            className="text-xs bg-green-100 hover:bg-green-200 text-green-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
                          >
                            Check In
                          </button>
                        )}
                        {isInside && (
                          <button
                            onClick={() => checkOutMutation.mutate(v.id)}
                            disabled={checkOutMutation.isPending}
                            className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
                          >
                            Check Out
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}
