'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Vote, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { fromDateTimeLocalValue, formatDateTime } from '@/lib/datetime';
import { ErrorState } from '@/components/ui/ErrorState';

type Resolution = {
  id: string;
  title: string;
  description: string;
  /**
   * `AgmResolution` has no votingDeadline column — the service stashes it in
   * the `votes` JSON under a reserved key and now surfaces it here. It used to
   * render as `undefined`.
   */
  votingDeadline: string | null;
  voteSummary?: { FOR: number; AGAINST: number; ABSTAIN: number; total: number };
};

type Meeting = {
  id: string;
  title: string;
  date: string;
  status: string;
  agenda?: string[];
  resolutions: Resolution[];
};

type VoteResult = {
  resolutionId: string;
  title: string;
  forCount: number;
  againstCount: number;
  abstainCount: number;
};

export default function AGMPage() {
  const qc = useQueryClient();
  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [meetingForm, setMeetingForm] = useState({ title: '', date: '', agenda: '' });
  const [resolutionForms, setResolutionForms] = useState<Record<string, { title: string; description: string; votingDeadline: string }>>({});
  const [showResolutionForm, setShowResolutionForm] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, VoteResult[]>>({});

  const { data: meetings, isLoading, isError, refetch } = useQuery<Meeting[]>({
    queryKey: ['agm-meetings-admin'],
    queryFn: () => api.get<Meeting[]>('/agm/meetings'),
  });

  const createMeetingMutation = useMutation({
    // POST /agm/meetings did not exist at all — every "Schedule" click 404'd,
    // which is the "Cannot create a meeting" report.
    mutationFn: (body: object) => api.post('/agm/meetings', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agm-meetings-admin'] });
      toast.success('Meeting scheduled');
      setShowMeetingForm(false);
      setMeetingForm({ title: '', date: '', agenda: '' });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createResolutionMutation = useMutation({
    mutationFn: ({ meetingId, body }: { meetingId: string; body: object }) =>
      api.post('/agm/resolutions', { meetingId, ...body }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['agm-meetings-admin'] });
      toast.success('Resolution added');
      setShowResolutionForm(null);
      setResolutionForms((prev) => { const n = { ...prev }; delete n[vars.meetingId]; return n; });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const loadResults = async (resolutionId: string, meetingId: string) => {
    try {
      const data = await api.get<VoteResult[]>(`/agm/meetings/${meetingId}/results`);
      const arr = Array.isArray(data) ? data : [data];
      const filtered = arr.filter((r) => r.resolutionId === resolutionId);
      setResults((prev) => ({ ...prev, [meetingId]: [...(prev[meetingId] ?? []).filter((r) => r.resolutionId !== resolutionId), ...filtered] }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load results');
    }
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AGM Management</h1>
          <p className="text-gray-500 text-sm mt-1">{meetings?.length ?? 0} meetings</p>
        </div>
        <button
          onClick={() => setShowMeetingForm(!showMeetingForm)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-xl text-sm font-medium transition-colors"
        >
          {showMeetingForm ? 'Cancel' : <><Plus className="w-5 h-5" /> New Meeting</>}
        </button>
      </div>

      {showMeetingForm && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">New Meeting</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Title</label>
              <input
                value={meetingForm.title}
                onChange={(e) => setMeetingForm({ ...meetingForm, title: e.target.value })}
                placeholder="e.g. Annual General Meeting 2026"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Date &amp; time</label>
              {/* A meeting has a time, not just a date. A bare date sent
                  midnight, which read as the wrong day in some zones. */}
              <input
                type="datetime-local"
                value={meetingForm.date}
                onChange={(e) => setMeetingForm({ ...meetingForm, date: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary-400"
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Agenda <span className="text-gray-400 font-normal">(one item per line, optional)</span>
            </label>
            <textarea
              rows={3}
              value={meetingForm.agenda}
              onChange={(e) => setMeetingForm({ ...meetingForm, agenda: e.target.value })}
              placeholder={'Adoption of accounts\nElection of office bearers'}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary-400 resize-none"
            />
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={() =>
                createMeetingMutation.mutate({
                  title: meetingForm.title.trim(),
                  date: fromDateTimeLocalValue(meetingForm.date) ?? meetingForm.date,
                  agenda: meetingForm.agenda
                    .split('\n')
                    .map((line) => line.trim())
                    .filter(Boolean),
                })
              }
              disabled={createMeetingMutation.isPending || !meetingForm.title.trim() || !meetingForm.date}
              className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {createMeetingMutation.isPending ? 'Creating…' : 'Create Meeting'}
            </button>
          </div>
        </div>
      )}

      {isLoading && <div className="py-16 text-center text-gray-400">Loading…</div>}
      {isError && <ErrorState onRetry={refetch} message="Meeting information couldn't be loaded. Your data is safe — please try again." />}

      {!isLoading && !isError && meetings && meetings.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm py-16 flex flex-col items-center text-center">
          <Vote className="w-10 h-10 text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-700">No AGM meetings yet</p>
          <p className="text-xs text-gray-400 mt-1 mb-4">Schedule a meeting and add resolutions for residents to vote on</p>
          <button
            onClick={() => setShowMeetingForm(true)}
            className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-xl text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            New Meeting
          </button>
        </div>
      )}

      <div className="space-y-4">
        {meetings?.map((meeting) => {
          const rf = resolutionForms[meeting.id] ?? { title: '', description: '', votingDeadline: '' };
          const meetingResults = results[meeting.id] ?? [];
          return (
            <div key={meeting.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900">{meeting.title}</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {new Date(meeting.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                  meeting.status === 'ONGOING' ? 'bg-green-100 text-green-700' :
                  meeting.status === 'UPCOMING' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-600'
                }`}>{meeting.status}</span>
              </div>

              {/* Resolutions */}
              {meeting.resolutions?.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-gray-500 mb-2">RESOLUTIONS</p>
                  <div className="space-y-2">
                    {meeting.resolutions.map((r) => {
                      const result = meetingResults.find((res) => res.resolutionId === r.id);
                      return (
                        <div key={r.id} className="bg-gray-50 rounded-xl p-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">{r.title}</p>
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{r.description}</p>
                              {r.votingDeadline && (
                                <p className="text-[11px] text-gray-400 mt-0.5">
                                  Voting closes {formatDateTime(r.votingDeadline)}
                                </p>
                              )}
                              {(result || r.voteSummary) && (
                                <div className="flex gap-3 mt-2">
                                  <span className="text-xs text-green-700 font-medium">
                                    For: {result?.forCount ?? r.voteSummary?.FOR ?? 0}
                                  </span>
                                  <span className="text-xs text-red-700 font-medium">
                                    Against: {result?.againstCount ?? r.voteSummary?.AGAINST ?? 0}
                                  </span>
                                  <span className="text-xs text-amber-700 font-medium">
                                    Abstain: {result?.abstainCount ?? r.voteSummary?.ABSTAIN ?? 0}
                                  </span>
                                </div>
                              )}
                            </div>
                            <button onClick={() => loadResults(r.id, meeting.id)} className="text-xs text-primary-600 hover:text-primary-800 ml-3 font-medium shrink-0">
                              View Results
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Add Resolution */}
              {showResolutionForm === meeting.id ? (
                <div className="border border-gray-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-500 mb-3">ADD RESOLUTION</p>
                  <div className="space-y-3">
                    <input
                      value={rf.title}
                      onChange={(e) => setResolutionForms({ ...resolutionForms, [meeting.id]: { ...rf, title: e.target.value } })}
                      placeholder="Resolution title"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary-400"
                    />
                    <textarea
                      value={rf.description}
                      onChange={(e) => setResolutionForms({ ...resolutionForms, [meeting.id]: { ...rf, description: e.target.value } })}
                      placeholder="Description"
                      rows={2}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary-400 resize-none"
                    />
                    <input
                      type="datetime-local"
                      value={rf.votingDeadline}
                      onChange={(e) => setResolutionForms({ ...resolutionForms, [meeting.id]: { ...rf, votingDeadline: e.target.value } })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary-400"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => setShowResolutionForm(null)} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                      <button
                        onClick={() =>
                          createResolutionMutation.mutate({
                            meetingId: meeting.id,
                            body: {
                              title: rf.title.trim(),
                              description: rf.description.trim(),
                              // The picker speaks local wall-clock time; the API
                              // wants an ISO instant.
                              votingDeadline:
                                fromDateTimeLocalValue(rf.votingDeadline) ?? rf.votingDeadline,
                            },
                          })
                        }
                        disabled={createResolutionMutation.isPending || !rf.title.trim() || !rf.votingDeadline}
                        className="px-3 py-1.5 bg-primary-500 text-white rounded-lg text-xs font-medium disabled:opacity-50"
                      >
                        {createResolutionMutation.isPending ? 'Adding…' : 'Add Resolution'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowResolutionForm(meeting.id)}
                  className="text-xs text-primary-600 hover:text-primary-800 font-medium"
                >
                  + Add Resolution
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
