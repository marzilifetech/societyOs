'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Users, X } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ErrorState } from '@/components/ui/ErrorState';

const STATUS_META: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'Active', color: 'bg-green-100 text-green-700' },
  PENDING: { label: 'Pending', color: 'bg-amber-100 text-amber-700' },
  INACTIVE: { label: 'Inactive', color: 'bg-gray-100 text-gray-600' },
  REJECTED: { label: 'Rejected', color: 'bg-red-100 text-red-700' },
};

const DOC_STATUS_META: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Docs Pending', color: 'bg-gray-100 text-gray-500' },
  UPLOADED: { label: 'Docs Uploaded', color: 'bg-blue-100 text-blue-700' },
  VERIFIED: { label: 'Docs Verified', color: 'bg-green-100 text-green-700' },
};

async function downloadResidentsCSV() {
  const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/v1';
  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
  const res = await fetch(`${BASE_URL}/admin/residents/export`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error('Export failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'residents.csv'; a.click();
  URL.revokeObjectURL(url);
}

type TabType = 'All Residents' | 'Pending Approval';
type StatusFilter = 'All' | 'ACTIVE' | 'PENDING' | 'INACTIVE';

export default function ResidentsPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('All Residents');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [rejectTarget, setRejectTarget] = useState<{ id: string; name: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkMessage, setBulkMessage] = useState('');
  const [bulkTarget, setBulkTarget] = useState<'ALL' | 'SELECTED'>('ALL');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exportLoading, setExportLoading] = useState(false);

  const bulkMutation = useMutation({
    mutationFn: (residentIds: string[]) =>
      api.post('/admin/residents/bulk-message', { residentIds, message: bulkMessage, channel: 'PUSH' }),
    onSuccess: (data: any) => {
      toast.success(`Message sent to ${data?.sent ?? 0} residents`);
      setShowBulkModal(false);
      setBulkMessage('');
      setSelectedIds(new Set());
    },
    onError: (err: any) => toast.error(err?.message ?? 'Failed to send bulk message'),
  });

  function handleBulkSend(allResidents: any[]) {
    const ids = bulkTarget === 'ALL'
      ? allResidents.filter(r => r.status === 'ACTIVE').map(r => r.id)
      : Array.from(selectedIds);
    if (!ids.length) { toast.error('No residents selected'); return; }
    bulkMutation.mutate(ids);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const { data: residents, isLoading, isError, refetch } = useQuery({
    queryKey: ['residents'],
    queryFn: () => api.get<any[]>('/admin/residents'),
  });

  const { data: pendingResidents, isLoading: pendingLoading, isError: pendingError, refetch: refetchPending } = useQuery({
    queryKey: ['residents-pending'],
    queryFn: () => api.get<any[]>('/admin/residents/pending'),
    enabled: activeTab === 'Pending Approval',
  });

  const invalidateBoth = () => {
    qc.invalidateQueries({ queryKey: ['residents'] });
    qc.invalidateQueries({ queryKey: ['residents-pending'] });
  };

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/residents/${id}/approve`, {}),
    onSuccess: () => {
      toast.success('Resident approved');
      invalidateBoth();
    },
    onError: (err: any) => toast.error(err?.message ?? 'Failed to approve resident'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.patch(`/admin/residents/${id}/reject`, { reason }),
    onSuccess: () => {
      toast.success('Resident rejected');
      invalidateBoth();
      setRejectTarget(null);
      setRejectReason('');
    },
    onError: (err: any) => toast.error(err?.message ?? 'Failed to reject resident'),
  });

  // Close modals on Escape
  useEffect(() => {
    if (!showBulkModal && !rejectTarget) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showBulkModal) setShowBulkModal(false);
      if (rejectTarget) { setRejectTarget(null); setRejectReason(''); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showBulkModal, rejectTarget]);

  const pendingCount = residents?.filter(r => r.status === 'PENDING').length ?? 0;

  const tabFiltered = activeTab === 'Pending Approval'
    ? (pendingResidents ?? [])
    : (residents ?? []);

  const statusFiltered = statusFilter === 'All'
    ? tabFiltered
    : tabFiltered.filter(r => r.status === statusFilter);

  const filtered = statusFiltered.filter(
    (r) =>
      r.name?.toLowerCase().includes(search.toLowerCase()) ||
      r.phone?.includes(search) ||
      (r.unit?.flatNumber ?? r.flat?.number ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  const isTabLoading = activeTab === 'Pending Approval' ? pendingLoading : isLoading;
  const isTabError = activeTab === 'Pending Approval' ? pendingError : isError;
  const refetchTab = activeTab === 'Pending Approval' ? refetchPending : refetch;

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Residents</h1>
          <p className="text-gray-500 text-sm mt-1">{residents?.length ?? 0} total</p>
        </div>
        <div className="flex gap-2">
          <button
            className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            disabled={exportLoading}
            onClick={async () => {
              setExportLoading(true);
              try { await downloadResidentsCSV(); }
              catch { toast.error('Export failed'); }
              finally { setExportLoading(false); }
            }}
          >
            {exportLoading ? 'Exporting…' : 'Export CSV'}
          </button>
          <button
            className="bg-primary-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary-600 transition-colors"
            onClick={() => setShowBulkModal(true)}
          >
            Bulk Message
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(['All Residents', 'Pending Approval'] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-1.5 rounded-full text-sm font-medium border transition-colors flex items-center gap-1.5',
              activeTab === tab
                ? 'bg-primary-500 border-primary-500 text-white'
                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300',
            )}
          >
            {tab}
            {tab === 'Pending Approval' && pendingCount > 0 && (
              <span className={cn('text-xs rounded-full px-1.5 py-0.5 font-semibold', activeTab === tab ? 'bg-white text-primary-600' : 'bg-amber-100 text-amber-700')}>
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search by name, phone, or flat..."
          className="w-full max-w-sm border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary-400"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {activeTab === 'All Residents' && (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-primary-400 bg-white"
          >
            <option value="All">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="PENDING">Pending</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {isTabLoading ? (
          <div className="py-16 text-center text-gray-400">Loading…</div>
        ) : isTabError ? (
          <ErrorState onRetry={refetchTab} message="Residents couldn't be loaded. Your data is safe — please try again." />
        ) : !filtered.length ? (
          <div className="py-16 text-center">
            <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No residents yet</p>
            <p className="text-gray-400 text-xs mt-1">New residents will appear here once they sign up.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {activeTab === 'All Residents' && <th className="px-3 py-3 w-8" />}
                {[
                  'Name', 'Phone', 'Flat', 'Tower', 'Status',
                  ...(activeTab === 'Pending Approval'
                    ? ['Type', 'Documents', 'Actions']
                    : ['Joined']
                  ),
                ].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((r) => {
                const meta = STATUS_META[r.status] ?? STATUS_META.PENDING;
                const flatLabel = r.flat
                  ? `${r.flat.block ?? ''}${r.flat.number ?? ''}`
                  : (r.unit?.flatNumber ?? '—');
                const towerLabel = r.flat?.block ?? r.unit?.tower ?? '—';
                const docMeta = DOC_STATUS_META[r.documentsStatus] ?? DOC_STATUS_META.PENDING;

                return (
                  <tr
                    key={r.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => router.push(`/residents/${r.id}`)}
                  >
                    {activeTab === 'All Residents' && (
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={selectedIds.has(r.id)}
                          onChange={() => toggleSelect(r.id)}
                        />
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                          <span className="text-primary-600 text-xs font-semibold">
                            {r.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-gray-900">{r.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{r.phone}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{flatLabel}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{towerLabel}</td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', meta.color)}>
                        {meta.label}
                      </span>
                    </td>
                    {activeTab === 'Pending Approval' ? (
                      <>
                        <td className="px-4 py-3 text-xs text-gray-500 capitalize">
                          {r.type?.toLowerCase() ?? '—'}
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-col gap-1">
                            <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full w-fit', docMeta.color)}>
                              {docMeta.label}
                            </span>
                            <div className="flex gap-2 mt-0.5">
                              {r.idProof && (
                                <a
                                  href={r.idProof}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:underline"
                                >
                                  ID Proof
                                </a>
                              )}
                              {r.addressProof && (
                                <a
                                  href={r.addressProof}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:underline"
                                >
                                  Address Proof
                                </a>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-2">
                            <button
                              className="text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                              onClick={() => approveMutation.mutate(r.id)}
                              disabled={approveMutation.isPending}
                            >
                              Approve
                            </button>
                            <button
                              className="text-xs bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                              onClick={() => { setRejectTarget({ id: r.id, name: r.name }); setRejectReason(''); }}
                              disabled={rejectMutation.isPending}
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {r.createdAt
                          ? new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                          : '—'}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {/* Bulk Message Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowBulkModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Bulk Message</h2>
              <button aria-label="Close" className="text-gray-400 hover:text-gray-600" onClick={() => setShowBulkModal(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Send to</label>
                <select
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none"
                  value={bulkTarget}
                  onChange={(e) => setBulkTarget(e.target.value as 'ALL' | 'SELECTED')}
                >
                  <option value="ALL">All Active Residents</option>
                  <option value="SELECTED">Selected Residents ({selectedIds.size})</option>
                </select>
                {bulkTarget === 'SELECTED' && selectedIds.size === 0 && (
                  <p className="text-xs text-amber-500 mt-1">Select residents from the table first (checkboxes).</p>
                )}
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Message</label>
                <textarea
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-primary-400 resize-none min-h-[100px]"
                  placeholder="Type your message…"
                  value={bulkMessage}
                  onChange={(e) => setBulkMessage(e.target.value)}
                />
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <button
                  className="px-4 py-2.5 rounded-xl text-sm border border-gray-200 text-gray-600 hover:border-gray-300 transition-colors"
                  onClick={() => setShowBulkModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-40 transition-colors"
                  disabled={!bulkMessage.trim() || bulkMutation.isPending || (bulkTarget === 'SELECTED' && selectedIds.size === 0)}
                  onClick={() => residents && handleBulkSend(residents)}
                >
                  {bulkMutation.isPending ? 'Sending…' : 'Send Push'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setRejectTarget(null); setRejectReason(''); }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Reject Resident</h2>
            <p className="text-sm text-gray-500 mb-4">
              Provide a reason for rejecting{' '}
              <span className="font-medium text-gray-700">{rejectTarget.name}</span>.
            </p>
            <textarea
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-red-400 resize-none"
              rows={4}
              placeholder="Enter rejection reason (min 10 characters)…"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            {rejectReason.length > 0 && rejectReason.length < 10 && (
              <p className="text-xs text-red-500 mt-1">Reason must be at least 10 characters.</p>
            )}
            <div className="flex justify-end gap-3 mt-5">
              <button
                className="px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                onClick={() => { setRejectTarget(null); setRejectReason(''); }}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded-xl text-sm font-medium bg-red-500 hover:bg-red-600 text-white transition-colors disabled:opacity-50"
                disabled={rejectReason.length < 10 || rejectMutation.isPending}
                onClick={() => rejectMutation.mutate({ id: rejectTarget.id, reason: rejectReason })}
              >
                {rejectMutation.isPending ? 'Rejecting…' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
