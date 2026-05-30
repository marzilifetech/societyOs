'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import { toast } from 'sonner';
import { Users, X, ChevronDown } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ErrorState } from '@/components/ui/ErrorState';

type DomesticHelpRole = 'MAID' | 'COOK' | 'DRIVER' | 'NANNY' | 'GARDENER' | 'OTHER';
type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'HALF_DAY';

interface AttendanceRecord {
  id: string;
  date: string;
  status: AttendanceStatus;
  notes?: string;
}

interface DomesticHelper {
  id: string;
  name: string;
  role: DomesticHelpRole;
  phone: string;
  photoUrl?: string;
  isActive: boolean;
  resident?: {
    id: string;
    name: string;
    unit?: { flatNumber: string };
  };
  todayAttendance?: AttendanceRecord;
  createdAt: string;
}

const ROLE_COLORS: Record<string, string> = {
  MAID: 'bg-pink-100 text-pink-700',
  COOK: 'bg-orange-100 text-orange-700',
  DRIVER: 'bg-blue-100 text-blue-700',
  NANNY: 'bg-purple-100 text-purple-700',
  GARDENER: 'bg-green-100 text-green-700',
  OTHER: 'bg-gray-100 text-gray-600',
};

const ATTENDANCE_META: Record<AttendanceStatus, { label: string; color: string }> = {
  PRESENT: { label: 'Present', color: 'bg-green-100 text-green-700' },
  ABSENT: { label: 'Absent', color: 'bg-red-100 text-red-700' },
  HALF_DAY: { label: 'Half Day', color: 'bg-amber-100 text-amber-700' },
};

const ROLE_FILTERS: Array<'ALL' | DomesticHelpRole> = ['ALL', 'MAID', 'COOK', 'DRIVER', 'NANNY', 'GARDENER', 'OTHER'];

