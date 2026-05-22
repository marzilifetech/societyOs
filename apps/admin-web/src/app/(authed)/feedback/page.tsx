'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ErrorState } from '@/components/ui/ErrorState';
import { MessageSquare, Star } from 'lucide-react';

type Feedback = {
  id: string;
  subject?: string;
  message: string;
  rating?: number;
  category?: string;
  isReviewed: boolean;
  createdAt: string;
  resident?: { name: string; unit?: { flatNumber: string } };
};

export default function FeedbackPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'REVIEWED'>('ALL');

  const { data: feedbacks, isLoading, isError, refetch } = useQuery<Feedback[]>({
    queryKey: ['admin-feedback'],
    queryFn: () => api.get<Feedback[]>('/feedback/admin/feedback'),
  });

  const reviewMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/feedback/admin/feedback/${id}/review`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-feedback'] });
      toast.success('Marked as reviewed');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to mark as reviewed'),
  });

  const filtered = feedbacks?.filter((f) => {
    if (filter === 'PENDING') return !f.isReviewed;
    if (filter === 'REVIEWED') return f.isReviewed;
    return true;
  }) ?? [];

  const pending = feedbacks?.filter((f) => !f.isReviewed).length ?? 0;
  const reviewed = feedbacks?.filter((f) => f.isReviewed).length ?? 0;

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Feedback</h1>
        <p className="text-gray-500 text-sm mt-1">{feedbacks?.length ?? 0} submissions · {pending} pending review</p>
      </div>

      <div className="flex gap-2 mb-6">
        {(['ALL', 'PENDING', 'REVIEWED'] as const).map((f) => {
          const count = f === 'ALL' ? (feedbacks?.length ?? 0) : f === 'PENDING' ? pending : reviewed;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-4 py-1.5 rounded-full text-sm font-medium border transition-colors flex items-center gap-1.5',
                filter === f ? 'bg-primary-500 border-primary-500 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300',
              )}
            >
              {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
              <span className={cn('text-xs rounded-full px-1.5 py-0.5 font-semibold', filter === f ? 'bg-white text-primary-600' : 'bg-gray-100 text-gray-600')}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {isLoading && <div className="py-16 text-center text-gray-400">Loading…</div>}
      {isError && <ErrorState onRetry={refetch} message="Feedback couldn't be loaded. Your data is safe — please try again." />}

      {!isLoading && !isError && filtered.length === 0 && (
        <div className="py-16 flex flex-col items-center text-center bg-white rounded-2xl border border-gray-200">
          <MessageSquare className="w-10 h-10 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No feedback yet</p>
          <p className="text-gray-400 text-sm mt-1">Resident feedback submissions will show up here.</p>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((fb) => (
          <div key={fb.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  {fb.category && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">{fb.category}</span>
                  )}
                  {fb.rating && (
                    <span className="inline-flex items-center gap-0.5 text-amber-500">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={cn('w-3.5 h-3.5', i < fb.rating! ? 'fill-amber-500' : 'text-gray-300')}
                        />
                      ))}
                    </span>
                  )}
                  <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', fb.isReviewed ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700')}>
                    {fb.isReviewed ? 'Reviewed' : 'Pending'}
                  </span>
                </div>
                {fb.subject && <h3 className="font-semibold text-gray-900 mb-1">{fb.subject}</h3>}
                <p className="text-sm text-gray-600">{fb.message}</p>
                <div className="flex items-center gap-3 mt-2">
                  {fb.resident && (
                    <span className="text-xs text-gray-500 font-medium">{fb.resident.name}</span>
                  )}
                  {fb.resident?.unit && (
                    <span className="text-xs text-gray-400">{fb.resident.unit.flatNumber}</span>
                  )}
                  <span className="text-xs text-gray-400">
                    {new Date(fb.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>

              {!fb.isReviewed && (
                <button
                  onClick={() => reviewMutation.mutate(fb.id)}
                  disabled={reviewMutation.isPending}
                  className="shrink-0 text-xs px-3 py-1.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  Mark Reviewed
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
