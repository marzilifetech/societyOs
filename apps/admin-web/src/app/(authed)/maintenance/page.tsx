'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { MaintenanceBill } from '@societyos/api-client';
import { ErrorState } from '@/components/ui/ErrorState';
import Link from 'next/link';
import { Receipt, ChevronLeft, ChevronRight, X } from 'lucide-react';

type MaintenanceRemindResult = {
  sent: boolean;
  billId?: string;
  reason?: string;
  channel?: string;
  note?: string;
};

function unwrapEnvelopeData<T>(payload: unknown): T {
  if (
    payload !== null &&
    typeof payload === 'object' &&
    'data' in payload &&
    'meta' in payload &&
    'error' in payload &&
    (payload as { error: unknown }).error == null
  ) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

const STATUS_META = {
  PENDING: { label: 'Pending', color: 'bg-blue-100 text-blue-700' },
  PAID: { label: 'Paid', color: 'bg-green-100 text-green-700' },
  OVERDUE: { label: 'Overdue', color: 'bg-red-100 text-red-700' },
  PARTIAL: { label: 'Partial', color: 'bg-amber-100 text-amber-700' },
} as const;

type BillWithResident = MaintenanceBill & {
  resident?: { name: string; unit?: { flatNumber: string; tower?: string } };
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function MaintenancePage() {
  const qc = useQueryClient();
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'PAID' | 'OVERDUE'>('ALL');
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [genYear, setGenYear] = useState(String(currentDate.getFullYear()));
  const [genMonth, setGenMonth] = useState(String(currentDate.getMonth() + 1));
  const [genMessage, setGenMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data: bills, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-maintenance', selectedYear, selectedMonth],
    queryFn: () =>
      api.get<BillWithResident[]>(`/admin/maintenance/bills?year=${selectedYear}&month=${selectedMonth}`),
  });

  const sendReminderMutation = useMutation({
    mutationFn: async (id: string) => {
      const raw = await api.post<unknown>(`/admin/maintenance/bills/${id}/remind`, {});
      return unwrapEnvelopeData<MaintenanceRemindResult>(raw);
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['admin-maintenance'] });
      if (!data.sent) {
        const detail =
          data.note ??
          (data.reason === 'already_paid'
            ? 'This bill is already paid — no reminder was sent.'
            : data.reason
              ? `Reminder was not sent (${data.reason}).`
              : 'Reminder could not be sent.');
        toast.error(detail);
        return;
      }
      if (data.reason === 'queued_quiet_hours') {
        toast.success(data.note ?? 'Reminder queued; it will be delivered after quiet hours.');
        return;
      }
      toast.success('Reminder sent.');
    },
    onError: (err: Error) => {
      toast.error(err?.message ?? 'Failed to send reminder.');
    },
  });

  const generateBillsMutation = useMutation({
    mutationFn: ({ year, month }: { year: number; month: number }) =>
      api.post('/admin/maintenance/bills/generate', { year, month }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-maintenance'] });
      toast.success('Bills generated successfully.');
      setShowGenerateForm(false);
      setGenMessage(null);
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to generate bills. Please try again.');
    },
  });

  function handleGenerate() {
    const year = Number(genYear);
    const month = Number(genMonth);
    if (!year || month < 1 || month > 12) {
      toast.error('Please enter a valid year and month (1–12).');
      return;
    }
    if (!window.confirm(`Generate maintenance bills for ${MONTHS[month - 1]} ${year}? This will create bills for every active unit.`)) return;
    generateBillsMutation.mutate({ year, month });
  }

  const filtered = bills?.filter((b) => statusFilter === 'ALL' || b.status === statusFilter) ?? [];

  const totalAmount = bills?.reduce((sum, b) => sum + b.amount, 0) ?? 0;
  const paidAmount = bills?.filter((b) => b.status === 'PAID').reduce((sum, b) => sum + b.amount, 0) ?? 0;
  const pendingCount = bills?.filter((b) => b.status !== 'PAID').length ?? 0;

  const paidCount = bills?.filter(b => b.status === 'PAID').length ?? 0;
  const totalCount = bills?.length ?? 0;
  const ratio = totalCount > 0 ? paidCount / totalCount : 0;

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Maintenance Dues</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/maintenance/reports"
            className="border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
          >
            Reports
          </Link>
          <button
            className="bg-primary-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary-600 transition-colors inline-flex items-center gap-1.5"
            onClick={() => { setShowGenerateForm(!showGenerateForm); setGenMessage(null); }}
          >
            {showGenerateForm ? (<><X className="w-4 h-4" /> Cancel</>) : 'Generate Bills'}
          </button>
        </div>
      </div>

      {/* Generate Bills form */}
      {showGenerateForm && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Generate Bills</h2>
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Year</label>
              <input
                type="number"
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary-400 w-24"
                value={genYear}
                onChange={(e) => setGenYear(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Month (1–12)</label>
              <input
                type="number"
                min={1}
                max={12}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary-400 w-20"
                value={genMonth}
                onChange={(e) => setGenMonth(e.target.value)}
              />
            </div>
            <button
              className="bg-primary-500 text-white px-5 py-2 rounded-xl text-sm font-semibold disabled:opacity-40 hover:bg-primary-600 transition-colors"
              disabled={generateBillsMutation.isPending}
              onClick={handleGenerate}
            >
              {generateBillsMutation.isPending ? 'Generating…' : 'Generate'}
            </button>
          </div>
        </div>
      )}

      {genMessage && (
        <div className={cn('rounded-xl px-4 py-3 text-sm mb-4', genMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200')}>
          {genMessage.text}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-sm text-gray-500 mb-1">Total Billed</p>
          <p className="text-2xl font-bold text-gray-900">₹{totalAmount.toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-sm text-gray-500 mb-1">Collected</p>
          <p className="text-2xl font-bold text-green-600">₹{paidAmount.toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-sm text-gray-500 mb-1">Pending Units</p>
          <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
        </div>
      </div>

      {/* Collection progress */}
      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>Collection Rate</span>
          <span>{paidCount}/{totalCount} paid</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div
            className={cn('h-2 rounded-full transition-all', ratio >= 0.8 ? 'bg-green-500' : ratio >= 0.5 ? 'bg-amber-500' : 'bg-red-500')}
            style={{ width: `${ratio * 100}%` }}
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
            onClick={() => setSelectedYear((y) => y - 1)}
            aria-label="Previous year"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-gray-700 w-12 text-center">{selectedYear}</span>
          <button
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
            onClick={() => setSelectedYear((y) => y + 1)}
            aria-label="Next year"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-1 flex-wrap">
          {MONTHS.map((m, i) => (
            <button
              key={m}
              onClick={() => setSelectedMonth(i + 1)}
              className={cn(
                'px-3 py-1 rounded-lg text-sm font-medium transition-colors',
                selectedMonth === i + 1
                  ? 'bg-primary-500 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300',
              )}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="flex gap-2 ml-auto">
          {(['ALL', 'PENDING', 'PAID', 'OVERDUE'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-3 py-1 rounded-full text-sm font-medium border transition-colors',
                statusFilter === s
                  ? 'bg-primary-500 border-primary-500 text-white'
                  : 'bg-white border-gray-200 text-gray-600',
              )}
            >
              {s === 'ALL' ? 'All' : STATUS_META[s]?.label ?? s}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-gray-400">Loading…</div>
        ) : isError ? (
          <div className="p-6"><ErrorState onRetry={refetch} message="Maintenance bills couldn't be loaded. Your data is safe — please try again." /></div>
        ) : !filtered.length ? (
          <div className="py-16 flex flex-col items-center text-center">
            <Receipt className="w-10 h-10 text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No bills for this period</p>
            <p className="text-gray-400 text-sm mt-1">Generate bills for the selected month to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto"><table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {['Resident', 'Flat', 'Amount', 'Due Date', 'Paid On', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((b) => {
                const meta = STATUS_META[b.status];
                const isOverdue = b.status === 'OVERDUE';
                return (
                  <tr key={b.id} className={cn('hover:bg-gray-50', isOverdue && 'border-l-4 border-red-400')}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{b.resident?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {b.resident?.unit?.flatNumber ?? '—'}
                      {b.resident?.unit?.tower ? ` / ${b.resident.unit.tower}` : ''}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                      ₹{b.amount.toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(b.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {b.paidAt
                        ? new Date(b.paidAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', meta.color)}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {b.status !== 'PAID' && (
                        <button
                          className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
                          disabled={sendReminderMutation.isPending}
                          onClick={() => sendReminderMutation.mutate(b.id)}
                        >
                          Send Reminder
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}
