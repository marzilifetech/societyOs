'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, ExternalLink } from 'lucide-react';
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
  PENDING: { label: 'Pending', color: 'bg-gray-100 text-gray-500' },
  UPLOADED: { label: 'Uploaded', color: 'bg-blue-100 text-blue-700' },
  VERIFIED: { label: 'Verified', color: 'bg-green-100 text-green-700' },
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm text-gray-900">{value ?? '—'}</p>
    </div>
  );
}

export default function ResidentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const id = params.id as string;

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const { data: residents, isLoading, isError, refetch } = useQuery({
    queryKey: ['residents'],
    queryFn: () => api.get<any[]>('/admin/residents'),
  });

  const resident = residents?.find((r) => r.id === id);

  const invalidateBoth = () => {
    qc.invalidateQueries({ queryKey: ['residents'] });
    qc.invalidateQueries({ queryKey: ['residents-pending'] });
  };

  const approveMutation = useMutation({
    mutationFn: () => api.patch(`/admin/residents/${id}/approve`, {}),
    onSuccess: () => {
      toast.success('Resident approved');
      invalidateBoth();
    },
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

  // Close modal on Escape
  useEffect(() => {
    if (!rejectOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setRejectOpen(false); setRejectReason(''); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [rejectOpen]);

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

  if (isLoading) {
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

  if (isError) return <ErrorState onRetry={refetch} message="Resident information couldn't be loaded. Your data is safe — please try again." />;

  if (!resident) {
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

  const statusMeta = STATUS_META[resident.status] ?? STATUS_META.PENDING;
  const docMeta = DOC_STATUS_META[resident.documentsStatus] ?? DOC_STATUS_META.PENDING;
  const flatLabel = resident.flat
    ? `${resident.flat.block ?? ''}${resident.flat.number ?? ''}${resident.flat.floor != null ? `, Floor ${resident.flat.floor}` : ''}`
    : resident.unit?.flatNumber ?? '—';
  const towerLabel = resident.flat?.block ?? resident.unit?.tower ?? '—';
  const initials = resident.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

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
              <h1 className="text-xl font-bold text-gray-900">{resident.name}</h1>
              <p className="text-sm text-gray-500 mt-0.5">{resident.email ?? resident.phone}</p>
            </div>
          </div>
          <span className={cn('text-xs font-semibold px-3 py-1.5 rounded-full shrink-0', statusMeta.color)}>
            {statusMeta.label}
          </span>
        </div>
      </div>

      {/* Details card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Profile Details</h2>
        <div className="grid grid-cols-2 gap-x-8 gap-y-5">
          <Field label="Full Name" value={resident.name} />
          <Field label="Phone" value={resident.phone} />
          <Field label="Email" value={resident.email} />
          <Field label="Type" value={resident.type ? resident.type.charAt(0) + resident.type.slice(1).toLowerCase() : undefined} />
          <Field label="Flat" value={flatLabel} />
          <Field label="Block / Tower" value={towerLabel} />
          <Field
            label="Registered On"
            value={resident.createdAt
              ? new Date(resident.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
              : undefined}
          />
          {resident.residentId && <Field label="Resident ID" value={resident.residentId} />}
        </div>
      </div>

      {/* Documents card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">Documents</h2>
          <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', docMeta.color)}>
            {docMeta.label}
          </span>
        </div>
        <div className="flex gap-4 flex-wrap">
          {resident.idProof ? (
            <a
              href={resident.idProof}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-blue-100 bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100 transition-colors"
            >
              ID Proof <ExternalLink className="w-3.5 h-3.5" />
            </a>
          ) : (
            <span className="text-sm text-gray-400">No ID proof uploaded</span>
          )}
          {resident.addressProof && (
            <a
              href={resident.addressProof}
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
      {resident.adminNote && resident.status === 'REJECTED' && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-5 mb-4">
          <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-1">Rejection Reason</p>
          <p className="text-sm text-red-800">{resident.adminNote}</p>
        </div>
      )}

      {/* Actions (only if PENDING) */}
      {resident.status === 'PENDING' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
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

      {/* Reject Modal */}
      {rejectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setRejectOpen(false); setRejectReason(''); }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Reject Resident</h2>
            <p className="text-sm text-gray-500 mb-4">
              Provide a reason for rejecting{' '}
              <span className="font-medium text-gray-700">{resident.name}</span>.
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
    </div>
  );
}
