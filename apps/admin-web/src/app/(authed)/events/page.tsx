'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Calendar, Plus, Users, X } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { Society_Event, EventCategory } from '@societyos/api-client';
import { ErrorState } from '@/components/ui/ErrorState';

interface EventForm {
  title: string;
  description: string;
  category: EventCategory;
  startAt: string;
  venue: string;
  capacity: string;
}

const EMPTY_FORM: EventForm = {
  title: '',
  description: '',
  category: 'OTHER' as EventCategory,
  startAt: '',
  venue: '',
  capacity: '',
};

function toLocalInputValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const CATEGORY_COLORS: Record<EventCategory, string> = {
  SPORTS: 'bg-green-100 text-green-700',
  CULTURAL: 'bg-purple-100 text-purple-700',
  EDUCATIONAL: 'bg-blue-100 text-blue-700',
  SOCIAL: 'bg-amber-100 text-amber-700',
  RELIGIOUS: 'bg-red-100 text-red-700',
  MEETING: 'bg-indigo-100 text-indigo-700',
  WORKSHOP: 'bg-teal-100 text-teal-700',
  FESTIVAL: 'bg-pink-100 text-pink-700',
  OTHER: 'bg-gray-100 text-gray-600',
};

const STATUS_BADGE: Record<string, string> = {
  PUBLISHED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
  COMPLETED: 'bg-gray-100 text-gray-600',
};

/** Shape returned by GET /admin/events. */
type AdminEvent = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  startAt: string;
  venue: string;
  maxAttendees: number | null;
  registeredCount: number;
  status: string;
  isUpcoming: boolean;
  isCancelled: boolean;
  createdAt: string;
};