function AttendanceLogPanel({ helperId }: { helperId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['domestic-attendance', helperId],
    queryFn: () => api.get<AttendanceRecord[]>(`/domestic-help/${helperId}/attendance`),
  });

  if (isLoading) {
    return <p className="text-xs text-gray-400 py-2">Loading attendance…</p>;
  }

  if (!data?.length) {
    return <p className="text-xs text-gray-400 py-2">No attendance records</p>;
  }

  return (
    <div className="space-y-1.5 mt-2">
      {data.slice(0, 7).map((rec) => {
        const meta = ATTENDANCE_META[rec.status];
        return (
          <div key={rec.id} className="flex items-center gap-3 text-xs">
            <span className="text-gray-500 w-24 shrink-0">
              {new Date(rec.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </span>
            <span className={cn('px-2 py-0.5 rounded-full font-medium', meta.color)}>
              {meta.label}
            </span>
            {rec.notes && <span className="text-gray-400 truncate">{rec.notes}</span>}
          </div>
        );
      })}
    </div>
  );
}

function MarkAttendanceModal({ helper, onClose }: { helper: DomesticHelper; onClose: () => void }) {
  const qc = useQueryClient();
  const today = new Date().toISOString().split('T')[0];
  const [status, setStatus] = useState<AttendanceStatus>('PRESENT');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const mutation = useMutation({
    mutationFn: (data: { date: string; status: AttendanceStatus; notes?: string }) =>
      api.post(`/domestic-help/${helper.id}/attendance`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['domestic-help'] });
      qc.invalidateQueries({ queryKey: ['domestic-attendance', helper.id] });
      toast.success('Attendance recorded');
      onClose();
    },
    onError: (err: Error) => {
      setError(err.message ?? 'Failed to mark attendance');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    mutation.mutate({ date: today, status, notes: notes.trim() || undefined });
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-gray-900">Mark Attendance</h2>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-4">{helper.name} · {today}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            {(['PRESENT', 'ABSENT', 'HALF_DAY'] as AttendanceStatus[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={cn(
                  'flex-1 py-2 rounded-xl text-xs font-medium border transition-colors',
                  status === s
                    ? 'bg-primary-500 border-primary-500 text-white'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300',
                )}
              >
                {ATTENDANCE_META[s].label}
              </button>
            ))}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes (optional)</label>
            <input
              type="text"
              placeholder="Any notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary-400"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 bg-primary-500 text-white text-sm font-medium py-2.5 rounded-xl hover:bg-primary-600 transition-colors disabled:opacity-50"
            >
              {mutation.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function DomesticHelpPage() {
  const [roleFilter, setRoleFilter] = useState<'ALL' | DomesticHelpRole>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [attendanceHelper, setAttendanceHelper] = useState<DomesticHelper | null>(null);

  const { data: helpers, isLoading, isError, refetch } = useQuery({
    queryKey: ['domestic-help'],
    queryFn: () => api.get<DomesticHelper[]>('/admin/domestic-help'),
  });

  const filtered = (helpers ?? []).filter((h) =>
    roleFilter === 'ALL' || h.role === roleFilter,
  );

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const counts: Partial<Record<'ALL' | DomesticHelpRole, number>> = {
    ALL: helpers?.length ?? 0,
  };
  for (const role of (['MAID', 'COOK', 'DRIVER', 'NANNY', 'GARDENER', 'OTHER'] as DomesticHelpRole[])) {
    counts[role] = helpers?.filter((h) => h.role === role).length ?? 0;
  }

  return (
    <div className="p-6 lg:p-8">
      {attendanceHelper && (
        <MarkAttendanceModal helper={attendanceHelper} onClose={() => setAttendanceHelper(null)} />
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Domestic Help</h1>
        <p className="text-gray-500 text-sm mt-1">{helpers?.length ?? 0} registered helpers</p>
      </div>

      {/* Role filter tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {ROLE_FILTERS.map((role) => (
          <button
            key={role}
            onClick={() => setRoleFilter(role)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors flex items-center gap-1.5',
              roleFilter === role
                ? 'bg-primary-500 border-primary-500 text-white'
                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300',
            )}
          >
            {role === 'ALL' ? 'All' : role.charAt(0) + role.slice(1).toLowerCase()}
            <span className={cn(
              'text-xs rounded-full px-1.5 py-0.5',
              roleFilter === role ? 'bg-white text-primary-600' : 'bg-gray-100 text-gray-600',
            )}>
              {counts[role] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Helper cards */}
      {isLoading ? (
        <div className="py-16 text-center text-gray-400">Loading…</div>
      ) : isError ? (
        <ErrorState onRetry={refetch} message="Staff information couldn't be loaded. Your data is safe — please try again." />
      ) : !filtered.length ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm py-16 flex flex-col items-center justify-center text-center">
          <Users className="w-10 h-10 text-gray-300 mb-3" />
          <p className="font-medium text-gray-700">No helpers found</p>
          <p className="text-sm text-gray-400 mt-1">Registered domestic helpers will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((helper) => {
            const isExpanded = expandedId === helper.id;
            const todayAtt = helper.todayAttendance;

            return (
              <div
                key={helper.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
              >
                <div
                  className="p-4 flex items-center gap-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => toggleExpand(helper.id)}
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-gray-200 shrink-0 overflow-hidden flex items-center justify-center relative">
                    {helper.photoUrl ? (
                      <Image src={helper.photoUrl} alt={helper.name} fill sizes="40px" className="object-cover" />
                    ) : (
                      <span className="text-gray-500 text-sm font-semibold">
                        {helper.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900">{helper.name}</p>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', ROLE_COLORS[helper.role] ?? 'bg-gray-100 text-gray-600')}>
                        {helper.role.charAt(0) + helper.role.slice(1).toLowerCase()}
                      </span>
                      {!helper.isActive && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Inactive</span>
                      )}
                      {todayAtt && (
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', ATTENDANCE_META[todayAtt.status].color)}>
                          Today: {ATTENDANCE_META[todayAtt.status].label}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <p className="text-xs text-gray-500">{helper.phone}</p>
                      {helper.resident && (
                        <>
                          <span className="text-gray-300">·</span>
                          <p className="text-xs text-gray-500">
                            {helper.resident.name}
                            {helper.resident.unit && ` · Flat ${helper.resident.unit.flatNumber}`}
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setAttendanceHelper(helper);
                      }}
                      className="text-xs bg-primary-50 hover:bg-primary-100 text-primary-700 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Mark Attendance
                    </button>
                    <ChevronDown className={cn('w-4 h-4 text-gray-400 transition-transform', isExpanded && 'rotate-180')} />
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-50">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-3 mb-2">
                      Attendance Log (last 7 days)
                    </p>
                    <AttendanceLogPanel helperId={helper.id} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
