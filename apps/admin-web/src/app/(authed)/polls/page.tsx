'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ErrorState } from '@/components/ui/ErrorState';
import { BarChart3, Plus, X } from 'lucide-react';

interface PollOption {
  id: string;
  text: string;
  count: number;
  percentage: number;
}

interface Poll {
  id: string;
  question: string;
  deadline: string;
  totalVotes: number;
  status: 'ACTIVE' | 'CLOSED';
}

interface PollResults {
  id: string;
  question: string;
  deadline: string;
  status: 'ACTIVE' | 'CLOSED';
  options: PollOption[];
}

const defaultForm = {
  question: '',
  options: ['', ''],
  deadline: '',
  isAnonymous: false,
};

export default function PollsPage() {
  const qc = useQueryClient();
  const [selectedPollId, setSelectedPollId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState(defaultForm);

  const { data: polls, isLoading: pollsLoading, isError: pollsError, refetch: refetchPolls } = useQuery({
    queryKey: ['admin-polls'],
    queryFn: () => api.get<Poll[]>('/notices/admin/polls'),
  });

  const { data: results, isLoading: resultsLoading } = useQuery({
    queryKey: ['poll-results', selectedPollId],
    queryFn: () => api.get<PollResults>(`/notices/admin/polls/${selectedPollId}/results`),
    enabled: !!selectedPollId,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post('/notices/admin/polls', {
        ...form,
        question: form.question.trim(),
        options: form.options.map((o) => o.trim()).filter(Boolean),
        deadline: form.deadline ? new Date(form.deadline).toISOString() : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-polls'] });
      setShowCreateForm(false);
      setForm(defaultForm);
      toast.success('Poll created');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to create poll'),
  });

  const closeMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/notices/admin/polls/${id}/close`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-polls'] });
      qc.invalidateQueries({ queryKey: ['poll-results', selectedPollId] });
      toast.success('Poll closed');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to close poll'),
  });

  function confirmClose(id: string) {
    if (window.confirm('Close this poll? Residents will no longer be able to vote.')) {
      closeMutation.mutate(id);
    }
  }

  function addOption() {
    setForm((f) => ({ ...f, options: [...f.options, ''] }));
  }

  function removeOption(idx: number) {
    setForm((f) => ({ ...f, options: f.options.filter((_, i) => i !== idx) }));
  }

  function updateOption(idx: number, val: string) {
    setForm((f) => {
      const opts = [...f.options];
      opts[idx] = val;
      return { ...f, options: opts };
    });
  }

  const selectedPoll = polls?.find((p) => p.id === selectedPollId);
  const isPollActive = selectedPoll
    ? selectedPoll.status === 'ACTIVE' && new Date(selectedPoll.deadline) > new Date()
    : false;

  const chartData = results?.options.map((o) => ({ name: o.text, votes: o.count })) ?? [];

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Polls</h1>
        <button
          onClick={() => setShowCreateForm((v) => !v)}
          className="bg-primary-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary-600 transition-colors inline-flex items-center gap-1.5"
        >
          {showCreateForm ? <><X className="w-4 h-4" /> Cancel</> : <><Plus className="w-4 h-4" /> Create Poll</>}
        </button>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">New Poll</h2>
          <div className="space-y-4">
            <textarea
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-primary-400 min-h-[80px] resize-none"
              placeholder="Poll question *"
              value={form.question}
              onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
            />
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Options (min 2)</p>
              {form.options.map((opt, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary-400"
                    placeholder={`Option ${idx + 1}`}
                    value={opt}
                    onChange={(e) => updateOption(idx, e.target.value)}
                  />
                  {form.options.length > 2 && (
                    <button
                      onClick={() => removeOption(idx)}
                      className="text-gray-400 hover:text-red-500 px-2"
                      aria-label="Remove option"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={addOption}
                className="text-sm text-primary-600 hover:underline inline-flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Add Option
              </button>
            </div>
            <div className="flex gap-3">
              <input
                type="datetime-local"
                className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary-400"
                value={form.deadline}
                onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
              />
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isAnonymous}
                  onChange={(e) => setForm((f) => ({ ...f, isAnonymous: e.target.checked }))}
                  className="rounded"
                />
                Anonymous
              </label>
            </div>
            <button
              onClick={() => createMutation.mutate()}
              disabled={!form.question || form.options.filter((o) => o.trim()).length < 2 || !form.deadline || createMutation.isPending}
              className="bg-primary-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
            >
              {createMutation.isPending ? 'Creating…' : 'Create Poll'}
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-6">
        {/* Polls list */}
        <div className="w-1/3">
          {pollsLoading ? (
            <div className="py-16 text-center text-gray-400">Loading…</div>
          ) : pollsError ? (
            <ErrorState onRetry={refetchPolls} message="Polls couldn't be loaded. Your data is safe — please try again." />
          ) : !polls?.length ? (
            <div className="py-16 flex flex-col items-center text-center bg-white rounded-2xl border border-gray-200">
              <BarChart3 className="w-10 h-10 text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">No polls yet</p>
              <p className="text-gray-400 text-sm mt-1">Create your first poll to gather resident input.</p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="mt-4 bg-primary-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary-600 inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Create Poll
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {polls.map((poll) => (
                <button
                  key={poll.id}
                  onClick={() => setSelectedPollId(poll.id)}
                  className={cn(
                    'w-full text-left bg-white rounded-2xl border p-4 shadow-sm transition-colors',
                    selectedPollId === poll.id
                      ? 'border-primary-300 bg-primary-50'
                      : 'border-gray-100 hover:border-gray-200',
                  )}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-sm font-medium text-gray-900 line-clamp-2">{poll.question}</p>
                    <span className={cn('shrink-0 text-xs font-medium px-2 py-0.5 rounded-full', poll.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                      {poll.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    {poll.totalVotes} vote{poll.totalVotes !== 1 ? 's' : ''} · Deadline{' '}
                    {new Date(poll.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Results panel */}
        <div className="w-2/3">
          {!selectedPollId ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-20 flex items-center justify-center text-gray-400 text-sm">
              Select a poll to view results
            </div>
          ) : resultsLoading ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-20 flex items-center justify-center text-gray-400">
              Loading…
            </div>
          ) : results ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start justify-between mb-5">
                <h2 className="font-semibold text-gray-900 flex-1 pr-4">{results.question}</h2>
                {isPollActive && (
                  <button
                    onClick={() => confirmClose(results.id)}
                    disabled={closeMutation.isPending}
                    className="shrink-0 text-sm px-4 py-2 rounded-xl bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 disabled:opacity-40"
                  >
                    Close Poll
                  </button>
                )}
              </div>

              {/* Bar chart */}
              {chartData.length > 0 && (
                <div className="mb-5 h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="votes" radius={[4, 4, 0, 0]}>
                        {chartData.map((_, idx) => (
                          <Cell key={idx} fill="#821A52" />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Results table */}
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-500">
                    <th className="text-left py-2 font-medium">Option</th>
                    <th className="text-right py-2 font-medium">Votes</th>
                    <th className="text-right py-2 font-medium">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {results.options.map((opt) => (
                    <tr key={opt.id}>
                      <td className="py-2.5 text-gray-800">{opt.text}</td>
                      <td className="py-2.5 text-right font-medium text-gray-900">{opt.count}</td>
                      <td className="py-2.5 text-right text-gray-500">{opt.percentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