export default function EventsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EventForm>(EMPTY_FORM);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [notifyEventId, setNotifyEventId] = useState<string | null>(null);
  const [notifyMsg, setNotifyMsg] = useState('');

  const { data: events, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-events'],
    // `/events` only returns PUBLISHED rows, so cancelling made the event
    // disappear from this screen entirely — contradicting the confirmation copy
    // below ("the event remains visible with a cancelled status"). The admin
    // endpoint returns every event with a server-derived `isUpcoming`.
    queryFn: () =>
      api.get<AdminEvent[]>('/admin/events').then((rows) =>
        rows.map((e) => ({
          ...e,
          // Normalise to the field names this screen already renders.
          date: e.startAt,
          capacity: e.maxAttendees,
          registrationCount: e.registeredCount,
        })) as unknown as Society_Event[],
      ),
  });

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(false);
  };

  const trimmedPayload = () => ({
    title: form.title.trim(),
    description: form.description.trim(),
    category: form.category,
    date: form.startAt ? new Date(form.startAt).toISOString() : '',
    venue: form.venue.trim(),
    capacity: form.capacity ? Number(form.capacity) : undefined,
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/events', trimmedPayload()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-events'] });
      qc.invalidateQueries({ queryKey: ['events-upcoming'] });
      resetForm();
      toast.success('Event created');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: () => api.patch(`/events/admin/${editingId}`, trimmedPayload()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-events'] });
      qc.invalidateQueries({ queryKey: ['events-upcoming'] });
      resetForm();
      toast.success('Event updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/events/${id}/cancel`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-events'] });
      qc.invalidateQueries({ queryKey: ['events-upcoming'] });
      setConfirmCancelId(null);
      toast.success('Event cancelled');
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setConfirmCancelId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/events/admin/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-events'] });
      qc.invalidateQueries({ queryKey: ['events-upcoming'] });
      setConfirmDeleteId(null);
      toast.success('Event deleted');
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setConfirmDeleteId(null);
    },
  });

  const notifyMutation = useMutation({
    mutationFn: ({ id, message }: { id: string; message: string }) =>
      api.post(`/admin/events/${id}/notify`, { message }),
    onSuccess: () => {
      setNotifyEventId(null);
      setNotifyMsg('');
      toast.success('Notification sent');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const startEdit = (event: Society_Event) => {
    setEditingId(event.id);
    setForm({
      title: event.title ?? '',
      description: event.description ?? '',
      category: (event.category ?? 'OTHER') as EventCategory,
      startAt: toLocalInputValue(event.date),
      venue: event.venue ?? '',
      capacity: event.capacity != null ? String(event.capacity) : '',
    });
    setShowForm(true);
  };

  const submitForm = () => {
    if (editingId) updateMutation.mutate();
    else createMutation.mutate();
  };

  const formInvalid =
    !form.title.trim() ||
    !form.description.trim() ||
    !form.startAt ||
    !form.venue.trim();
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const CATEGORIES: EventCategory[] = ['SPORTS', 'CULTURAL', 'EDUCATIONAL', 'SOCIAL', 'RELIGIOUS', 'MEETING', 'WORKSHOP', 'FESTIVAL', 'OTHER'];

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Events</h1>
        <button
          className="bg-primary-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary-600 transition-colors inline-flex items-center gap-2"
          onClick={() => (showForm ? resetForm() : setShowForm(true))}
        >
          {showForm ? <><X className="w-4 h-4" />Cancel</> : <><Plus className="w-4 h-4" />New Event</>}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">{editingId ? 'Edit Event' : 'Create Event'}</h2>
          <div className="space-y-4">
            <input
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary-400"
              placeholder="Title *"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
            <textarea
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-primary-400 min-h-[80px] resize-none"
              placeholder="Description *"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
            <div className="grid grid-cols-2 gap-3">
              <select
                className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as EventCategory }))}
              >
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <input
                className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary-400"
                placeholder="Venue *"
                value={form.venue}
                onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Date & time *</label>
              <input
                type="datetime-local"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none"
                value={form.startAt}
                onChange={(e) => setForm((f) => ({ ...f, startAt: e.target.value }))}
              />
            </div>
            <input
              type="number"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary-400"
              placeholder="Capacity (optional)"
              value={form.capacity}
              onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
            />
            <div className="flex items-center gap-3">
              <button
                className="bg-primary-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
                onClick={submitForm}
                disabled={formInvalid || isSubmitting}
              >
                {isSubmitting ? (editingId ? 'Saving…' : 'Creating…') : editingId ? 'Save Changes' : 'Create Event'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {isLoading ? (
          <div className="py-16 text-center text-gray-400">Loading…</div>
        ) : isError ? (
          <ErrorState onRetry={refetch} message="Events couldn't be loaded. Your data is safe — please try again." />
        ) : !events?.length ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 flex flex-col items-center justify-center text-center">
            <Calendar className="w-10 h-10 text-gray-300 mb-3" />
            <p className="font-medium text-gray-700">No events yet</p>
            <p className="text-sm text-gray-400 mt-1 mb-4">Create your first community event so residents can register.</p>
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />Create Event
            </button>
          </div>
        ) : (
          [...events]
            .sort((a, b) => {
              // Live events first, then by date. A cancelled event should not
              // sit above the ones people can still attend.
              const aDead = (a as any).isCancelled || new Date(a.date) < new Date();
              const bDead = (b as any).isCancelled || new Date(b.date) < new Date();
              if (aDead !== bDead) return aDead ? 1 : -1;
              return new Date(a.date).getTime() - new Date(b.date).getTime();
            })
            .map((event) => {
            const catColor = CATEGORY_COLORS[event.category] ?? 'bg-gray-100 text-gray-600';
            const isFull = event.capacity != null && event.registrationCount >= event.capacity;
            const capacityPct = event.capacity
              ? Math.min(100, Math.round((event.registrationCount / event.capacity) * 100))
              : null;
            const isPast = new Date(event.date) < new Date();
            const eventStatus: string = (event as any).status ?? (isPast ? 'COMPLETED' : 'PUBLISHED');
            const isPublished = eventStatus === 'PUBLISHED';

            return (
              <div key={event.id} className={cn('bg-white rounded-2xl border shadow-sm p-5', isPast ? 'border-gray-100 opacity-60' : 'border-gray-100')}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0 mr-4">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', catColor)}>
                        {event.category}
                      </span>
                      <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', STATUS_BADGE[eventStatus] ?? 'bg-gray-100 text-gray-600')}>
                        {eventStatus}
                      </span>
                      {isFull && (
                        <span className="text-xs bg-red-100 text-red-600 px-2.5 py-1 rounded-full">Full</span>
                      )}
                      {isPast && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full">Past</span>
                      )}
                    </div>
                    <h3 className="font-semibold text-gray-900">{event.title}</h3>
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{event.description}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={`/events/${event.id}`}
                      className="text-xs text-primary-600 border border-primary-200 px-3 py-1.5 rounded-lg hover:bg-primary-50 transition-colors inline-flex items-center gap-1.5"
                    >
                      <Users className="w-4 h-4" />
                      {event.registrationCount} attending
                    </a>
                    <button
                      className="text-xs text-gray-700 hover:text-gray-900 border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg transition-colors"
                      onClick={() => startEdit(event)}
                    >
                      Edit
                    </button>
                    {event.registrationCount > 0 && (
                      <button
                        className="text-xs text-primary-600 hover:text-primary-700 border border-primary-200 hover:border-primary-300 px-3 py-1.5 rounded-lg transition-colors"
                        onClick={() => {
                          setNotifyEventId(event.id);
                          setNotifyMsg(`Reminder: ${event.title} is happening on ${new Date(event.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`);
                        }}
                      >
                        Notify
                      </button>
                    )}
                    {isPublished && (
                      <button
                        className="text-xs text-amber-600 hover:text-amber-700 border border-amber-200 hover:border-amber-300 px-3 py-1.5 rounded-lg transition-colors"
                        onClick={() => setConfirmCancelId(event.id)}
                      >
                        Cancel Event
                      </button>
                    )}
                    <button
                      className="text-xs text-red-500 hover:text-red-600 border border-red-200 hover:border-red-300 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                      onClick={() => setConfirmDeleteId(event.id)}
                      disabled={deleteMutation.isPending}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs text-gray-500 mb-3">
                  <div>
                    <span className="text-gray-400 block">Venue</span>
                    {event.venue}
                  </div>
                  <div>
                    <span className="text-gray-400 block">Date</span>
                    {new Date(event.date).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>

                {event.capacity != null && capacityPct !== null && (
                  <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{event.registrationCount} registered</span>
                      <span>{event.capacity} capacity</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', isFull ? 'bg-red-400' : 'bg-primary-500')}
                        style={{ width: `${capacityPct}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setConfirmDeleteId(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900 mb-2">Delete this event?</h3>
            <p className="text-sm text-gray-600 mb-4">
              This permanently removes the event and any registrations. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                className="flex-1 bg-gray-100 text-gray-700 rounded-xl py-2.5 text-sm font-semibold hover:bg-gray-200 transition-colors"
                onClick={() => setConfirmDeleteId(null)}
              >
                Cancel
              </button>
              <button
                className="flex-1 bg-red-500 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-red-600 disabled:opacity-50 transition-colors"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(confirmDeleteId)}
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmCancelId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setConfirmCancelId(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900 mb-2">Cancel this event?</h3>
            <p className="text-sm text-gray-600 mb-4">
              Registered attendees will be notified. The event remains visible with a cancelled status.
            </p>
            <div className="flex gap-3">
              <button
                className="flex-1 bg-gray-100 text-gray-700 rounded-xl py-2.5 text-sm font-semibold hover:bg-gray-200 transition-colors"
                onClick={() => setConfirmCancelId(null)}
              >
                Keep Event
              </button>
              <button
                className="flex-1 bg-amber-500 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 transition-colors"
                disabled={cancelMutation.isPending}
                onClick={() => cancelMutation.mutate(confirmCancelId)}
              >
                {cancelMutation.isPending ? 'Cancelling…' : 'Cancel Event'}
              </button>
            </div>
          </div>
        </div>
      )}

      {notifyEventId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setNotifyEventId(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900 mb-3">Notify Registrants</h3>
            <textarea
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-primary-400 resize-none min-h-[100px] mb-4"
              placeholder="Message to send to all registrants…"
              value={notifyMsg}
              onChange={(e) => setNotifyMsg(e.target.value)}
            />
            <div className="flex gap-3">
              <button
                className="flex-1 bg-primary-500 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-primary-600 disabled:opacity-40 transition-colors"
                disabled={!notifyMsg || notifyMutation.isPending}
                onClick={() => notifyMutation.mutate({ id: notifyEventId, message: notifyMsg })}
              >
                {notifyMutation.isPending ? 'Sending…' : 'Send Notification'}
              </button>
              <button
                className="flex-1 bg-gray-100 text-gray-700 rounded-xl py-2.5 text-sm font-semibold hover:bg-gray-200 transition-colors"
                onClick={() => setNotifyEventId(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
