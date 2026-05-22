'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FileText } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ErrorState } from '@/components/ui/ErrorState';

type DocumentRequest = {
  id: string;
  type: string;
  purpose: string;
  status: 'PENDING' | 'PROCESSING' | 'DELIVERED' | 'REJECTED';
  documentUrl?: string | null;
  adminNotes?: string | null;
  requiredBy?: string | null;
  createdAt: string;
  resident?: {
    user: { name: string };
    flat: { block: string; number: string };
  };
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  PENDING:    { label: 'Pending',    color: 'bg-amber-100 text-amber-700' },
  PROCESSING: { label: 'Processing', color: 'bg-blue-100 text-blue-700' },
  DELIVERED:  { label: 'Delivered',  color: 'bg-green-100 text-green-700' },
  REJECTED:   { label: 'Rejected',   color: 'bg-red-100 text-red-700' },
};

const FILTER_OPTIONS = ['ALL', 'PENDING', 'PROCESSING', 'DELIVERED', 'REJECTED'] as const;
type FilterOption = typeof FILTER_OPTIONS[number];

function RequestCard({
  req,
  onApprove,
  onReject,
}: {
  req: DocumentRequest;
  onApprove: (id: string, documentUrl: string, adminNotes: string) => void;
  onReject: (id: string, reason: string) => void;
}) {
  const meta = STATUS_META[req.status] ?? STATUS_META.PENDING;
  const [rejectMode, setRejectMode] = useState(false);
  const [reason, setReason] = useState('');
  const [docUrl, setDocUrl] = useState('');
  const [adminNotes, setAdminNotes] = useState('');

  const isDone = req.status === 'DELIVERED' || req.status === 'REJECTED';

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0 mr-4">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">{req.type}</span>
            <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', meta.color)}>
              {meta.label}
            </span>
          </div>
          <p className="text-sm text-gray-700 mt-1">{req.purpose}</p>
          {req.requiredBy && (
            <p className="text-xs text-gray-400 mt-1">
              Required by: {new Date(req.requiredBy).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          )}
          {req.adminNotes && (
            <p className="text-xs text-gray-400 mt-2 italic border-l-2 border-gray-200 pl-2">
              Note: {req.adminNotes}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          {req.resident && (
            <>
              <p className="text-xs text-gray-600 font-medium">{req.resident.user.name}</p>
              <p className="text-xs text-gray-400">Flat {req.resident.flat.block}-{req.resident.flat.number}</p>
            </>
          )}
          <p className="text-xs text-gray-400 mt-1">
            {new Date(req.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
          {req.documentUrl && (
            <a
              href={req.documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary-600 hover:underline mt-1 block"
            >
              Download
            </a>
          )}
        </div>
      </div>

      {!isDone && (
        <div className="mt-3 pt-3 border-t border-gray-50">
          {!rejectMode ? (
            <>
              <div className="space-y-2 mb-3">
                <input
                  type="text"
                  value={docUrl}
                  onChange={(e) => setDocUrl(e.target.value)}
                  placeholder="Document URL (optional)"
                  className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 outline-none focus:border-primary-400"
                />
                <input
                  type="text"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Admin notes (optional)"
                  className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 outline-none focus:border-primary-400"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg transition-colors"
                  onClick={() => onApprove(req.id, docUrl, adminNotes)}
                >
                  Approve
                </button>
                <button
                  className="text-xs border border-red-200 text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
                  onClick={() => setRejectMode(true)}
                >
                  Reject
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Rejection reason…"
                className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 outline-none focus:border-red-400 resize-none min-h-[60px]"
              />
              <div className="flex items-center gap-2">
                <button
                  className="text-xs bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg transition-colors"
                  disabled={!reason.trim()}
                  onClick={() => { onReject(req.id, reason.trim()); setRejectMode(false); }}
                >
                  Confirm Reject
                </button>
                <button
                  className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5"
                  onClick={() => setRejectMode(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DocumentRequestsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<FilterOption>('ALL');

  const { data, isLoading, isError, refetch } = useQuery<DocumentRequest[]>({
    queryKey: ['admin-doc-requests', filter],
    queryFn: () =>
      api.get<DocumentRequest[]>(
        `/document-requests${filter !== 'ALL' ? `?status=${filter}` : ''}`,
      ),
  });

  const { data: allData } = useQuery<DocumentRequest[]>({
    queryKey: ['admin-doc-requests', 'ALL'],
    queryFn: () => api.get<DocumentRequest[]>('/document-requests'),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, documentUrl, adminNotes }: { id: string; documentUrl: string; adminNotes: string }) =>
      api.patch(`/document-requests/${id}/approve`, {
        ...(documentUrl ? { documentUrl } : {}),
        ...(adminNotes ? { adminNotes } : {}),
      }),
    onSuccess: () => {
      toast.success('Request approved');
      qc.invalidateQueries({ queryKey: ['admin-doc-requests'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.patch(`/document-requests/${id}/reject`, { reason }),
    onSuccess: () => {
      toast.success('Request rejected');
      qc.invalidateQueries({ queryKey: ['admin-doc-requests'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const countFor = (f: FilterOption) => {
    if (!allData) return null;
    if (f === 'ALL') return allData.length;
    return allData.filter((r) => r.status === f).length;
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Document Requests</h1>
        <p className="text-gray-500 text-sm mt-1">{data?.length ?? 0} requests</p>
      </div>

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
              {f === 'ALL' ? 'All' : STATUS_META[f]?.label ?? f}
              {count !== null && (
                <span
                  className={cn(
                    'text-xs rounded-full px-1.5 py-0.5 font-semibold',
                    filter === f ? 'bg-white text-primary-600' : 'bg-gray-100 text-gray-600',
                  )}
                >
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
          <ErrorState onRetry={refetch} message="Document requests couldn't be loaded. Please try again." />
        ) : !data?.length ? (
          <div className="py-16 flex flex-col items-center text-center bg-white rounded-2xl border border-gray-200">
            <FileText className="w-10 h-10 text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No document requests yet</p>
            <p className="text-gray-400 text-sm mt-1">Resident requests for letters and certificates will appear here.</p>
          </div>
        ) : (
          data.map((req) => (
            <RequestCard
              key={req.id}
              req={req}
              onApprove={(id, documentUrl, adminNotes) =>
                approveMutation.mutate({ id, documentUrl, adminNotes })
              }
              onReject={(id, reason) => rejectMutation.mutate({ id, reason })}
            />
          ))
        )}
      </div>
    </div>
  );
}
