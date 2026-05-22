'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PiggyBank, Plus, X } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ErrorState } from '@/components/ui/ErrorState';

type BreakdownItem = { name: string; allocated: number; spent?: number };
type Budget = {
  id: string;
  year: number;
  totalBudget: number;
  totalSpent?: number;
  breakdown: BreakdownItem[];
};

const CURRENT_YEAR = new Date().getFullYear();

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <p className="text-xs text-gray-500 font-medium mb-1">{label}</p>
      <p className={cn('text-2xl font-bold', color)}>{value}</p>
    </div>
  );
}

function PublishForm({ onPublished }: { onPublished: () => void }) {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [totalBudget, setTotalBudget] = useState('');
  const [categories, setCategories] = useState<BreakdownItem[]>([{ name: '', allocated: 0 }]);
  const qc = useQueryClient();

  const publishMutation = useMutation({
    mutationFn: (body: { year: number; totalBudget: number; breakdown: BreakdownItem[] }) =>
      api.post('/societies/budget', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['society-budget'] });
      toast.success('Budget published');
      onPublished();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const addCategory = () => setCategories((prev) => [...prev, { name: '', allocated: 0 }]);
  const removeCategory = (i: number) => setCategories((prev) => prev.filter((_, idx) => idx !== i));
  const updateCategory = (i: number, field: keyof BreakdownItem, value: string | number) => {
    setCategories((prev) => prev.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validCats = categories
      .filter((c) => c.name.trim())
      .map((c) => ({ ...c, name: c.name.trim() }));
    publishMutation.mutate({ year, totalBudget: Number(totalBudget), breakdown: validCats });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 max-w-2xl">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Publish Budget</h2>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Year</label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary-400"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Total Budget (₹)</label>
          <input
            type="number"
            value={totalBudget}
            onChange={(e) => setTotalBudget(e.target.value)}
            placeholder="e.g. 5000000"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary-400"
            required
          />
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-gray-700">Breakdown</p>
          <button type="button" onClick={addCategory} className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium">
            <Plus className="w-4 h-4" /> Add Category
          </button>
        </div>
        <div className="space-y-2">
          {categories.map((cat, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                type="text"
                value={cat.name}
                onChange={(e) => updateCategory(i, 'name', e.target.value)}
                placeholder="Category name"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary-400"
              />
              <input
                type="number"
                value={cat.allocated || ''}
                onChange={(e) => updateCategory(i, 'allocated', Number(e.target.value))}
                placeholder="Amount (₹)"
                className="w-36 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary-400"
              />
              {categories.length > 1 && (
                <button type="button" onClick={() => removeCategory(i)} className="text-gray-400 hover:text-red-500 p-1" aria-label="Remove category">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={publishMutation.isPending}
        className="bg-primary-500 hover:bg-primary-600 text-white px-5 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-60"
      >
        {publishMutation.isPending ? 'Publishing…' : 'Publish Budget'}
      </button>
    </form>
  );
}

function BudgetDetail({ budget }: { budget: Budget }) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<BreakdownItem[]>(budget.breakdown ?? []);

  const saveMutation = useMutation({
    mutationFn: (breakdown: BreakdownItem[]) =>
      api.patch(`/societies/budget/${budget.id}`, { breakdown }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['society-budget'] });
      toast.success('Budget updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const totalSpent = budget.totalSpent ?? rows.reduce((s, r) => s + (r.spent ?? 0), 0);
  const remaining = budget.totalBudget - totalSpent;

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Budget" value={fmt(budget.totalBudget)} color="text-gray-900" />
        <StatCard label="Spent" value={fmt(totalSpent)} color="text-amber-600" />
        <StatCard label="Remaining" value={fmt(remaining)} color={remaining >= 0 ? 'text-green-600' : 'text-red-600'} />
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Breakdown</h2>
          <button
            onClick={() => saveMutation.mutate(rows)}
            disabled={saveMutation.isPending}
            className="text-xs bg-primary-500 hover:bg-primary-600 text-white px-4 py-1.5 rounded-lg transition-colors disabled:opacity-60"
          >
            {saveMutation.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-50">
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Category</th>
              <th className="text-right px-5 py-3 text-xs font-medium text-gray-500">Allocated (₹)</th>
              <th className="text-right px-5 py-3 text-xs font-medium text-gray-500">Spent (₹)</th>
              <th className="text-right px-5 py-3 text-xs font-medium text-gray-500">Remaining</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const spent = row.spent ?? 0;
              const rem = row.allocated - spent;
              return (
                <tr key={i} className="border-b border-gray-50 last:border-0">
                  <td className="px-5 py-3">
                    <input
                      value={row.name}
                      onChange={(e) => setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, name: e.target.value } : r))}
                      className="border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-primary-400 w-40"
                    />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <input
                      type="number"
                      value={row.allocated}
                      onChange={(e) => setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, allocated: Number(e.target.value) } : r))}
                      className="border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-primary-400 w-28 text-right"
                    />
                  </td>
                  <td className="px-5 py-3 text-right text-gray-600">{fmt(spent)}</td>
                  <td className={cn('px-5 py-3 text-right font-medium', rem >= 0 ? 'text-green-600' : 'text-red-600')}>
                    {fmt(rem)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

export default function BudgetPage() {
  const [tab, setTab] = useState<'current' | 'history'>('current');
  const [year, setYear] = useState(CURRENT_YEAR);

  const { data: budget, isLoading, isError, refetch } = useQuery({
    queryKey: ['society-budget', year],
    queryFn: () => api.get<Budget | null>(`/societies/budget?year=${year}`),
  });

  const { data: historyBudgets, isLoading: histLoading, isError: histError, refetch: histRefetch } = useQuery({
    queryKey: ['society-budget-history'],
    queryFn: () => api.get<Budget[]>('/societies/budget'),
    enabled: tab === 'history',
  });

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Society Budget</h1>
        <p className="text-gray-500 text-sm mt-1">Publish and manage annual society budgets</p>
      </div>

      <div className="flex gap-2 mb-6">
        {(['current', 'history'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-1.5 rounded-full text-sm font-medium border transition-colors',
              tab === t
                ? 'bg-primary-500 border-primary-500 text-white'
                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300',
            )}
          >
            {t === 'current' ? 'Current Year' : 'History'}
          </button>
        ))}
      </div>

      {tab === 'current' && (
        <div>
          <div className="flex items-center gap-3 mb-6">
            <label className="text-sm text-gray-600 font-medium">Year:</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-primary-400 w-24"
            />
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-gray-100 animate-pulse rounded-2xl" />
              ))}
            </div>
          ) : isError ? (
            <ErrorState onRetry={refetch} message="Budget data couldn't be loaded. Please try again." />
          ) : !budget ? (
            <PublishForm onPublished={() => {}} />
          ) : (
            <BudgetDetail budget={budget} />
          )}
        </div>
      )}

      {tab === 'history' && (
        <div>
          {histLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-gray-100 animate-pulse rounded-2xl" />
              ))}
            </div>
          ) : histError ? (
            <ErrorState onRetry={histRefetch} message="Budget history couldn't be loaded." />
          ) : !historyBudgets?.length ? (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm py-16 flex flex-col items-center text-center">
              <PiggyBank className="w-10 h-10 text-gray-300 mb-3" />
              <p className="text-sm font-medium text-gray-700">No budget history yet</p>
              <p className="text-xs text-gray-400 mt-1">Past annual budgets will appear here once published</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-50">
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Year</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-gray-500">Total Budget</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-gray-500">Spent</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-gray-500">Utilization</th>
                  </tr>
                </thead>
                <tbody>
                  {historyBudgets.map((b) => {
                    const spent = b.totalSpent ?? 0;
                    const pct = b.totalBudget > 0 ? Math.round((spent / b.totalBudget) * 100) : 0;
                    const fmt = (n: number) =>
                      new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
                    return (
                      <tr key={b.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                        <td className="px-5 py-3 font-semibold text-gray-900">{b.year}</td>
                        <td className="px-5 py-3 text-right text-gray-600">{fmt(b.totalBudget)}</td>
                        <td className="px-5 py-3 text-right text-gray-600">{fmt(spent)}</td>
                        <td className="px-5 py-3 text-right">
                          <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full',
                            pct > 90 ? 'bg-red-100 text-red-700' : pct > 70 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700')}>
                            {pct}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
