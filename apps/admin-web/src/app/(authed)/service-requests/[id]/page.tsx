'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Star, UserCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { toDateTimeLocalValue, fromDateTimeLocalValue, formatDateTime } from '@/lib/datetime';
import { cn } from '@/lib/cn';
import { ErrorState } from '@/components/ui/ErrorState';

function StarRating({ value }: { value: number }) {
  const full = Math.round(value);
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn('w-4 h-4', i <= full ? 'fill-amber-400 text-amber-400' : 'text-gray-200')}
        />
      ))}
      <span className="ml-1 text-sm text-gray-600">{value.toFixed(1)}</span>
    </span>
  );
}

interface StaffMember {
  id: string;
  name: string;
  designation: string;
  department?: string | null;
  categories: string[];
}

export default function ServiceRequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const id = params.id as string;

  const [assignOpen, setAssignOpen] = useState(false);

  const { data: sr, isLoading, isError, refetch } = useQuery({
    queryKey: ['service-request', id],
    queryFn: () => api.get<any>(`/service-requests/${id}`),
    enabled: !!id,
  });

  const { data: allStaff = [] } = useQuery<StaffMember[]>({
    queryKey: ['admin-staff'],
    queryFn: () => api.get<StaffMember[]>('/admin/staff'),
    enabled: assignOpen,
    staleTime: 60_000,
  });

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.patch(`/admin/service-requests/${id}`, data),
    onSuccess: () => {
      toast.success('Request updated');
      qc.invalidateQueries({ queryKey: ['service-request', id] });
      qc.invalidateQueries({ queryKey: ['admin-service-requests'] });
    },
    onError: (err: Error) => toast.error(err.message ?? 'Update failed'),
  });

  const assignMutation = useMutation({
    mutationFn: (staffId: string) =>
      api.patch(`/service-requests/${id}/assign`, { staffIds: [staffId] }),
    onSuccess: () => {
      toast.success('Staff assigned');
      qc.invalidateQueries({ queryKey: ['service-request', id] });
      qc.invalidateQueries({ queryKey: ['admin-service-requests'] });
      setAssignOpen(false);
    },
    onError: (err: Error) => toast.error(err.message ?? 'Assignment failed'),
  });

  if (isLoading) return <div className="p-8 text-gray-400">Loading…</div>;
  if (isError || !sr) {
    return (
      <div className="p-8">
        <ErrorState onRetry={refetch} message="Could not load service request." />
      </div>
    );
  }

  const residentName = sr.resident?.user?.name ?? '—';
  const flatNumber = sr.resident?.flat?.number ?? '—';
  const assignedStaff: { id: string; user?: { name?: string }; designation?: string }[] = sr.assignedStaff ?? [];
  const assignedNames = assignedStaff
    .map((s) => s.user?.name ?? s.designation)
    .filter(Boolean)
    .join(', ');
  const assignedIds = new Set(assignedStaff.map((s) => s.id));

  const srCategory = (sr.category ?? '').toUpperCase();
  const relevant = allStaff.filter((s) =>
    s.categories.some((c) => c.toUpperCase() === srCategory),
  );
  const others = allStaff.filter(
    (s) => !s.categories.some((c) => c.toUpperCase() === srCategory),
  );

  function renderStaffOption(s: StaffMember) {
    const assigned = assignedIds.has(s.id);
    return (
      <option key={s.id} value={s.id} disabled={assigned}>
        {s.name} — {s.designation}
        {assigned ? ' ✓' : ''}
      </option>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-3xl">
      <button
        onClick={() => router.push('/service-requests')}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Service Requests
      </button>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs text-gray-400 font-mono mb-1">#{sr.id.slice(0, 8)}</p>
            <h1 className="text-xl font-bold text-gray-900">{sr.category}</h1>
            <p className="text-sm text-gray-500 mt-1">{sr.status}</p>
          </div>
          {sr.isPaid ? (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-violet-100 text-violet-700">Paid</span>
          ) : (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">Free</span>
          )}
        </div>

        <div>
          <label className="text-xs font-medium text-gray-400 uppercase tracking-wide block mb-1">Description</label>
          <textarea
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary-400 min-h-[80px]"
            defaultValue={sr.description}
            onBlur={(e) => {
              if (e.target.value !== sr.description) {
                updateMutation.mutate({ description: e.target.value });
              }
            }}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wide block mb-1">Category</label>
            <input
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary-400"
              defaultValue={sr.category}
              onBlur={(e) => {
                if (e.target.value !== sr.category) updateMutation.mutate({ category: e.target.value });
              }}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wide block mb-1">Resident</label>
            <p className="text-sm text-gray-900">{residentName}</p>
            <p className="text-xs text-gray-500">Unit {flatNumber}</p>
          </div>

          {/* Assign Staff */}
          <div className="col-span-2">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wide block mb-1.5">
              Assigned Staff
            </label>

            {assignedNames && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {assignedStaff.map((s) => (
                  <span
                    key={s.id}
                    className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-primary-50 text-primary-700 border border-primary-100"
                  >
                    <UserCheck className="w-3 h-3" />
                    {s.user?.name ?? s.designation}
                  </span>
                ))}
              </div>
            )}

            {!assignOpen ? (
              <button
                onClick={() => setAssignOpen(true)}
                className="text-xs text-primary-600 hover:text-primary-700 font-medium"
              >
                {assignedNames ? 'Reassign / add staff…' : 'Assign staff…'}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <select
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-primary-400 bg-white"
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) assignMutation.mutate(e.target.value);
                  }}
                  disabled={assignMutation.isPending || allStaff.length === 0}
                >
                  <option value="" disabled>
                    {allStaff.length === 0 ? 'Loading staff…' : relevant.length > 0 ? `${relevant.length} suggested for ${sr.category}` : 'Select staff member…'}
                  </option>

                  {relevant.length > 0 && (
                    <optgroup label={`Suggested — ${sr.category}`}>
                      {relevant.map(renderStaffOption)}
                    </optgroup>
                  )}

                  {others.length > 0 && (
                    <optgroup label={relevant.length > 0 ? 'Other staff' : 'All staff'}>
                      {others.map(renderStaffOption)}
                    </optgroup>
                  )}
                </select>
                <button
                  onClick={() => setAssignOpen(false)}
                  className="text-xs text-gray-400 hover:text-gray-600 px-2"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wide block mb-1">Scheduled</label>
            {/*
              The picker shows, and returns, SOCIETY time (IST). Reading the raw
              ISO string with `.slice(0, 16)` put UTC wall-clock into a local
              field, so the value displayed here disagreed with the list by the
              5h30m offset and drifted by another 5h30m on every save.
            */}
            <input
              type="datetime-local"
              className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-primary-400"
              defaultValue={toDateTimeLocalValue(sr.scheduledTime)}
              onBlur={(e) => {
                const val = fromDateTimeLocalValue(e.target.value);
                const prev = sr.scheduledTime ? new Date(sr.scheduledTime).toISOString() : null;
                if (val !== prev) updateMutation.mutate({ scheduledTime: val ?? undefined });
              }}
            />
            {sr.scheduledTime && (
              <p className="mt-1 text-[11px] text-gray-400">
                Scheduled for {formatDateTime(sr.scheduledTime)} IST
              </p>
            )}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wide block mb-1">Reminder (minutes before)</label>
            <input
              type="number"
              min={1}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary-400"
              defaultValue={sr.reminderMinutes ?? ''}
              onBlur={(e) => {
                const n = e.target.value ? Number(e.target.value) : undefined;
                if (n !== sr.reminderMinutes) updateMutation.mutate({ reminderMinutes: n });
              }}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wide block mb-1">Paid request</label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                defaultChecked={!!sr.isPaid}
                onChange={(e) => updateMutation.mutate({ isPaid: e.target.checked })}
              />
              Mark as paid service
            </label>
          </div>
        </div>

        {(sr.tags ?? []).length > 0 && (
          <div>
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wide block mb-2">Tags</label>
            <div className="flex flex-wrap gap-1">
              {sr.tags.map((t: string) => (
                <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-sky-100 text-sky-700">{t}</span>
              ))}
            </div>
          </div>
        )}

        {sr.rating != null && (
          <div>
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wide block mb-2">Resident Feedback</label>
            <StarRating value={Number(sr.rating)} />
            {sr.ratingNote && <p className="text-sm text-gray-600 mt-2">{sr.ratingNote}</p>}
          </div>
        )}

        <div className="text-xs text-gray-400 border-t border-gray-100 pt-4">
          Created {new Date(sr.createdAt).toLocaleString('en-IN')}
          {sr.resolvedAt && <> · Resolved {new Date(sr.resolvedAt).toLocaleString('en-IN')}</>}
        </div>
      </div>
    </div>
  );
}
