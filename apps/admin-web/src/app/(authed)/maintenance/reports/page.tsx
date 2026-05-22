'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ErrorState } from '@/components/ui/ErrorState';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface AgingBucket {
  count: number;
  amount: number;
}

interface AgingBuckets {
  current: AgingBucket;
  overdue30: AgingBucket;
  overdue60: AgingBucket;
  overdue90: AgingBucket;
}

interface MonthlyTrendItem {
  month: string;
  billed: number;
  collected: number;
}

interface ReportSummary {
  totalBilled: number;
  totalCollected: number;
  outstanding: number;
}

interface ReportsData {
  summary: ReportSummary;
  agingBuckets: AgingBuckets;
  monthlyTrend: MonthlyTrendItem[];
}

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/v1';

function fmt(amount: number) {
  return `₹${amount.toLocaleString('en-IN')}`;
}

const AGING_ROWS = [
  { key: 'current' as const, label: 'Current (0–30 days)', color: 'bg-green-100 text-green-700' },
  { key: 'overdue30' as const, label: 'Overdue 30–60 days', color: 'bg-amber-100 text-amber-700' },
  { key: 'overdue60' as const, label: 'Overdue 60–90 days', color: 'bg-orange-100 text-orange-700' },
  { key: 'overdue90' as const, label: 'Overdue 90+ days', color: 'bg-red-100 text-red-700' },
];

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthLabel(isoMonth: string) {
  const [, mm] = isoMonth.split('-');
  return MONTH_NAMES[parseInt(mm, 10) - 1] ?? isoMonth;
}

export default function MaintenanceReportsPage() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [exporting, setExporting] = useState(false);

  const yearOptions = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['maintenance-reports', selectedYear],
    queryFn: () => api.get<ReportsData>(`/admin/maintenance/reports?year=${selectedYear}`),
  });

  async function handleExport() {
    setExporting(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
      const url = `${BASE_URL}/admin/maintenance/reports/export?year=${selectedYear}`;
      const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `maintenance-report-${selectedYear}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      toast.error('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/maintenance" className="text-primary-600 text-sm hover:underline inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Maintenance
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Financial Reports</h1>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary-400 bg-white"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            className="bg-primary-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary-600 transition-colors disabled:opacity-40"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-gray-400">Loading…</div>
      ) : isError ? (
        <ErrorState onRetry={refetch} message="Reports couldn't be loaded. Please try again." />
      ) : !data ? null : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <p className="text-sm text-gray-500 mb-1">Total Billed</p>
              <p className="text-2xl font-bold text-gray-900">{fmt(data.summary.totalBilled)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <p className="text-sm text-gray-500 mb-1">Total Collected</p>
              <p className="text-2xl font-bold text-green-600">{fmt(data.summary.totalCollected)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <p className="text-sm text-gray-500 mb-1">Outstanding</p>
              <p className="text-2xl font-bold text-red-500">{fmt(data.summary.outstanding)}</p>
              <span className="inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                Unpaid
              </span>
            </div>
          </div>

          {/* Aging buckets */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm mb-6 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50">
              <h2 className="font-semibold text-gray-900">Aging Buckets</h2>
            </div>
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  {['Bucket', 'Count', 'Amount'].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {AGING_ROWS.map(({ key, label, color }) => {
                  const bucket = data.agingBuckets[key];
                  return (
                    <tr key={key} className="hover:bg-gray-50">
                      <td className="px-5 py-3 text-sm text-gray-700">
                        <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full mr-2', color)}>
                          {label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm font-medium text-gray-900">{bucket.count}</td>
                      <td className="px-5 py-3 text-sm font-semibold text-gray-900">{fmt(bucket.amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Monthly trend */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50">
              <h2 className="font-semibold text-gray-900">Monthly Trend — {selectedYear}</h2>
            </div>
            {data.monthlyTrend.length === 0 ? (
              <div className="py-10 text-center text-gray-400 text-sm">No data for this year yet.</div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    {['Month', 'Billed', 'Collected', 'Outstanding'].map((h) => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.monthlyTrend.map((row) => {
                    const outstanding = row.billed - row.collected;
                    return (
                      <tr key={row.month} className="hover:bg-gray-50">
                        <td className="px-5 py-3 text-sm font-medium text-gray-900">{monthLabel(row.month)}</td>
                        <td className="px-5 py-3 text-sm text-gray-700">{fmt(row.billed)}</td>
                        <td className="px-5 py-3 text-sm text-green-600 font-medium">{fmt(row.collected)}</td>
                        <td className="px-5 py-3 text-sm">
                          <span className={cn(
                            'font-medium',
                            outstanding > 0 ? 'text-red-500' : 'text-gray-400',
                          )}>
                            {fmt(outstanding)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
