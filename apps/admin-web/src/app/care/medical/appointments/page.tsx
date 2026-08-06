'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarDays, Star, AlertCircle, Check } from 'lucide-react';
import { careApi } from '@/lib/care-api';
import { CareHeader } from '@/components/care/chrome';
import { Button, EmptyState, StatusPill, Modal, Field, Textarea, cn } from '@/components/primitives';
import {
  type Appointment,
  statusMeta,
  isUpcoming,
  fmtDateTime,
  StarRating,
} from './../_components';

type Tab = 'all' | 'upcoming' | 'past';

const CANCEL_REASONS = [
  'Booked by mistake',
  'Feeling better now',
  'Appointment not needed',
  "Can't make this time",
];

async function fetchAppointments(): Promise<Appointment[]> {
  try {
    return await careApi.get<Appointment[]>('/medical/appointments/mine');
  } catch {
    return careApi.get<Appointment[]>('/medical/appointments');
  }
}

function AppointmentCard({
  apt,
  onCancel,
  onRate,
}: {
  apt: Appointment;
  onCancel: (apt: Appointment) => void;
  onRate: (apt: Appointment) => void;
}) {
  const router = useRouter();
  const meta = statusMeta(apt.status);
  const upcoming = isUpcoming(apt.status);
  const done = apt.status === 'COMPLETED';
  const go = () => router.push(`/care/medical/appointments/${apt.id}`);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={go}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          go();
        }
      }}
      className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4 active:bg-gray-50 transition-colors cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-[15px] font-semibold text-gray-950">
          Dr. {apt.doctor?.name ?? 'Appointment'}
        </p>
        <div className="flex items-center gap-1.5 shrink-0">
          <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
          {done && typeof apt.rating === 'number' && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
              <Star className="w-3 h-3 fill-emerald-500 text-emerald-500" />
              {apt.rating}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-[13px] text-gray-500">
        <CalendarDays className="w-3.5 h-3.5" />
        {fmtDateTime(apt.date, apt.timeSlot)}
      </div>

      {(apt.reason || apt.notes) && (
        <p className="text-[13px] text-gray-600 mt-1.5 truncate">{apt.reason ?? apt.notes}</p>
      )}

      {/* Actions */}
      {upcoming ? (
        <div className="flex gap-2.5 mt-3">
          <Button
            variant="secondary"
            fullWidth
            className="h-11 rounded-xl text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
            onClick={(e) => {
              e.stopPropagation();
              onCancel(apt);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            fullWidth
            className="h-11 rounded-xl"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/care/medical/appointments/${apt.id}`);
            }}
          >
            Reschedule
          </Button>
        </div>
      ) : done ? (
        <div className="flex gap-2.5 mt-3">
          {typeof apt.rating !== 'number' && (
            <Button
              variant="secondary"
              fullWidth
              className="h-11 rounded-xl"
              onClick={(e) => {
                e.stopPropagation();
                onRate(apt);
              }}
            >
              Rate
            </Button>
          )}
          <Button
            variant="primary"
            fullWidth
            className="h-11 rounded-xl"
            onClick={(e) => {
              e.stopPropagation();
              router.push(
                apt.doctorId
                  ? `/care/medical/book?doctorId=${apt.doctorId}`
                  : '/care/medical/book',
              );
            }}
          >
            Book again
          </Button>
        </div>
      ) : (
        <Button
          variant="secondary"
          fullWidth
          className="h-11 rounded-xl mt-3"
          onClick={(e) => {
            e.stopPropagation();
            router.push(
              apt.doctorId ? `/care/medical/book?doctorId=${apt.doctorId}` : '/care/medical/book',
            );
          }}
        >
          Book again
        </Button>
      )}
    </div>
  );
}

export default function AppointmentHistory() {
  const router = useRouter();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('all');

  // Cancel modal
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState<string | null>(null);
  const [cancelComment, setCancelComment] = useState('');

  // Rate modal
  const [rateTarget, setRateTarget] = useState<Appointment | null>(null);
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState('');

  const {
    data: appointments,
    isLoading,
    isError,
    refetch,
  } = useQuery<Appointment[]>({
    queryKey: ['medical', 'appointments'],
    queryFn: fetchAppointments,
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) =>
      careApi.patch(`/medical/appointments/${id}/cancel`, {
        reason: cancelReason ?? undefined,
        comment: cancelComment.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['medical', 'appointments'] });
      closeCancel();
      toast.success('Appointment cancelled');
    },
    onError: (e: Error) => toast.error(e.message || 'Could not cancel'),
  });

  const rateMutation = useMutation({
    mutationFn: (id: string) =>
      careApi.post(`/medical/appointments/${id}/rate`, {
        rating,
        comment: ratingComment.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['medical', 'appointments'] });
      closeRate();
      toast.success('Thanks for your feedback');
    },
    onError: (e: Error) => toast.error(e.message || 'Could not submit rating'),
  });

  function closeCancel() {
    setCancelTarget(null);
    setCancelReason(null);
    setCancelComment('');
  }
  function closeRate() {
    setRateTarget(null);
    setRating(0);
    setRatingComment('');
  }

  const items = appointments ?? [];
  const filtered = items.filter((a) => {
    if (tab === 'all') return true;
    if (tab === 'upcoming') return isUpcoming(a.status);
    return !isUpcoming(a.status);
  });

  const tabs: { key: Tab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'past', label: 'Past' },
  ];

  return (
    <>
      <CareHeader title="My appointments" back />
      <main className="px-4 pt-4 pb-28">
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-32 rounded-2xl bg-white border border-gray-100 shadow-sm animate-pulse"
              />
            ))}
          </div>
        ) : isError ? (
          <EmptyState
            icon={<AlertCircle className="w-5 h-5" />}
            title="Couldn't load appointments"
            description="Something went wrong. Please try again."
            action={
              <Button variant="primary" size="sm" onClick={() => refetch()}>
                Retry
              </Button>
            }
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="w-5 h-5" />}
            title="No appointments yet"
            description="Book an appointment and it will show up here."
            action={
              <Button variant="primary" size="sm" onClick={() => router.push('/care/medical/book')}>
                Book an appointment
              </Button>
            }
          />
        ) : (
          <>
            {/* Tabs */}
            <div className="flex gap-1 p-1 rounded-xl bg-gray-100 mb-4">
              {tabs.map((tb) => (
                <button
                  key={tb.key}
                  type="button"
                  onClick={() => setTab(tb.key)}
                  className={cn(
                    'flex-1 h-9 rounded-lg text-[13px] font-medium transition-colors',
                    tab === tb.key
                      ? 'bg-white text-gray-950 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700',
                  )}
                >
                  {tb.label}
                </button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <div className="py-12 text-center text-[13px] text-gray-500">
                No appointments in this category
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((apt) => (
                  <AppointmentCard
                    key={apt.id}
                    apt={apt}
                    onCancel={setCancelTarget}
                    onRate={setRateTarget}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Cancel modal */}
      <Modal
        open={!!cancelTarget}
        onClose={closeCancel}
        title="Cancel appointment?"
        description="Please select a reason for cancellation."
        footer={
          <>
            <Button variant="ghost" onClick={closeCancel}>
              Keep it
            </Button>
            <Button
              variant="danger"
              disabled={!cancelReason}
              loading={cancelMutation.isPending}
              onClick={() => cancelTarget && cancelMutation.mutate(cancelTarget.id)}
            >
              Yes, cancel
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          {CANCEL_REASONS.map((reason) => {
            const selected = cancelReason === reason;
            return (
              <button
                key={reason}
                type="button"
                onClick={() => setCancelReason(reason)}
                className={cn(
                  'w-full flex items-center justify-between px-4 h-11 rounded-xl border text-[14px] text-left transition-colors',
                  selected
                    ? 'bg-white border-gray-900 font-semibold text-gray-950'
                    : 'bg-gray-50 border-transparent text-gray-700 hover:bg-gray-100',
                )}
              >
                {reason}
                {selected && <Check className="w-4 h-4" />}
              </button>
            );
          })}
        </div>
        <div className="mt-4">
          <Field label="Additional comments" hint="Optional">
            <Textarea
              value={cancelComment}
              onChange={(e) => setCancelComment(e.target.value)}
              placeholder="Describe why you're cancelling…"
              maxLength={500}
              rows={3}
            />
          </Field>
        </div>
      </Modal>

      {/* Rate modal */}
      <Modal
        open={!!rateTarget}
        onClose={closeRate}
        title="Rate your experience"
        description="Your feedback is very valuable to us."
        footer={
          <>
            <Button variant="ghost" onClick={closeRate}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={rating === 0}
              loading={rateMutation.isPending}
              onClick={() => rateTarget && rateMutation.mutate(rateTarget.id)}
            >
              Submit feedback
            </Button>
          </>
        }
      >
        <div className="flex justify-center mb-4">
          <StarRating value={rating} onChange={setRating} />
        </div>
        <Field label="Write a review" hint="Optional">
          <Textarea
            value={ratingComment}
            onChange={(e) => setRatingComment(e.target.value)}
            placeholder="What did you like the most?"
            maxLength={1000}
            rows={3}
          />
        </Field>
      </Modal>
    </>
  );
}
