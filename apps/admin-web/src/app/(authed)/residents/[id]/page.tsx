'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ErrorState } from '@/components/ui/ErrorState';
import { useAuthStore } from '@/store/auth.store';
import { Button, Modal, Textarea } from '@/components/primitives';

const STATUS_META: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'Active', color: 'bg-green-100 text-green-700' },
  PENDING: { label: 'Pending', color: 'bg-amber-100 text-amber-700' },
  INACTIVE: { label: 'Inactive', color: 'bg-gray-100 text-gray-600' },
  REJECTED: { label: 'Rejected', color: 'bg-red-100 text-red-700' },
};

const DOC_STATUS_META: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pending', color: 'bg-gray-100 text-gray-500' },
  UPLOADED: { label: 'Uploaded', color: 'bg-blue-100 text-blue-700' },
  VERIFIED: { label: 'Verified', color: 'bg-green-100 text-green-700' },
  REJECTED: { label: 'Rejected', color: 'bg-red-100 text-red-700' },
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm text-gray-900">{value ?? '—'}</p>
    </div>
  );
}

function calcAge(dob: string | null | undefined): string | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return `${age} years`;
}

export default function ResidentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const id = params.id as string;
  const userRole = useAuthStore((s) => s.user?.role);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [dismissOpen, setDismissOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  // F2: doc verify/reject — small reject-with-note modal.
  const [docRejectOpen, setDocRejectOpen] = useState(false);
  const [docRejectNote, setDocRejectNote] = useState('');

  const { data: residents, isLoading, isError, refetch } = useQuery({
    queryKey: ['residents'],
    queryFn: () => api.get<any[]>('/admin/residents'),
  });

  const resident = residents?.find((r) => r.id === id);

  // Try dedicated detail endpoint if list doesn't have full fields yet
  const { data: detail } = useQuery({
    queryKey: ['resident-detail', id],
    queryFn: () => api.get<any>(`/admin/residents/${id}`),
    enabled: !!id,
  });

  // Merge: detail takes precedence
  const r = detail ?? resident;

  const invalidateBoth = () => {
    qc.invalidateQueries({ queryKey: ['residents'] });
    qc.invalidateQueries({ queryKey: ['residents-pending'] });
    qc.invalidateQueries({ queryKey: ['resident-detail', id] });
  };

  const approveMutation = useMutation({
    mutationFn: () => api.patch(`/admin/residents/${id}/approve`, {}),
    onSuccess: () => { toast.success('Resident approved'); invalidateBoth(); },
    onError: (err: any) => toast.error(err?.message ?? 'Failed to approve resident'),
  });

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => api.patch(`/admin/residents/${id}/reject`, { reason }),
    onSuccess: () => {
      toast.success('Resident rejected');
      invalidateBoth();
      setRejectOpen(false);
      setRejectReason('');
    },
    onError: (err: any) => toast.error(err?.message ?? 'Failed to reject resident'),
  });

  const dismissMutation = useMutation({
    mutationFn: () => api.patch(`/admin/residents/${id}/dismiss`, {}),
    onSuccess: () => {
      toast.success('Resident marked as left');
      invalidateBoth();
      setDismissOpen(false);
    },
    onError: (err: any) => toast.error(err?.message ?? 'Failed to mark resident as left'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/admin/residents/${id}`),
    onSuccess: () => {
      toast.success('Resident deleted');
      qc.invalidateQueries({ queryKey: ['residents'] });
      router.push('/residents');
    },
    onError: (err: any) => toast.error(err?.message ?? 'Failed to delete resident'),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, any>) => api.patch(`/admin/residents/${id}`, data),
    onSuccess: () => {
      toast.success('Resident updated');
      invalidateBoth();
      setEditOpen(false);
    },
    onError: (err: any) => toast.error(err?.message ?? 'Failed to update resident'),
  });

  // F2: Verify / Reject resident documents. Backend endpoint:
  // PATCH /admin/residents/:id/documents/verify { status, note? }
  const verifyDocsMutation = useMutation({
    mutationFn: (payload: { status: 'VERIFIED' | 'REJECTED'; note?: string }) =>
      api.patch(`/admin/residents/${id}/documents/verify`, payload),
    onSuccess: (_data, vars) => {
      toast.success(vars.status === 'VERIFIED' ? 'Documents verified' : 'Documents rejected');
      invalidateBoth();
      setDocRejectOpen(false);
      setDocRejectNote('');
    },
    onError: (err: any) => toast.error(err?.message ?? 'Failed to update document status'),
  });

  const exportMutation = useMutation({
    mutationFn: () => api.post<{ url?: string; jobId?: string }>(`/admin/residents/${id}/data-export`, {}),
    onSuccess: (res) => {
      if (res?.url) {
        window.open(res.url, '_blank');
        toast.success('Export ready — opening download…');
      } else {
        toast.success('Export started — you will receive an email when it is ready.');
      }
    },
    onError: (err: any) => toast.error(err?.message ?? 'Export failed'),
  });

  // Escape key for modals
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setRejectOpen(false); setRejectReason('');
        setDismissOpen(false);
        setDeleteOpen(false);
        setEditOpen(false);
        setDocRejectOpen(false); setDocRejectNote('');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Populate edit form when resident data arrives
  useEffect(() => {
    if (!r) return;
    const ec = (r.emergencyContact && typeof r.emergencyContact === 'object') ? r.emergencyContact : {};
    setEditForm({
      name: r.name ?? '',
      phone: r.phone ?? '',
      email: r.email ?? '',
      dateOfBirth: r.dateOfBirth ? r.dateOfBirth.slice(0, 10) : '',
      roleNote: r.roleNote ?? '',
      emergencyName: ec.name ?? '',
      emergencyPhone: ec.phone ?? '',
    });
  }, [r?.id]);

  if (isLoading && !r) {
    return (
      <div className="p-8">
        <div className="h-6 w-32 bg-gray-200 rounded animate-pulse mb-4" />
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-4 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (isError && !r) return <ErrorState onRetry={refetch} message="Resident information couldn't be loaded. Your data is safe — please try again." />;

  if (!r) {
    return (
      <div className="p-6 lg:p-8">
        <button
          onClick={() => router.back()}
          className="text-sm text-gray-500 hover:text-gray-700 mb-6 flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center text-gray-400">
          Resident not found.
        </div>
      </div>
    );
  }

  const statusMeta = STATUS_META[r.status] ?? STATUS_META.PENDING;
  const docMeta = DOC_STATUS_META[r.documentsStatus] ?? DOC_STATUS_META.PENDING;
  const flatLabel = r.flat
    ? `${r.flat.block ?? ''}${r.flat.number ?? ''}${r.flat.floor != null ? `, Floor ${r.flat.floor}` : ''}`
    : r.unit?.flatNumber ?? '—';
  const towerLabel = r.flat?.block ?? r.unit?.tower ?? '—';
  const initials = r.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
  const age = calcAge(r.dateOfBirth);
  const dobFormatted = r.dateOfBirth
    ? new Date(r.dateOfBirth).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;
  const ec = (r.emergencyContact && typeof r.emergencyContact === 'object') ? r.emergencyContact as any : null;

  const handleEditSubmit = () => {
    const payload: Record<string, any> = {};
    if (editForm.dateOfBirth) payload.dateOfBirth = editForm.dateOfBirth;
    if (editForm.roleNote !== undefined) payload.roleNote = editForm.roleNote;
    const emergencyContact: Record<string, string> = {};
    if (editForm.emergencyName) emergencyContact.name = editForm.emergencyName;
    if (editForm.emergencyPhone) emergencyContact.phone = editForm.emergencyPhone;
    if (Object.keys(emergencyContact).length) payload.emergencyContact = emergencyContact;
    updateMutation.mutate(payload);
  };

  return (
    <div className="p-6 lg:p-8 max-w-3xl">
      <button
        onClick={() => router.push('/residents')}
        className="text-sm text-gray-500 hover:text-gray-700 mb-6 flex items-center gap-1.5 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Residents
      </button>

      {/* Header card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary-100 flex items-center justify-center shrink-0">
              <span className="text-primary-600 text-lg font-bold">{initials}</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{r.name}</h1>
              <p className="text-sm text-gray-500 mt-0.5">{r.email ?? r.phone}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full', statusMeta.color)}>
                  {statusMeta.label}
                </span>
                {r.appActivatedAt ? (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
                    App Activated
                  </span>
                ) : (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">
                    Not Activated
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => setEditOpen(true)}
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shrink-0"
          >
            Edit
          </button>
        </div>
      </div>

      {/* Details card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Profile Details</h2>
        <div className="grid grid-cols-2 gap-x-8 gap-y-5">
          <Field label="Full Name" value={r.name} />
          <Field label="Phone" value={r.phone} />
          <Field label="Email" value={r.email} />
          <Field label="Type" value={r.type ? r.type.charAt(0) + r.type.slice(1).toLowerCase() : undefined} />
          <Field label="Flat" value={flatLabel} />
          <Field label="Block / Tower" value={towerLabel} />
          <Field
            label="Date of Birth"
            value={dobFormatted ? `${dobFormatted}${age ? ` (${age})` : ''}` : undefined}
          />
          <Field
            label="Registered On"
            value={r.createdAt
              ? new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
              : undefined}
          />
          {r.moveOutDate && (
            <Field
              label="Move-out Date"
              value={new Date(r.moveOutDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            />
          )}
          {r.roleNote && <Field label="Role Note" value={r.roleNote} />}
          {r.appActivatedAt && (
            <Field
              label="App Activated On"
              value={new Date(r.appActivatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            />
          )}
          {r.residentId && <Field label="Resident ID" value={r.residentId} />}
        </div>
      </div>

      {/* Emergency Contact card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Emergency Contact</h2>
        {ec && (ec.name || ec.phone) ? (
          <div className="grid grid-cols-2 gap-x-8 gap-y-5">
            <Field label="Name" value={ec.name} />
            <Field label="Phone" value={ec.phone} />
          </div>
        ) : (
          <p className="text-sm text-gray-400">No emergency contact on file.</p>
        )}
      </div>

      {/* Documents card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="text-sm font-semibold text-gray-700">Documents</h2>
          <div className="flex items-center gap-2">
            <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', docMeta.color)}>
              {docMeta.label}
            </span>
            {/* F2: only show action buttons when there is something to act on
                (something uploaded) and it's not already in the requested
                state — keeps the UI calm for fully-verified residents. */}
            {r.documentsStatus !== 'VERIFIED' && (
              <Button
                size="sm"
                variant="primary"
                onClick={() => verifyDocsMutation.mutate({ status: 'VERIFIED' })}
                disabled={verifyDocsMutation.isPending}
              >
                {verifyDocsMutation.isPending && verifyDocsMutation.variables?.status === 'VERIFIED'
                  ? 'Verifying…'
                  : 'Verify'}
              </Button>
            )}
            {r.documentsStatus !== 'REJECTED' && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setDocRejectOpen(true); setDocRejectNote(''); }}
                disabled={verifyDocsMutation.isPending}
              >
                Reject
              </Button>
            )}
          </div>
        </div>
        <div className="flex gap-4 flex-wrap">
          {r.idProof ? (
            <a
              href={r.idProof}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-blue-100 bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100 transition-colors"
            >
              ID Proof <ExternalLink className="w-3.5 h-3.5" />
            </a>
          ) : (
            <span className="text-sm text-gray-400">No ID proof uploaded</span>
          )}
          {r.addressProof && (
            <a
              href={r.addressProof}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-blue-100 bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100 transition-colors"
            >
              Address Proof <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>

      {/* DPDP data export */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-700">Export Resident Data</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Generate a DPDP-compliant export of this resident&apos;s personal data.
          </p>
        </div>
        <button
          onClick={() => exportMutation.mutate()}
          disabled={exportMutation.isPending}
          className="px-4 py-2 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-medium disabled:opacity-50"
          aria-label="Export resident data"
        >
          {exportMutation.isPending ? 'Generating…' : 'Export Data'}
        </button>
      </div>

      {/* Admin note (if rejected) */}
      {r.adminNote && r.status === 'REJECTED' && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-5 mb-4">
          <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-1">Rejection Reason</p>
          <p className="text-sm text-red-800">{r.adminNote}</p>
        </div>
      )}

      {/* Actions (only if PENDING) */}
      {r.status === 'PENDING' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Approval Actions</h2>
          <div className="flex gap-3">
            <button
              className="px-5 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending ? 'Approving…' : 'Approve Resident'}
            </button>
            <button
              className="px-5 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
              onClick={() => { setRejectOpen(true); setRejectReason(''); }}
              disabled={rejectMutation.isPending}
            >
              Reject
            </button>
          </div>
        </div>
      )}

      {/* Danger zone */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Danger Zone</h2>
        <div className="flex flex-wrap gap-3">
          {r.status !== 'INACTIVE' && (
            <button
              onClick={() => setDismissOpen(true)}
              className="px-4 py-2 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-700 text-sm font-medium transition-colors"
            >
              Mark as Left
            </button>
          )}
          {userRole !== 'SUPER_ADMIN' && (
            <button
              onClick={() => setDeleteOpen(true)}
              className="px-4 py-2 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-sm font-medium transition-colors"
            >
              Delete Resident
            </button>
          )}
        </div>
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}

      {/* Edit Modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Edit Resident</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">Date of Birth</label>
                <input
                  type="date"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary-400"
                  value={editForm.dateOfBirth ?? ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">Role Note</label>
                <input
                  type="text"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary-400"
                  placeholder="e.g. Committee member, Security in-charge…"
                  value={editForm.roleNote ?? ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, roleNote: e.target.value }))}
                />
              </div>
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Emergency Contact</p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Name</label>
                    <input
                      type="text"
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary-400"
                      placeholder="Contact name"
                      value={editForm.emergencyName ?? ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, emergencyName: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Phone</label>
                    <input
                      type="tel"
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary-400"
                      placeholder="+91 9876543210"
                      value={editForm.emergencyPhone ?? ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, emergencyPhone: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                className="px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                onClick={() => setEditOpen(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded-xl text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white transition-colors disabled:opacity-50"
                disabled={updateMutation.isPending}
                onClick={handleEditSubmit}
              >
                {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mark as Left Modal */}
      {dismissOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDismissOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Mark as Left</h2>
            <p className="text-sm text-gray-500 mb-5">
              This will set <span className="font-medium text-gray-700">{r.name}</span>&apos;s move-out date to today
              and change their status to Inactive. This action can be reversed by re-approving the resident.
            </p>
            <div className="flex justify-end gap-3">
              <button
                className="px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                onClick={() => setDismissOpen(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded-xl text-sm font-medium bg-amber-500 hover:bg-amber-600 text-white transition-colors disabled:opacity-50"
                disabled={dismissMutation.isPending}
                onClick={() => dismissMutation.mutate()}
              >
                {dismissMutation.isPending ? 'Processing…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDeleteOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Delete Resident</h2>
            <p className="text-sm text-gray-500 mb-5">
              Are you sure you want to delete <span className="font-medium text-gray-700">{r.name}</span>?
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                className="px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                onClick={() => setDeleteOpen(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded-xl text-sm font-medium bg-red-500 hover:bg-red-600 text-white transition-colors disabled:opacity-50"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate()}
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setRejectOpen(false); setRejectReason(''); }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Reject Resident</h2>
            <p className="text-sm text-gray-500 mb-4">
              Provide a reason for rejecting{' '}
              <span className="font-medium text-gray-700">{r.name}</span>.
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
                onClick={() => { setRejectOpen(false); setRejectReason(''); }}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded-xl text-sm font-medium bg-red-500 hover:bg-red-600 text-white transition-colors disabled:opacity-50"
                disabled={rejectReason.length < 10 || rejectMutation.isPending}
                onClick={() => rejectMutation.mutate(rejectReason)}
              >
                {rejectMutation.isPending ? 'Rejecting…' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* F2: Reject documents — optional note */}
      <Modal
        open={docRejectOpen}
        onClose={() => { setDocRejectOpen(false); setDocRejectNote(''); }}
        title="Reject documents"
        description="Add a short note explaining what needs to be corrected. The resident sees this."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setDocRejectOpen(false); setDocRejectNote(''); }}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={verifyDocsMutation.isPending}
              onClick={() =>
                verifyDocsMutation.mutate({ status: 'REJECTED', note: docRejectNote.trim() || undefined })
              }
            >
              Reject documents
            </Button>
          </>
        }
      >
        <Textarea
          rows={4}
          placeholder="Optional: e.g. ID proof unreadable, please re-upload."
          value={docRejectNote}
          onChange={(e) => setDocRejectNote(e.target.value)}
        />
      </Modal>
    </div>
  );
}
