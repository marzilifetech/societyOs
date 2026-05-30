'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ClipboardList, Trash2, Star } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ErrorState } from '@/components/ui/ErrorState';

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

const TAG_COLORS = [
  'bg-sky-100 text-sky-700',
  'bg-emerald-100 text-emerald-700',
  'bg-fuchsia-100 text-fuchsia-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-indigo-100 text-indigo-700',
];

function tagColor(tag: string) {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) & 0xffff;
  return TAG_COLORS[h % TAG_COLORS.length];
}

function StarRating({ value }: { value: number }) {
  const full = Math.round(value);
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn('w-3.5 h-3.5', i <= full ? 'fill-amber-400 text-amber-400' : 'text-gray-200')}
        />
      ))}
      <span className="ml-1 text-xs text-gray-500">{value.toFixed(1)}</span>
    </span>
  );
}

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
  const headers = ['ID', 'Category', 'Status', 'Resident', 'Unit', 'Tags', 'Paid', 'Rating', 'Created At', 'Age (hours)'];
  const rows = requests.map((sr) => {
    const ageH = getAgeHours(sr.createdAt).toFixed(1);
    return [
      sr.id,
      sr.category,
      sr.status,
      sr.resident?.name ?? '',
      sr.unit?.flatNumber ?? sr.resident?.flat?.flatNumber ?? '',
      (sr.tags ?? []).join(';'),
      sr.isPaid ? 'Paid' : 'Free',
      sr.rating != null ? Number(sr.rating).toFixed(1) : '',
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

// ─── Tab definitions ──────────────────────────────────────────────────────────

type Tab = 'ALL' | 'CREATED' | 'SCHEDULED' | 'COMPLETED';

const TABS: { key: Tab; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'CREATED', label: 'Created' },
  { key: 'SCHEDULED', label: 'Scheduled' },
  { key: 'COMPLETED', label: 'Completed' },
];

function filterByTab(requests: any[], tab: Tab): any[] {
  if (tab === 'ALL') return requests;
  if (tab === 'CREATED') return requests.filter((r) => r.status === 'PENDING');
  if (tab === 'SCHEDULED')
    return requests.filter(
      (r) => (r.status === 'ASSIGNED' || r.status === 'IN_PROGRESS') && r.scheduledTime,
    );
  if (tab === 'COMPLETED') return requests.filter((r) => r.status === 'COMPLETED' || r.status === 'CLOSED');
  return requests;
}

// ─── Inline tag editor ────────────────────────────────────────────────────────

function TagEditor({ id, initialTags, onSave }: { id: string; initialTags: string[]; onSave: (tags: string[]) => void }) {
  const [tags, setTags] = useState<string[]>(initialTags ?? []);
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function addTag() {
    const trimmed = input.trim();
    if (!trimmed || tags.includes(trimmed)) { setInput(''); return; }
    const next = [...tags, trimmed];
    setTags(next);
    setInput('');
    onSave(next);
  }

  function removeTag(t: string) {
    const next = tags.filter((x) => x !== t);
    setTags(next);
    onSave(next);
  }

  return (
    <div className="flex flex-wrap gap-1 items-center mt-1">
      {tags.map((t) => (
        <span key={t} className={cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium', tagColor(t))}>
          {t}
          <button type="button" onClick={() => removeTag(t)} className="hover:opacity-70 leading-none">&times;</button>
        </span>
      ))}
      <input
        ref={inputRef}
        className="text-xs border border-gray-200 rounded-full px-2 py-0.5 outline-none focus:border-primary-400 w-20"
        placeholder="+ tag"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); } }}
        onBlur={addTag}
      />
    </div>
  );
}

// ─── New request modal ────────────────────────────────────────────────────────

interface StaffOption {
  id: string;
  name: string;
  designation: string;
  categories: string[];
}

function NewRequestModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    residentId: '',
    category: '',
    description: '',
    scheduledTime: '',
    isPaid: false,
    reminderMinutes: '',
    tags: [] as string[],
    staffId: '',
  });
  const [tagInput, setTagInput] = useState('');
  const [residentSearch, setResidentSearch] = useState('');

  const { data: residents } = useQuery({
    queryKey: ['admin-residents-search'],
    queryFn: () => api.get<any[]>('/admin/residents'),
  });

  const { data: allStaff = [] } = useQuery<StaffOption[]>({
    queryKey: ['admin-staff'],
    queryFn: () => api.get<StaffOption[]>('/admin/staff'),
    staleTime: 60_000,
  });

  const filtered = residents?.filter((r: any) => {
    const q = residentSearch.toLowerCase();
    return (
      !q ||
      r.name?.toLowerCase().includes(q) ||
      r.flat?.flatNumber?.toLowerCase().includes(q) ||
      r.user?.name?.toLowerCase().includes(q)
    );
  }) ?? [];

  // Filter staff by category match — same logic as auto-assign
  const cat = form.category.toUpperCase();
  const relevantStaff = cat
    ? allStaff.filter((s) => s.categories.some((c) => c.toUpperCase() === cat))
    : [];
  const otherStaff = cat
    ? allStaff.filter((s) => !s.categories.some((c) => c.toUpperCase() === cat))
    : allStaff;

  const assignMutation = useMutation({
    mutationFn: ({ srId, staffId }: { srId: string; staffId: string }) =>
      api.patch(`/service-requests/${srId}/assign`, { staffIds: [staffId] }),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post<any>('/admin/service-requests', data),
    onSuccess: async (sr) => {
      if (form.staffId && sr?.id) {
        try {
          await assignMutation.mutateAsync({ srId: sr.id, staffId: form.staffId });
        } catch {
          toast.error('Request created but staff assignment failed — assign manually.');
        }
      }
      toast.success('Service request created');
      onCreated();
      onClose();
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to create'),
  });

  function addTag() {
    const t = tagInput.trim();
    if (t && !form.tags.includes(t)) setForm((f) => ({ ...f, tags: [...f.tags, t] }));
    setTagInput('');
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.residentId || !form.category || !form.description) {
      toast.error('Resident, category and description are required');
      return;
    }
    createMutation.mutate({
      residentId: form.residentId,
      category: form.category,
      description: form.description,
      ...(form.scheduledTime && { scheduledTime: form.scheduledTime }),
      isPaid: form.isPaid,
      ...(form.reminderMinutes && { reminderMinutes: Number(form.reminderMinutes) }),
      ...(form.tags.length && { tags: form.tags }),
    });
  }

  const selectedResident = residents?.find((r: any) => r.id === form.residentId);
  const busy = createMutation.isPending || assignMutation.isPending;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold mb-4 text-gray-900">New Service Request</h2>
        <form onSubmit={submit} className="space-y-4">
          {/* Resident search */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Resident *</label>
            <input
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-50"
              placeholder="Search by name or flat..."
              value={residentSearch}
              onChange={(e) => { setResidentSearch(e.target.value); if (form.residentId) setForm((f) => ({ ...f, residentId: '' })); }}
            />
            {residentSearch && !form.residentId && filtered.length > 0 && (
              <div className="border border-gray-200 rounded-xl mt-1 max-h-40 overflow-y-auto divide-y divide-gray-50">
                {filtered.slice(0, 10).map((r: any) => (
                  <button
                    key={r.id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                    onClick={() => {
                      setForm((f) => ({ ...f, residentId: r.id }));
                      setResidentSearch(`${r.user?.name ?? r.name ?? ''} — ${r.flat?.flatNumber ?? ''}`);
                    }}
                  >
                    <span className="font-medium">{r.user?.name ?? r.name}</span>
                    <span className="text-gray-400 ml-2">{r.flat?.flatNumber}</span>
                  </button>
                ))}
              </div>
            )}
            {selectedResident && (
              <p className="text-xs text-primary-600 mt-1">
                Selected: {selectedResident.user?.name ?? selectedResident.name} — {selectedResident.flat?.flatNumber}
              </p>
            )}
          </div>

          {/* Category */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Category *</label>
            <input
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-50"
              placeholder="e.g. Plumbing, Electrical..."
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value, staffId: '' }))}
            />
          </div>

          {/* Assign To */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Assign To
              {relevantStaff.length > 0 && (
                <span className="ml-1.5 text-primary-500 font-normal">
                  {relevantStaff.length} suggested for {form.category}
                </span>
              )}
            </label>
            <select
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-50 bg-white"
              value={form.staffId}
              onChange={(e) => setForm((f) => ({ ...f, staffId: e.target.value }))}
            >
              <option value="">Unassigned</option>
              {relevantStaff.length > 0 && (
                <optgroup label={`Suggested — ${form.category}`}>
                  {relevantStaff.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} — {s.designation}</option>
                  ))}
                </optgroup>
              )}
              <optgroup label={relevantStaff.length > 0 ? 'Other staff' : 'All staff'}>
                {otherStaff.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} — {s.designation}</option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Description *</label>
            <textarea
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-50"
              rows={3}
              placeholder="Describe the issue..."
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          {/* Scheduled time */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Scheduled Time</label>
            <input
              type="datetime-local"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-50"
              value={form.scheduledTime}
              onChange={(e) => setForm((f) => ({ ...f, scheduledTime: e.target.value }))}
            />
          </div>

          {/* Remind before */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Remind before (minutes)</label>
            <input
              type="number"
              min={1}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-50"
              placeholder="e.g. 30"
              value={form.reminderMinutes}
              onChange={(e) => setForm((f) => ({ ...f, reminderMinutes: e.target.value }))}
            />
          </div>

          {/* Tags */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Tags</label>
            <div className="flex flex-wrap gap-1 items-center">
              {form.tags.map((t) => (
                <span key={t} className={cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium', tagColor(t))}>
                  {t}
                  <button type="button" onClick={() => setForm((f) => ({ ...f, tags: f.tags.filter((x) => x !== t) }))} className="hover:opacity-70">&times;</button>
                </span>
              ))}
              <input
                className="text-xs border border-gray-200 rounded-full px-2 py-0.5 outline-none focus:border-primary-400 w-24"
                placeholder="+ add tag"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); } }}
                onBlur={addTag}
              />
            </div>
          </div>

          {/* isPaid toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="rounded"
              checked={form.isPaid}
              onChange={(e) => setForm((f) => ({ ...f, isPaid: e.target.checked }))}
            />
            <span className="text-sm text-gray-700">Paid request</span>
          </label>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-gray-200 rounded-xl text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex-1 py-2 bg-primary-500 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
            >
              {busy ? 'Creating…' : 'Create Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ServiceRequestsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('ALL');
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [scheduledTime, setScheduledTime] = useState('');
  const [disputeId, setDisputeId] = useState<string | null>(null);
  const [disputeNote, setDisputeNote] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);

  const { data: allRequests, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-service-requests', 'ALL'],
    queryFn: () => api.get<any[]>('/service-requests'),
  });

  const requests = allRequests;

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
    mutationFn: ({ id, staffIds, scheduledTime }: { id: string; staffIds: string[]; scheduledTime?: string }) =>
      api.patch(`/service-requests/${id}/assign`, { staffIds, scheduledTime: scheduledTime || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-service-requests'] });
      setAssigningId(null);
      setSelectedStaffIds([]);
      setScheduledTime('');
      toast.success('Staff assigned successfully');
    },
    onError: (err: any) => {
      if ((err as any).code === 'STAFF_OVERLOADED') {
        toast.error(err.message ?? 'Staff member already has 3 or more active assignments.');
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

  const tagsMutation = useMutation({
    mutationFn: ({ id, tags }: { id: string; tags: string[] }) =>
      api.patch(`/admin/service-requests/${id}`, { tags }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-service-requests'] }),
    onError: (err: Error) => toast.error(err.message ?? 'Failed to update tags'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/service-requests/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-service-requests'] });
      toast.success('Request deleted');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to delete'),
  });

  const displayRequests = filterByTab(requests ?? [], tab);

  function countFor(t: Tab) {
    if (!allRequests) return null;
    return filterByTab(allRequests, t).length;
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Service Requests</h1>
          <p className="text-gray-500 text-sm mt-1">{displayRequests.length} requests</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            className="bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
            onClick={() => setShowNewModal(true)}
          >
            + New Request
          </button>
          <button
            className="bg-white border border-gray-200 hover:border-gray-300 text-gray-700 text-sm font-medium px-4 py-2 rounded-xl transition-colors"
            onClick={() => displayRequests.length && exportCSV(displayRequests)}
            disabled={!displayRequests.length}
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Tab filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map(({ key, label }) => {
          const count = countFor(key);
          return (
            <button
              key={key}
              className={cn(
                'px-4 py-1.5 rounded-full text-sm font-medium border transition-colors flex items-center gap-1.5',
                tab === key
                  ? 'bg-primary-500 border-primary-500 text-white'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300',
              )}
              onClick={() => setTab(key)}
            >
              {label}
              {count !== null && (
                <span className={cn('text-xs rounded-full px-1.5 py-0.5 font-semibold', tab === key ? 'bg-white text-primary-600' : 'bg-gray-100 text-gray-600')}>
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
        ) : !displayRequests.length ? (
          <div className="py-16 flex flex-col items-center text-center">
            <ClipboardList className="w-10 h-10 text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No service requests</p>
            <p className="text-gray-400 text-sm mt-1">
              {tab === 'ALL' ? 'New requests from residents will show up here.' : `No ${tab.toLowerCase()} requests.`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  {['ID', 'Category / Tags', 'Resident', 'Unit', 'Status', 'Created / Scheduled', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {displayRequests.map((sr) => {
                  const meta = STATUS_META[sr.status] ?? STATUS_META.PENDING;
                  const nextActions = NEXT_STATUS[sr.status] ?? [];
                  const disputed = isDisputed(sr) || (sr.status === 'IN_PROGRESS' && sr.disputeReason);
                  const awaitingConfirm = sr.status === 'COMPLETED' && !sr.confirmedAt;
                  const residentName = sr.resident?.user?.name ?? sr.resident?.name ?? '—';
                  const flatNumber = sr.unit?.flatNumber ?? sr.resident?.flat?.flatNumber ?? '—';
                  const tags: string[] = sr.tags ?? [];
                  return (
                    <tr key={sr.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-xs text-gray-400 font-mono">
                        <Link href={`/service-requests/${sr.id}`} className="hover:text-primary-600 hover:underline">
                          #{sr.id.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="px-4 py-3 max-w-[240px]">
                        <div className="flex items-center gap-1 flex-wrap">
                          <p className="text-sm font-medium text-gray-900">{sr.category}</p>
                          <AgeBadge createdAt={sr.createdAt} />
                          {/* Paid / Free badge */}
                          {sr.isPaid ? (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 ml-1">
                              Paid
                            </span>
                          ) : (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 ml-1">
                              Free
                            </span>
                          )}
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
                          {sr.autoAssigned && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 ml-1">
                              Auto
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 truncate mt-0.5">{sr.description}</p>
                        {/* Tags inline editor */}
                        <TagEditor
                          id={sr.id}
                          initialTags={tags}
                          onSave={(newTags) => tagsMutation.mutate({ id: sr.id, tags: newTags })}
                        />
                        {/* Rating for completed */}
                        {sr.status === 'COMPLETED' && sr.rating != null && (
                          <div className="mt-1">
                            <StarRating value={Number(sr.rating)} />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{residentName}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{flatNumber}</td>
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
                        {sr.reminderMinutes != null && (
                          <div className="text-gray-400 mt-0.5">Remind: {sr.reminderMinutes}m before</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5 flex-wrap items-start">
                          {sr.status === 'PENDING' && (
                            <>
                              <button
                                className="text-xs bg-primary-50 hover:bg-primary-100 text-primary-600 px-2.5 py-1 rounded-lg transition-colors"
                                onClick={() => { setAssigningId(sr.id); setSelectedStaffIds([]); setScheduledTime(''); }}
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
                          {/* Delete button */}
                          <button
                            className="text-xs bg-red-50 hover:bg-red-100 text-red-600 p-1 rounded-lg transition-colors"
                            title="Delete request"
                            onClick={() => {
                              if (window.confirm('Delete this service request? This cannot be undone.')) {
                                deleteMutation.mutate(sr.id);
                              }
                            }}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {assigningId === sr.id && (
                          <div className="mt-2 p-3 bg-gray-50 rounded-lg space-y-2">
                            <p className="text-xs font-medium text-gray-500">Select staff (multiple allowed)</p>
                            <div className="max-h-32 overflow-y-auto space-y-1 border border-gray-200 rounded p-2 bg-white">
                              {staff?.map((s: any) => (
                                <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={selectedStaffIds.includes(s.id)}
                                    onChange={(e) => {
                                      setSelectedStaffIds((prev) =>
                                        e.target.checked ? [...prev, s.id] : prev.filter((x) => x !== s.id),
                                      );
                                    }}
                                  />
                                  {s.name ?? s.designation}
                                </label>
                              ))}
                            </div>
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
                                  if (selectedStaffIds.length) {
                                    assignMutation.mutate({ id: sr.id, staffIds: selectedStaffIds, scheduledTime });
                                  }
                                }}
                                disabled={!selectedStaffIds.length || assignMutation.isPending}
                              >
                                {assignMutation.isPending ? 'Assigning…' : 'Confirm'}
                              </button>
                              <button
                                className="flex-1 text-xs bg-gray-200 text-gray-700 py-1.5 rounded"
                                onClick={() => { setAssigningId(null); setSelectedStaffIds([]); setScheduledTime(''); }}
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
            </table>
          </div>
        )}
      </div>

      {/* Dispute modal */}
      {disputeId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
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

      {/* New request modal */}
      {showNewModal && (
        <NewRequestModal
          onClose={() => setShowNewModal(false)}
          onCreated={() => qc.invalidateQueries({ queryKey: ['admin-service-requests'] })}
        />
      )}
    </div>
  );
}
