'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft } from 'lucide-react';
import { ErrorState } from '@/components/ui/ErrorState';

type ComplaintDetail = {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  isAnonymous?: boolean;
  photos?: string[];
  rating?: number | null;
  ratingComment?: string | null;
  adminNote?: string | null;
  assignedTo?: string | null;
  createdAt: string;
  resident?: { name: string; phone?: string; unit?: { flatNumber?: string } };
};

type StaffOption = { id: string; name: string };

const STATUS_META: Record<string, { label: string; color: string }> = {
  OPEN: { label: 'Open', color: 'bg-blue-100 text-blue-700' },
  UNDER_REVIEW: { label: 'Under Review', color: 'bg-amber-100 text-amber-700' },
  RESOLVED: { label: 'Resolved', color: 'bg-green-100 text-green-700' },
  CLOSED: { label: 'Closed', color: 'bg-gray-100 text-gray-600' },
  REJECTED: { label: 'Rejected', color: 'bg-red-100 text-red-700' },
};

const ALL_STATUSES = ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED', 'CLOSED'];

export default function ComplaintDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [selectedStatus, setSelectedStatus] = useState('');
  const [resolutionNote, setResolutionNote] = useState('');
  const [assignee, setAssignee] = useState('');

  const { data: complaint, isLoading, isError, error, refetch } = useQuery<ComplaintDetail>({
    queryKey: ['complaint', id],
    queryFn: () => api.get<ComplaintDetail>(`/complaints/${id}`),
  });

  useEffect(() => {
    if (complaint) {
      setSelectedStatus(complaint.status);
      setAssignee(complaint.assignedTo ?? '');
    }
  }, [complaint]);

  const { data: staff } = useQuery<StaffOption[]>({
    queryKey: ['staff-list'],
    queryFn: () => api.get<StaffOption[]>('/admin/staff'),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      api.patch(`/admin/complaints/${id}/status`, {
        status: selectedStatus,
        adminNote: resolutionNote,
        assignedTo: assignee || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['complaint', id] });
      qc.invalidateQueries({ queryKey: ['admin-complaints'] });
      toast.success('Complaint updated');
    },
    onError: (err: Error & { code?: string }) => {
      toast.error(err.code ? `${err.message} (${err.code})` : err.message);
    },
  });

  if (isLoading) return <div className="p-6 lg:p-8 text-gray-400">Loading…</div>;
  const notFound = (error as Error | undefined)?.message?.toLowerCase().includes('not found');
  if (notFound) {
    return (
      <div className="p-6 lg:p-8">
        <Link href="/complaints" className="text-sm text-gray-500 hover:text-gray-700 inline-flex items-center gap-1 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Complaints
        </Link>
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <p className="text-gray-700 font-medium">Complaint not found</p>
          <p className="text-gray-400 text-sm mt-1">It may have been deleted or you don&apos;t have access.</p>
        </div>
      </div>
    );
  }
  if (isError) return <div className="p-6 lg:p-8"><ErrorState onRetry={refetch} message="Complaint details couldn't be loaded. Your data is safe — please try again." /></div>;
  if (!complaint) return <div className="p-6 lg:p-8 text-gray-400">Complaint not found</div>;

  const meta = STATUS_META[complaint.status] ?? STATUS_META.OPEN;

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <Link href="/complaints" className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Back to Complaints
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{complaint.title}</h1>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">{complaint.category}</span>
              <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', meta.color)}>{meta.label}</span>
              {complaint.isAnonymous && (
                <span className="text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full">Anonymous</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Description</h2>
            <p className="text-sm text-gray-600 leading-relaxed">{complaint.description}</p>
            {complaint.photos && complaint.photos.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-gray-500 mb-2">Attached Photos</p>
                <div className="flex gap-2 flex-wrap">
                  {complaint.photos.map((url: string, i: number) => (
                    <a key={i} href={url} target="_blank" rel="noreferrer"
                      className="w-20 h-20 rounded-xl bg-gray-100 overflow-hidden block relative">
                      <Image src={url} alt="Complaint photo" fill sizes="80px" className="object-cover" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {complaint.rating != null && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-semibold text-gray-900 mb-2">Resident Rating</h2>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-gray-900">{complaint.rating}/5</span>
                <span className="text-gray-500 text-sm">{complaint.ratingComment}</span>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Resident Info</h2>
            {!complaint.isAnonymous && complaint.resident ? (
              <div className="space-y-2 text-sm">
                <div><span className="text-gray-500">Name</span> <span className="text-gray-900 font-medium ml-2">{complaint.resident.name}</span></div>
                <div><span className="text-gray-500">Flat</span> <span className="text-gray-900 font-medium ml-2">{complaint.resident.unit?.flatNumber ?? '—'}</span></div>
                <div><span className="text-gray-500">Phone</span> <span className="text-gray-900 font-medium ml-2">{complaint.resident.phone ?? '—'}</span></div>
              </div>
            ) : (
              <p className="text-sm text-gray-400">Anonymous complaint</p>
            )}
            <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
              Submitted {new Date(complaint.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Update Status</h2>
            <div className="space-y-3">
              <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none">
                {ALL_STATUSES.map((s) => (
                  <option key={s} value={s}>{STATUS_META[s]?.label ?? s}</option>
                ))}
              </select>
              <select value={assignee} onChange={(e) => setAssignee(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none">
                <option value="">Assign to staff…</option>
                {staff?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              {(selectedStatus === 'RESOLVED' || selectedStatus === 'CLOSED') && (
                <textarea
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="Resolution notes…"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none resize-none min-h-[80px]"
                />
              )}
              <button
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending}
                className="w-full bg-primary-500 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
              >
                {updateMutation.isPending ? 'Updating…' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
