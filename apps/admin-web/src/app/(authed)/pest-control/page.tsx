'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bug, Plus, X } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ErrorState } from '@/components/ui/ErrorState';

type PestControlStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

const STATUS_META: Record<string, { label: string; color: string }> = {
  SCHEDULED:   { label: 'Scheduled',   color: 'bg-blue-100 text-blue-700' },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-amber-100 text-amber-700' },
  COMPLETED:   { label: 'Completed',   color: 'bg-green-100 text-green-700' },
  CANCELLED:   { label: 'Cancelled',   color: 'bg-gray-100 text-gray-600' },
};

const FILTERS = ['ALL', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;
type Filter = typeof FILTERS[number];

type PestControl = {
  id: string;
  pestType: string;
  scheduledDate: string;
  targetAreas: string[];
  notes?: string;
  status: PestControlStatus;
  createdAt: string;
};

type CreateForm = {
  pestType: string;
  scheduledDate: string;
  targetAreas: string;
  notes: string;
};

export default function PestControlPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateForm>({
    pestType: '',
    scheduledDate: '',
    targetAreas: '',
    notes: '',
  });

  const { data: items = [], isLoading, isError, refetch } = useQuery<PestControl[]>({
    queryKey: ['admin-pest-control'],
    queryFn: () => api.get<PestControl[]>('/pest-control'),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post('/pest-control', {
        pestType: form.pestType.trim(),
        scheduledDate: new Date(form.scheduledDate).toISOString(),
        targetAreas: form.targetAreas.split(',').map((s) => s.trim()).filter(Boolean),
        notes: form.notes.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-pest-control'] });
      toast.success('Pest control job scheduled');
      setShowForm(false);
      setForm({ pestType: '', scheduledDate: '', targetAreas: '', notes: '' });
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to create'),
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/pest-control/${id}/complete`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-pest-control'] });
      toast.success('Marked as completed');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed'),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/pest-control/${id}/cancel`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-pest-control'] });
      toast.success('Job cancelled');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed'),
  });

  const filtered = filter === 'ALL' ? items : items.filter((i) => i.status === filter);
  const isFormValid = form.pestType.trim() && form.scheduledDate && form.targetAreas.trim();

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pest Control</h1>
          <p className="text-gray-500 text-sm mt-1">Schedule and manage pest control jobs</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition inline-flex items-center gap-2"
        >
          {showForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          {showForm ? 'Cancel' : 'Schedule Job'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-4">New Pest Control Job</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Pest Type *</label>
              <input
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                placeholder="e.g. Cockroach, Termite, Rodent"
                value={form.pestType}
                onChange={(e) => setForm((f) => ({ ...f, pestType: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Scheduled Date *</label>
              <input
                type="datetime-local"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                value={form.scheduledDate}
                onChange={(e) => setForm((f) => ({ ...f, scheduledDate: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Target Areas * (comma-separated)</label>
              <input
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                placeholder="e.g. Kitchen, Basement, Garden"
                value={form.targetAreas}
                onChange={(e) => setForm((f) => ({ ...f, targetAreas: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Notes</label>
              <textarea
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                rows={2}
                placeholder="Additional instructions..."
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <button
            onClick={() => createMutation.mutate()}
            disabled={!isFormValid || createMutation.isPending}
            className="mt-4 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition"
          >
            {createMutation.isPending ? 'Scheduling…' : 'Schedule'}
          </button>
        </div>
      )}

      <div className="flex gap-2 mb-6 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium border transition',
              filter === f
                ? 'bg-primary-500 text-white border-primary-500'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300',
            )}
          >
            {f === 'ALL' ? 'All' : STATUS_META[f]?.label ?? f}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : isError ? (
        <ErrorState onRetry={refetch} message="Pest control jobs couldn't be loaded. Your data is safe — please try again." />
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm py-16 text-center">
          <Bug className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="font-medium text-gray-700">No pest control jobs yet</p>
          <p className="text-sm text-gray-400 mt-1 mb-4">Schedule the first job to get started.</p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition"
          >
            <Plus className="w-5 h-5" />
            Schedule Job
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((item) => {
            const meta = STATUS_META[item.status] ?? STATUS_META.SCHEDULED;
            return (
              <div key={item.id} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <p className="font-semibold text-gray-900">{item.pestType}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(item.scheduledDate).toLocaleString('en-IN', {
                        weekday: 'short', day: 'numeric', month: 'short',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full', meta.color)}>
                    {meta.label}
                  </span>
                </div>
                {item.targetAreas?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {item.targetAreas.map((area) => (
                      <span key={area} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {area}
                      </span>
                    ))}
                  </div>
                )}
                {item.notes && (
                  <p className="text-sm text-gray-500 italic mb-3">{item.notes}</p>
                )}
                {(item.status === 'SCHEDULED' || item.status === 'IN_PROGRESS') && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => completeMutation.mutate(item.id)}
                      disabled={completeMutation.isPending}
                      className="flex-1 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-xl py-2 transition disabled:opacity-50"
                    >
                      {completeMutation.isPending ? 'Completing…' : 'Mark Complete'}
                    </button>
                    <button
                      onClick={() => { if (window.confirm('Cancel this pest control job?')) cancelMutation.mutate(item.id); }}
                      disabled={cancelMutation.isPending}
                      className="flex-1 bg-white border border-red-300 text-red-600 hover:bg-red-50 text-sm font-semibold rounded-xl py-2 transition disabled:opacity-50"
                    >
                      {cancelMutation.isPending ? 'Cancelling…' : 'Cancel'}
                    </button>
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
