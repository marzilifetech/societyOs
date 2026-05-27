'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import { toast } from 'sonner';
import { Inbox } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { Complaint, ComplaintStatus } from '@societyos/api-client';
import { ErrorState } from '@/components/ui/ErrorState';

const STATUS_META: Record<ComplaintStatus, { label: string; color: string }> = {
  OPEN: { label: 'Open', color: 'bg-blue-100 text-blue-700' },
  UNDER_REVIEW: { label: 'Under Review', color: 'bg-amber-100 text-amber-700' },
  RESOLVED: { label: 'Resolved', color: 'bg-green-100 text-green-700' },
  CLOSED: { label: 'Closed', color: 'bg-gray-100 text-gray-600' },
  REJECTED: { label: 'Rejected', color: 'bg-red-100 text-red-700' },
};

const ALL_STATUSES: ComplaintStatus[] = ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED', 'CLOSED'];

const FILTER_OPTIONS = ['ALL', 'OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED', 'CLOSED'] as const;
type FilterOption = typeof FILTER_OPTIONS[number];

type StaffMember = { id: string; name: string; role: string };
type ComplaintWithResident = Complaint & {
  resident?: { name: string; unit?: { flatNumber: string } };
  adminNote?: string;
  // H1: assignment is now a first-class field, not a parsed adminNote prefix.
  assignedTo?: { id: string; name: string } | null;
};

function buildTrendData(complaints: ComplaintWithResident[]): { date: string; count: number }[] {
  const now = Date.now();
  const msPerDay = 86400000;
  const days: { date: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now - i * msPerDay);
    days.push({ date: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), count: 0 });
  }
  complaints.forEach((c) => {
    const dayLabel = new Date(c.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const entry = days.find((d) => d.date === dayLabel);
    if (entry) entry.count += 1;
  });
  return days;
}

