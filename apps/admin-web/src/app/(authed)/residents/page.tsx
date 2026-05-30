'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Users, X, UserPlus, Upload } from 'lucide-react';
import { api, downloadAdminFile } from '@/lib/api';
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

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/v1';

async function downloadResidentsCSV() {
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
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', email: '', phone: '', flatId: '', type: 'TENANT' as 'OWNER' | 'TENANT', dateOfBirth: '' });
  const [showImportModal, setShowImportModal] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; skipped: number; errors: { row: number; reason: string }[] } | null>(null);
  const [importPreview, setImportPreview] = useState<{ valid: unknown[]; errors: { row: number; reason: string }[]; created: number; skipped: number } | null>(null);
  const [pendingImportCsv, setPendingImportCsv] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const closeImportModal = () => {
    setShowImportModal(false);
    setImportResult(null);
    setImportPreview(null);
    setPendingImportCsv('');
  };

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

  const addMutation = useMutation({
    mutationFn: (dto: typeof addForm) => api.post('/admin/residents', dto),
    onSuccess: () => {
      toast.success('Resident created');
      qc.invalidateQueries({ queryKey: ['residents'] });
      setShowAddModal(false);
      setAddForm({ name: '', email: '', phone: '', flatId: '', type: 'TENANT', dateOfBirth: '' });
    },
    onError: (err: any) => toast.error(err?.message ?? 'Failed to create resident'),
  });


  const previewImportMutation = useMutation({
    mutationFn: (csv: string) => api.post<any>('/admin/residents/import/preview', { csv }),
    onSuccess: (data) => setImportPreview(data),
    onError: (err: any) => toast.error(err?.message ?? 'Preview failed'),
  });


  const importMutation = useMutation({
    mutationFn: (csv: string) => api.post<{ created: number; skipped: number; errors: { row: number; reason: string }[] }>('/admin/residents/import', { csv }),
    onSuccess: (data) => {
      setImportResult(data);
      setImportPreview(null);
      setPendingImportCsv('');
      qc.invalidateQueries({ queryKey: ['residents'] });
      toast.success(`Import done: ${data.created} created, ${data.skipped} skipped`);
    },
    onError: (err: any) => toast.error(err?.message ?? 'Import failed'),
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const csv = ev.target?.result as string;
      setPendingImportCsv(csv);
      previewImportMutation.mutate(csv);
    };
    reader.readAsText(file);
    e.target.value = '';
  }

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

  const { data: flats } = useQuery({
    queryKey: ['flats'],
    queryFn: () => api.get<any[]>('/admin/flats').catch(() => []),
    enabled: showAddModal,
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
    const anyOpen = showBulkModal || !!rejectTarget || showAddModal || showImportModal;
    if (!anyOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showBulkModal) setShowBulkModal(false);
      if (rejectTarget) { setRejectTarget(null); setRejectReason(''); }
      if (showAddModal) setShowAddModal(false);
      if (showImportModal) closeImportModal();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showBulkModal, rejectTarget, showAddModal, showImportModal]);

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
        <div className="flex gap-2 flex-wrap justify-end">
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
            className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors flex items-center gap-1.5"
            onClick={() => { setImportResult(null); setShowImportModal(true); }}
          >
            <Upload className="w-4 h-4" />
            Import CSV
          </button>
          <button
            className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
            onClick={() => setShowBulkModal(true)}
          >
            Bulk Message
          </button>
          <button
            className="bg-primary-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary-600 transition-colors flex items-center gap-1.5"
            onClick={() => setShowAddModal(true)}
          >
            <UserPlus className="w-4 h-4" />
            Add Resident
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
                    : ['App', 'Joined']
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
                const appActivated = !!r.appActivatedAt;

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
                      <>
                        <td className="px-4 py-3">
                          <span className={cn(
                            'text-xs font-medium px-2 py-0.5 rounded-full',
                            appActivated
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-gray-100 text-gray-400',
                          )}>
                            {appActivated ? 'App Active' : 'Not Activated'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">
                          {r.createdAt
                            ? new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                            : '—'}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Add Resident Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Add Resident</h2>
              <button aria-label="Close" className="text-gray-400 hover:text-gray-600" onClick={() => setShowAddModal(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Full Name *</label>
                <input
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary-400"
                  placeholder="e.g. Priya Sharma"
                  value={addForm.name}
                  onChange={(e) => setAddForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Phone *</label>
                <input
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary-400"
                  placeholder="e.g. +919876543210"
                  value={addForm.phone}
                  onChange={(e) => setAddForm(f => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Email</label>
                <input
                  type="email"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary-400"
                  placeholder="Optional"
                  value={addForm.email}
                  onChange={(e) => setAddForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Flat *</label>
                {flats && flats.length > 0 ? (
                  <select
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-primary-400 bg-white"
                    value={addForm.flatId}
                    onChange={(e) => setAddForm(f => ({ ...f, flatId: e.target.value }))}
                  >
                    <option value="">Select flat…</option>
                    {flats.map((flat: any) => (
                      <option key={flat.id} value={flat.id}>
                        {flat.block}-{flat.number}{flat.floor ? ` (Floor ${flat.floor})` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary-400"
                    placeholder="Flat ID"
                    value={addForm.flatId}
                    onChange={(e) => setAddForm(f => ({ ...f, flatId: e.target.value }))}
                  />
                )}
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Type *</label>
                <select
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-primary-400 bg-white"
                  value={addForm.type}
                  onChange={(e) => setAddForm(f => ({ ...f, type: e.target.value as 'OWNER' | 'TENANT' }))}
                >
                  <option value="TENANT">Tenant</option>
                  <option value="OWNER">Owner</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Date of Birth</label>
                <input
                  type="date"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-primary-400"
                  value={addForm.dateOfBirth}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setAddForm(f => ({ ...f, dateOfBirth: e.target.value }))}
                />
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <button
                  className="px-4 py-2.5 rounded-xl text-sm border border-gray-200 text-gray-600 hover:border-gray-300 transition-colors"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-40 transition-colors"
                  disabled={!addForm.name.trim() || !addForm.phone.trim() || !addForm.flatId || addMutation.isPending}
                  onClick={() => addMutation.mutate(addForm)}
                >
                  {addMutation.isPending ? 'Creating…' : 'Create Resident'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import CSV Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={closeImportModal}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Import Residents CSV</h2>
              <button aria-label="Close" className="text-gray-400 hover:text-gray-600" onClick={closeImportModal}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              CSV format: <code className="bg-gray-100 px-1 rounded">name, phone, email, block, flatNumber, type, dateOfBirth</code>
            </p>
            <button
              type="button"
              onClick={() => downloadAdminFile('/admin/residents/import/template', 'residents-import-template.csv').catch((e: Error) => toast.error(e.message))}
              className="text-xs text-primary-600 mb-3 inline-block"
            >
              Download template
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleFileChange}
            />
            {importResult ? (
              <div className="space-y-3">
                <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm">
                  <p className="font-medium text-green-700">{importResult.created} residents created, {importResult.skipped} skipped</p>
                </div>
                {importResult.errors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs max-h-40 overflow-y-auto">
                    <p className="font-medium text-red-700 mb-2">Errors ({importResult.errors.length} rows):</p>
                    {importResult.errors.map((e, i) => (
                      <p key={i} className="text-red-600">Row {e.row}: {e.reason}</p>
                    ))}
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    className="px-4 py-2 rounded-xl text-sm border border-gray-200 text-gray-600 hover:border-gray-300 transition-colors"
                    onClick={() => { setImportResult(null); }}
                  >
                    Import Another
                  </button>
                  <button
                    className="px-4 py-2 rounded-xl text-sm bg-primary-500 text-white hover:bg-primary-600 transition-colors"
                    onClick={closeImportModal}
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : importPreview ? (
              <div className="space-y-3">
                <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm">
                  <p className="font-medium text-blue-800">{importPreview.valid?.length ?? 0} valid rows, {importPreview.errors?.length ?? 0} errors, {importPreview.skipped ?? 0} will be skipped</p>
                </div>
                {importPreview.errors?.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs max-h-32 overflow-y-auto">
                    {importPreview.errors.map((e, i) => (
                      <p key={i} className="text-red-600">Row {e.row}: {e.reason}</p>
                    ))}
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <button className="px-4 py-2 rounded-xl text-sm border border-gray-200" onClick={() => { setImportPreview(null); setPendingImportCsv(''); }}>Back</button>
                  <button
                    className="px-4 py-2 rounded-xl text-sm bg-primary-500 text-white disabled:opacity-50"
                    disabled={importMutation.isPending || !pendingImportCsv}
                    onClick={() => importMutation.mutate(pendingImportCsv)}
                  >
                    {importMutation.isPending ? 'Importing…' : 'Confirm Import'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <button
                  className="w-full border-2 border-dashed border-gray-200 rounded-xl px-6 py-10 flex flex-col items-center gap-2 hover:border-primary-400 hover:bg-primary-50 transition-colors disabled:opacity-50"
                  disabled={previewImportMutation.isPending}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-6 h-6 text-gray-400" />
                  <span className="text-sm text-gray-500">
                    {previewImportMutation.isPending ? 'Previewing…' : 'Click to select CSV file'}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

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
