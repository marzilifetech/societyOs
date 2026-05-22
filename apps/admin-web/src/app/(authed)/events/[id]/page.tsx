'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ErrorState } from '@/components/ui/ErrorState';

interface EventDetail {
  id: string;
  title: string;
  description: string;
  venue: string;
  startAt: string;
  endAt: string;
  maxAttendees: number | null;
  registeredCount: number;
  status: string;
}

interface EventForm {
  title: string;
  description: string;
  venue: string;
  maxAttendees: string;
}

interface Attendee {
  flatNumber?: string;
  name?: string;
  registeredAt?: string;
}

interface Feedback {
  avgRating?: number;
  reviewCount: number;
  reviews?: Array<{ comment?: string; rating: number; residentName?: string }>;
}

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EventForm | null>(null);
  const [notifyMsg, setNotifyMsg] = useState('');
  const [showNotify, setShowNotify] = useState(false);

  const { data: event, isLoading, isError, refetch, error } = useQuery<EventDetail>({
    queryKey: ['event', id],
    queryFn: () => api.get<EventDetail>(`/events/${id}`),
    retry: (count, err: Error) => !/not found/i.test(err.message) && count < 2,
  });

  useEffect(() => {
    if (event) {
      setForm({
        title: event.title,
        description: event.description,
        venue: event.venue,
        maxAttendees: event.maxAttendees != null ? String(event.maxAttendees) : '',
      });
    }
  }, [event]);

  const { data: attendees } = useQuery<Attendee[]>({
    queryKey: ['event-attendees', id],
    queryFn: () => api.get<Attendee[]>(`/admin/events/${id}/attendees`),
    enabled: !!event,
  });

  const { data: feedback } = useQuery<Feedback>({
    queryKey: ['event-feedback', id],
    queryFn: () => api.get<Feedback>(`/admin/events/${id}/feedback`),
    enabled: event?.status === 'COMPLETED',
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!form) throw new Error('Form not ready');
      return api.patch(`/admin/events/${id}`, {
        title: form.title.trim(),
        description: form.description.trim(),
        venue: form.venue.trim(),
        maxAttendees: form.maxAttendees ? Number(form.maxAttendees) : null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event', id] });
      qc.invalidateQueries({ queryKey: ['admin-events'] });
      setEditing(false);
      toast.success('Event updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.patch(`/admin/events/${id}/cancel`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event', id] });
      qc.invalidateQueries({ queryKey: ['admin-events'] });
      toast.success('Event cancelled');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const notifyMutation = useMutation({
    mutationFn: () => api.post(`/admin/events/${id}/notify`, { message: notifyMsg.trim() }),
    onSuccess: () => {
      setShowNotify(false);
      setNotifyMsg('');
      toast.success('Notification sent');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) return <div className="p-6 lg:p-8 text-gray-400">Loading…</div>;
  const notFound = isError && /not found/i.test((error as Error)?.message ?? '');
  if (notFound || (!isLoading && !isError && !event)) {
    return (
      <div className="p-6 lg:p-8">
        <Link href="/events" className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" />
          Back to Events
        </Link>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 flex flex-col items-center text-center">
          <p className="text-lg font-semibold text-gray-700">Event not found</p>
          <p className="text-sm text-gray-400 mt-1">It may have been deleted or the link is incorrect.</p>
        </div>
      </div>
    );
  }
  if (isError) return <div className="p-6 lg:p-8"><ErrorState onRetry={refetch} message="Event details couldn't be loaded. Your data is safe — please try again." /></div>;
  if (!event) return null;

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <Link href="/events" className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" />
          Back to Events
        </Link>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">{event.title}</h1>
          <div className="flex gap-2">
            {!editing ? (
              <button onClick={() => setEditing(true)} className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50">Edit</button>
            ) : (
              <>
                <button
                  onClick={() => updateMutation.mutate()}
                  disabled={updateMutation.isPending || !form?.title.trim() || !form?.description.trim() || !form?.venue.trim()}
                  className="bg-primary-500 text-white px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
                >
                  {updateMutation.isPending ? 'Saving…' : 'Save'}
                </button>
                <button onClick={() => setEditing(false)} className="bg-white border border-gray-200 text-gray-600 px-4 py-2 rounded-xl text-sm">Cancel</button>
              </>
            )}
            <button onClick={() => setShowNotify(true)} className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50">
              Notify Registrants
            </button>
            {event.status === 'PUBLISHED' && (
              <button onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending}
                className="border border-red-200 text-red-500 px-4 py-2 rounded-xl text-sm font-medium hover:bg-red-50 disabled:opacity-40">
                Cancel Event
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Date', value: new Date(event.startAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) },
          { label: 'Venue', value: event.venue },
          { label: 'Registrations', value: `${event.registeredCount}${event.maxAttendees ? ` / ${event.maxAttendees}` : ''}` },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{s.label}</p>
            <p className="font-semibold text-gray-900">{s.value}</p>
          </div>
        ))}
      </div>

      {editing && form && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Edit Event</h2>
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs text-gray-500 mb-1 block">Title *</span>
              <input className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary-400" placeholder="Title"
                value={form.title} onChange={(e) => setForm((f) => f && ({ ...f, title: e.target.value }))} />
            </label>
            <label className="block">
              <span className="text-xs text-gray-500 mb-1 block">Description *</span>
              <textarea className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none resize-none min-h-[80px] focus:border-primary-400" placeholder="Description"
                value={form.description} onChange={(e) => setForm((f) => f && ({ ...f, description: e.target.value }))} />
            </label>
            <label className="block">
              <span className="text-xs text-gray-500 mb-1 block">Venue *</span>
              <input className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary-400" placeholder="Venue"
                value={form.venue} onChange={(e) => setForm((f) => f && ({ ...f, venue: e.target.value }))} />
            </label>
            <label className="block">
              <span className="text-xs text-gray-500 mb-1 block">Max attendees</span>
              <input type="number" min={1} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary-400" placeholder="Optional"
                value={form.maxAttendees} onChange={(e) => setForm((f) => f && ({ ...f, maxAttendees: e.target.value }))} />
            </label>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-4">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Attendee List ({attendees?.length ?? 0})</h2>
        </div>
        {!attendees?.length ? (
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <Users className="w-10 h-10 text-gray-300 mb-3" />
            <p className="font-medium text-gray-700">No registrations yet</p>
            <p className="text-sm text-gray-400 mt-1">Residents who register will be listed here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Flat No', 'Resident Name', 'Registered On'].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {attendees.map((a, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-5 py-3 text-gray-700">{a.flatNumber ?? '—'}</td>
                  <td className="px-5 py-3 font-medium text-gray-900">{a.name ?? '—'}</td>
                  <td className="px-5 py-3 text-gray-400 text-xs">
                    {a.registeredAt ? new Date(a.registeredAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {feedback && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Post-Event Feedback</h2>
          <div className="flex items-center gap-4 mb-3">
            <p className="text-3xl font-bold text-gray-900">{feedback.avgRating?.toFixed(1) ?? '—'}<span className="text-lg font-normal text-gray-500">/5</span></p>
            <p className="text-sm text-gray-500">{feedback.reviewCount} responses</p>
          </div>
          {feedback.reviews?.map((r, i) => (
            <div key={i} className="border-t border-gray-100 py-3">
              <p className="text-sm text-gray-600">{r.comment}</p>
              <p className="text-xs text-gray-400 mt-1">{r.rating}/5 · {r.residentName}</p>
            </div>
          ))}
        </div>
      )}

      {showNotify && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowNotify(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-900 mb-4">Notify Registrants</h3>
            <textarea className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none resize-none min-h-[100px] mb-4"
              placeholder="Message to send to all registrants…"
              value={notifyMsg} onChange={(e) => setNotifyMsg(e.target.value)} />
            <div className="flex gap-3">
              <button onClick={() => notifyMutation.mutate()} disabled={!notifyMsg || notifyMutation.isPending}
                className="flex-1 bg-primary-500 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40">
                {notifyMutation.isPending ? 'Sending…' : 'Send Notification'}
              </button>
              <button onClick={() => setShowNotify(false)} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