function TrendChart({ complaints }: { complaints: ComplaintWithResident[] }) {
  const data = useMemo(() => buildTrendData(complaints), [complaints]);
  return (
    <div className="mb-6 rounded-2xl border border-gray-200 bg-white shadow-sm px-4 pt-3 pb-2">
      <p className="text-xs text-gray-500 font-medium mb-1">Complaints — last 14 days</p>
      <ResponsiveContainer width="100%" height={80}>
        <LineChart data={data}>
          <Tooltip
            contentStyle={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 8, color: '#1f2937', fontSize: 11 }}
            formatter={(v: number) => [v, 'complaints']}
            labelFormatter={(l: string) => l}
          />
          <Line type="monotone" dataKey="count" stroke="#821A52" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ComplaintCard({
  c,
  staff,
  onUpdate,
  onAssign,
}: {
  c: ComplaintWithResident;
  staff: StaffMember[];
  onUpdate: (id: string, status: ComplaintStatus, adminNote?: string) => void;
  onAssign: (id: string, staffId: string, staffName: string) => void;
}) {
  const meta = STATUS_META[c.status];
  const [selectedStatus, setSelectedStatus] = useState<ComplaintStatus>(c.status);
  const [adminNote, setAdminNote] = useState('');
  const [showAssign, setShowAssign] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const showNote = selectedStatus === 'RESOLVED' || selectedStatus === 'CLOSED';

  // Fall back to the legacy "Assigned to: X (id)" adminNote shape for rows
  // that pre-date the assignedTo column (H1) and haven't been re-assigned yet.
  const legacyMatch = c.adminNote?.match(/^Assigned to: (.+) \((.+)\)$/);
  const assignedName = c.assignedTo?.name ?? legacyMatch?.[1] ?? null;

  function handleAssign() {
    const s = staff.find((m) => m.id === selectedStaffId);
    if (!s) return;
    onAssign(c.id, s.id, s.name);
    setShowAssign(false);
    setSelectedStaffId('');
  }

  return (
    <div key={c.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0 mr-4">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">{c.category}</span>
            {c.isAnonymous && (
              <span className="text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full">Anonymous</span>
            )}
            <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', meta.color)}>
              {meta.label}
            </span>
            {assignedName && (
              <span className="text-xs bg-primary-50 text-primary-600 px-2.5 py-1 rounded-full">
                Assigned: {assignedName}
              </span>
            )}
          </div>
          <h3 className="font-semibold text-gray-900">{c.title}</h3>
          <p className="text-sm text-gray-500 mt-1 line-clamp-2">{c.description}</p>
          {c.adminNote && !assignedName && (
            <p className="text-xs text-gray-400 mt-2 italic border-l-2 border-gray-200 pl-2">
              Admin note: {c.adminNote}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          {!c.isAnonymous && c.resident && (
            <p className="text-xs text-gray-600 font-medium">{c.resident.name}</p>
          )}
          {c.resident?.unit && (
            <p className="text-xs text-gray-400">{c.resident.unit.flatNumber}</p>
          )}
          <p className="text-xs text-gray-400 mt-1">
            {new Date(c.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Inline status update */}
      <div className="mt-3 pt-3 border-t border-gray-50 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as ComplaintStatus)}
            className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-primary-400"
          >
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_META[s]?.label ?? s}</option>
            ))}
          </select>
          <button
            className="text-xs bg-primary-500 hover:bg-primary-600 text-white px-3 py-1.5 rounded-lg transition-colors"
            onClick={() => {
              if (selectedStatus === 'REJECTED' && !window.confirm('Reject this complaint? This will close it without resolution.')) return;
              const note = showNote ? adminNote.trim() : undefined;
              onUpdate(c.id, selectedStatus, note || undefined);
            }}
          >
            Update
          </button>
          {staff.length > 0 && (
            <button
              className="text-xs border border-primary-200 text-primary-600 hover:bg-primary-50 px-3 py-1.5 rounded-lg transition-colors"
              onClick={() => setShowAssign((v) => !v)}
            >
              {assignedName ? 'Reassign' : 'Assign Staff'}
            </button>
          )}
        </div>
        {showNote && (
          <textarea
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
            placeholder="Resolution notes…"
            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 outline-none focus:border-primary-400 resize-none min-h-[60px]"
          />
        )}
        {showAssign && (
          <div className="flex items-center gap-2">
            <select
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-primary-400 flex-1"
            >
              <option value="">Select staff…</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>{s.name} — {s.role}</option>
              ))}
            </select>
            <button
              className="text-xs bg-primary-500 hover:bg-primary-600 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
              onClick={handleAssign}
              disabled={!selectedStaffId}
            >
              Confirm
            </button>
            <button
              className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5"
              onClick={() => setShowAssign(false)}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ComplaintsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<FilterOption>('ALL');

  const { data: complaints, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-complaints', filter],
    queryFn: () =>
      api.get<ComplaintWithResident[]>(`/admin/complaints${filter !== 'ALL' ? `?status=${filter}` : ''}`),
  });

  // Fetch all for counts and trend chart
  const { data: allComplaints } = useQuery({
    queryKey: ['admin-complaints', 'ALL'],
    queryFn: () => api.get<ComplaintWithResident[]>('/admin/complaints'),
  });

  const { data: staff = [] } = useQuery({
    queryKey: ['admin-staff'],
    queryFn: () => api.get<StaffMember[]>('/admin/staff'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status, adminNote }: { id: string; status: ComplaintStatus; adminNote?: string }) =>
      api.patch(`/admin/complaints/${id}/status`, { status, ...(adminNote ? { adminNote } : {}) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-complaints'] });
      toast.success('Status updated');
    },
    onError: (err: Error & { code?: string }) => {
      toast.error(err.code ? `${err.message} (${err.code})` : err.message);
    },
  });

  const assignMutation = useMutation({
    mutationFn: ({ id, staffId, staffName }: { id: string; staffId: string; staffName: string }) =>
      api.patch(`/admin/complaints/${id}/assign`, { staffId, staffName }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-complaints'] });
      toast.success('Staff assigned');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const countFor = (f: FilterOption) => {
    if (!allComplaints) return null;
    if (f === 'ALL') return allComplaints.length;
    return allComplaints.filter(c => c.status === f).length;
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Complaints</h1>
        <p className="text-gray-500 text-sm mt-1">{complaints?.length ?? 0} complaints</p>
      </div>

      {allComplaints && allComplaints.length > 0 && (
        <TrendChart complaints={allComplaints} />
      )}

      <div className="flex gap-2 mb-6 flex-wrap">
        {FILTER_OPTIONS.map((f) => {
          const count = countFor(f);
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-4 py-1.5 rounded-full text-sm font-medium border transition-colors flex items-center gap-1.5',
                filter === f
                  ? 'bg-primary-500 border-primary-500 text-white'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300',
              )}
            >
              {f === 'ALL' ? 'All' : STATUS_META[f as ComplaintStatus]?.label ?? f}
              {count !== null && (
                <span className={cn('text-xs rounded-full px-1.5 py-0.5 font-semibold', filter === f ? 'bg-white text-primary-600' : 'bg-gray-100 text-gray-600')}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <div className="py-16 text-center text-gray-400">Loading…</div>
        ) : isError ? (
          <ErrorState onRetry={refetch} message="Complaints couldn't be loaded. Your data is safe — please try again." />
        ) : !complaints?.length ? (
          <div className="py-16 flex flex-col items-center text-center bg-white rounded-2xl border border-gray-200">
            <Inbox className="w-10 h-10 text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No complaints yet</p>
            <p className="text-gray-400 text-sm mt-1">Complaints submitted by residents will appear here.</p>
          </div>
        ) : (
          complaints.map((c) => (
            <ComplaintCard
              key={c.id}
              c={c}
              staff={staff}
              onUpdate={(id, status, adminNote) => updateMutation.mutate({ id, status, adminNote })}
              onAssign={(id, staffId, staffName) => assignMutation.mutate({ id, staffId, staffName })}
            />
          ))
        )}
      </div>
    </div>
  );
}
