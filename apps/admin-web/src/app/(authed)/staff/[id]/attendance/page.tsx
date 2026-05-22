'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ErrorState } from '@/components/ui/ErrorState';
import Link from 'next/link';

interface AttendanceRecord {
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  hoursWorked: number | null;
  late: boolean;
  status: 'PRESENT' | 'LATE' | 'ABSENT';
}

interface AttendanceSummary {
  totalDays: number;
  present: number;
  absent: number;
  late: number;
  avgHours: number;
}

interface AttendanceData {
  records: AttendanceRecord[];
  summary: AttendanceSummary;
}

const STATUS_META = {
  PRESENT: { label: 'Present', color: 'bg-green-100 text-green-700' },
  LATE: { label: 'Late', color: 'bg-amber-100 text-amber-700' },
  ABSENT: { label: 'Absent', color: 'bg-red-100 text-red-700' },
} as const;

function formatTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', weekday: 'short' });
}

async function downloadAttendanceCsv(staffId: string, month: string) {
  const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/v1';
  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
  const res = await fetch(`${base}/admin/staff/${staffId}/attendance/export?month=${month}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error('Export failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `attendance-${staffId}-${month}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function StaffAttendancePage() {
  const params = useParams();
  const staffId = params.id as string;

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
  );
  const [exporting, setExporting] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['staff-attendance', staffId, selectedMonth],
    queryFn: () => api.get<AttendanceData>(`/admin/staff/${staffId}/attendance?month=${selectedMonth}`),
    enabled: !!staffId,
  });

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/staff/${staffId}`} className="text-primary-500 hover:text-primary-600 text-sm inline-flex items-center gap-1.5">
            <ArrowLeft className="w-4 h-4" /> Staff Profile
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="month"
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary-400 bg-white"
            value={selectedMonth}
            max={`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`}
            onChange={(e) => setSelectedMonth(e.target.value)}
          />
          <button
            onClick={async () => {
              setExporting(true);
              try {
                await downloadAttendanceCsv(staffId, selectedMonth);
              } catch {
                toast.error('Export failed. Please try again.');
              } finally {
                setExporting(false);
              }
            }}
            disabled={exporting}
            className="text-sm px-4 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-gray-400">Loading…</div>
      ) : isError ? (
        <ErrorState onRetry={refetch} message="Attendance data couldn't be loaded. Please try again." />
      ) : !data ? null : (
        <>
          {/* Summary row */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide">Present</p>
              <p className="text-2xl font-bold text-green-600">{data.summary.present}</p>
              <p className="text-xs text-gray-400 mt-0.5">days</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide">Absent</p>
              <p className="text-2xl font-bold text-red-500">{data.summary.absent}</p>
              <p className="text-xs text-gray-400 mt-0.5">days</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide">Late</p>
              <p className="text-2xl font-bold text-amber-500">{data.summary.late}</p>
              <p className="text-xs text-gray-400 mt-0.5">days</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide">Avg Hours</p>
              <p className="text-2xl font-bold text-gray-900">{data.summary.avgHours.toFixed(1)}</p>
              <p className="text-xs text-gray-400 mt-0.5">hrs / day</p>
            </div>
          </div>

          {/* Daily table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {data.records.length === 0 ? (
              <div className="py-16 text-center">
                <CalendarDays className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No attendance records for this month</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    {['Date', 'Check In', 'Check Out', 'Hours', 'Status'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.records.map((rec) => {
                    const meta = STATUS_META[rec.status];
                    return (
                      <tr key={rec.date} className={cn('hover:bg-gray-50', rec.status === 'ABSENT' && 'opacity-60')}>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{formatDate(rec.date)}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{formatTime(rec.checkIn)}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{formatTime(rec.checkOut)}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {rec.hoursWorked != null ? `${rec.hoursWorked.toFixed(1)}h` : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', meta.color)}>
                            {meta.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
