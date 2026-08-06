'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  CalendarDays,
  CheckCircle2,
  XCircle,
  Clock,
  Stethoscope,
  AlertCircle,
  Check,
  History,
} from 'lucide-react';
import { careApi } from '@/lib/care-api';
import { CareHeader } from '@/components/care/chrome';
import { Button, EmptyState, StatusPill, Modal, Field, Textarea, cn } from '@/components/primitives';
import {
  type Appointment,
  type Slot,
  statusMeta,
  isUpcoming,
  fmtDateTime,
  getDateOptions,
  filterPastTimeSlots,
  doctorSpeciality,
  StarRating,
} from '../../_components';

const CANCEL_REASONS = [
  'Booked by mistake',
  'Feeling better now',
  'Appointment not needed',
  "Can't make this time",
];

/** Build an ISO datetime from a YYYY-MM-DD date and an "HH:MM AM/PM" slot. */
function toStartIso(date: string, slot: string): string {
  const d = new Date(date);
  const m = slot.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (m) {
    let hours = parseInt(m[1], 10);
    const minutes = parseInt(m[2], 10);
    const meridiem = m[3]?.toUpperCase();
    if (meridiem === 'PM' && hours < 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;
    d.setHours(hours, minutes, 0, 0);
  }
  return d.toISOString();
}

export default function AppointmentDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const id = params?.id;

  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState<string | null>(null);
  const [cancelComment, setCancelComment] = useState('');

  const [showRate, setShowRate] = useState(false);
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState('');

  const [showReschedule, setShowReschedule] = useState(false);
  const dateOptions = useMemo(() => getDateOptions(), []);
  const [rDate, setRDate] = useState(dateOptions[0].value);
  const [rSlot, setRSlot] = useState<string | null>(null);

  const {
    data: apt,
    isLoading,
    isError,
    refetch,
  } = useQuery<Appointment>({
    queryKey: ['medical', 'appointment', id],
    queryFn: () => careApi.get<Appointment>(`/medical/appointments/${id}`),
    enabled: !!id,
  });

  const { data: slots, isLoading: loadingSlots } = useQuery<Slot[]>({
    queryKey: ['medical', 'slots', apt?.doctorId, rDate, 'reschedule'],
    queryFn: () =>
      careApi.get<Slot[]>(`/medical/slots?doctorId=${apt?.doctorId}&date=${rDate}`),
    enabled: showReschedule && !!apt?.doctorId,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['medical', 'appointment', id] });
    qc.invalidateQueries({ queryKey: ['medical', 'appointments'] });
  };

  const cancelMutation = useMutation({
    mutationFn: () =>
      careApi.patch(`/medical/appointments/${id}/cancel`, {
        reason: cancelReason ?? undefined,
        comment: cancelComment.trim() || undefined,
      }),
    onSuccess: () => {
      invalidate();
      setShowCancel(false);
      toast.success('Appointment cancelled');
    },
    onError: (e: Error) => toast.error(e.message || 'Could not cancel'),
  });

  const rateMutation = useMutation({
    mutationFn: () =>
      careApi.post(`/medical/appointments/${id}/rate`, {
        rating,
        comment: ratingComment.trim() || undefined,
      }),
    onSuccess: () => {
      invalidate();
      setShowRate(false);
      toast.success('Thanks for your feedback');
    },
    onError: (e: Error) => toast.error(e.message || 'Could not submit rating'),
  });

  const rescheduleMutation = useMutation({
    mutationFn: () => {
      const start = rSlot ? toStartIso(rDate, rSlot) : undefined;
      return careApi.patch(`/medical/appointments/${id}/reschedule`, {
        date: rDate,
        timeSlot: rSlot,
        start,
        slotId: rSlot,
      });
    },
    onSuccess: () => {
      invalidate();
      setShowReschedule(false);
      setRSlot(null);
      toast.success('Appointment rescheduled');
    },
    onError: (e: Error) => toast.error(e.message || 'Could not reschedule'),
  });

  const historyBtn = (
    <button
      onClick={() => router.push('/care/medical/appointments')}
      aria-label="Appointment history"
      className="w-9 h-9 rounded-full flex items-center justify-center text-gray-700 hover:bg-gray-100 active:bg-gray-200 transition-colors"
    >
      <History className="w-5 h-5" />
    </button>
  );

  if (isLoading) {
    return (
      <>
        <CareHeader title="Appointment details" back right={historyBtn} />
        <main className="px-4 pt-4 space-y-3">
          <div className="h-40 rounded-2xl bg-white border border-gray-100 shadow-sm animate-pulse" />
          <div className="h-28 rounded-2xl bg-white border border-gray-100 shadow-sm animate-pulse" />
        </main>
      </>
    );
  }

  if (isError || !apt) {
    return (
      <>
        <CareHeader title="Appointment details" back right={historyBtn} />
        <main className="px-4 pt-4">
          <EmptyState
            icon={<AlertCircle className="w-5 h-5" />}
            title="Couldn't load appointment"
            description="Something went wrong. Please try again."
            action={
              <Button variant="primary" size="sm" onClick={() => refetch()}>
                Retry
              </Button>
            }
          />
        </main>
      </>
    );
  }

  const meta = statusMeta(apt.status);
  const isCancelled = apt.status === 'CANCELLED';
  const isDone = apt.status === 'COMPLETED' || apt.status === 'NO_SHOW';
  const booked = isUpcoming(apt.status);
  const alreadyRated = typeof apt.rating === 'number';

  const beacon = isCancelled
    ? { Icon: XCircle, ring: 'bg-red-50', color: 'text-red-600' }
    : isDone
      ? { Icon: CheckCircle2, ring: 'bg-emerald-50', color: 'text-emerald-600' }
      : { Icon: Clock, ring: 'bg-primary-50', color: 'text-primary-600' };

  const title = isCancelled
    ? 'Appointment cancelled'
    : isDone
      ? 'Appointment completed'
      : 'Appointment booked';
  const subtitle = isCancelled
    ? 'Your doctor has been notified.'
    : isDone
      ? 'Your appointment has been completed.'
      : 'Your appointment is confirmed.';

  const visibleSlots = slots ? filterPastTimeSlots(slots, rDate) : [];

  return (
    <>
      <CareHeader title="Appointment details" back right={historyBtn} />
      <main className="px-4 pt-4 pb-32">
        {/* Status beacon */}
        <div className="flex flex-col items-center text-center py-4">
          <div className={cn('w-20 h-20 rounded-full flex items-center justify-center', beacon.ring)}>
            <beacon.Icon className={cn('w-10 h-10', beacon.color)} />
          </div>
          <h2 className="text-[18px] font-semibold text-gray-950 mt-3">{title}</h2>
          <p className="text-[13px] text-gray-500 mt-1">{subtitle}</p>
        </div>

        {/* Booking details */}
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[14px] font-semibold text-gray-950">Booking details</h3>
            <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
          </div>

          {apt.doctor?.name && (
            <div className="flex items-center gap-3 pb-4 mb-4 border-b border-gray-100">
              <div className="w-11 h-11 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center shrink-0">
                <Stethoscope className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-gray-950 truncate">
                  Dr. {apt.doctor.name}
                </p>
                {doctorSpeciality(apt.doctor) && (
                  <p className="text-[12px] text-gray-500 truncate">
                    {doctorSpeciality(apt.doctor)}
                  </p>
                )}
              </div>
            </div>
          )}

          <dl className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <dt className="text-[13px] text-gray-500 shrink-0">Date &amp; time</dt>
              <dd className="text-[13px] font-semibold text-gray-950 text-right">
                {fmtDateTime(apt.date, apt.timeSlot)}
              </dd>
            </div>
            {apt.reason && (
              <div className="flex items-start justify-between gap-4">
                <dt className="text-[13px] text-gray-500 shrink-0">Reason</dt>
                <dd className="text-[13px] font-semibold text-gray-950 text-right">{apt.reason}</dd>
              </div>
            )}
            {alreadyRated && (
              <div className="flex items-start justify-between gap-4">
                <dt className="text-[13px] text-gray-500 shrink-0">Your rating</dt>
                <dd className="text-[13px] font-semibold text-gray-950 text-right">
                  {apt.rating} / 5
                </dd>
              </div>
            )}
          </dl>

          {apt.notes && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-[13px] text-gray-500 mb-1">Notes for doctor</p>
              <p className="text-[14px] text-gray-800 leading-relaxed">{apt.notes}</p>
            </div>
          )}
        </div>
      </main>

      {/* Sticky footer actions */}
      <div className="sticky bottom-0 z-10 bg-white/95 backdrop-blur border-t border-gray-100 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] space-y-2.5">
        {booked ? (
          <>
            <Button
              variant="primary"
              fullWidth
              className="h-12 rounded-xl"
              onClick={() => {
                setRSlot(null);
                setShowReschedule(true);
              }}
            >
              Reschedule appointment
            </Button>
            <Button
              variant="ghost"
              fullWidth
              className="h-12 rounded-xl text-red-600 hover:bg-red-50"
              onClick={() => setShowCancel(true)}
            >
              Cancel appointment
            </Button>
          </>
        ) : isDone ? (
          <>
            {!alreadyRated && (
              <Button
                variant="primary"
                fullWidth
                className="h-12 rounded-xl"
                onClick={() => setShowRate(true)}
              >
                Rate experience
              </Button>
            )}
            <Button
              variant={alreadyRated ? 'primary' : 'secondary'}
              fullWidth
              className="h-12 rounded-xl"
              leadingIcon={<CalendarDays className="w-4 h-4" />}
              onClick={() =>
                router.push(
                  apt.doctorId
                    ? `/care/medical/book?doctorId=${apt.doctorId}`
                    : '/care/medical/book',
                )
              }
            >
              Book again
            </Button>
          </>
        ) : (
          <Button
            variant="primary"
            fullWidth
            className="h-12 rounded-xl"
            leadingIcon={<CalendarDays className="w-4 h-4" />}
            onClick={() =>
              router.push(
                apt.doctorId ? `/care/medical/book?doctorId=${apt.doctorId}` : '/care/medical/book',
              )
            }
          >
            Book again
          </Button>
        )}
      </div>

      {/* Cancel modal */}
      <Modal
        open={showCancel}
        onClose={() => setShowCancel(false)}
        title="Cancel appointment?"
        description="Please select a reason for cancellation."
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCancel(false)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              disabled={!cancelReason}
              loading={cancelMutation.isPending}
              onClick={() => cancelMutation.mutate()}
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
        open={showRate}
        onClose={() => setShowRate(false)}
        title="Rate your experience"
        description="Your feedback is very valuable to us."
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowRate(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={rating === 0}
              loading={rateMutation.isPending}
              onClick={() => rateMutation.mutate()}
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

      {/* Reschedule modal */}
      <Modal
        open={showReschedule}
        onClose={() => setShowReschedule(false)}
        title="Reschedule appointment"
        description="Pick a new date and time."
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowReschedule(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!rSlot}
              loading={rescheduleMutation.isPending}
              onClick={() => rescheduleMutation.mutate()}
            >
              Confirm reschedule
            </Button>
          </>
        }
      >
        {!apt.doctorId ? (
          <div className="space-y-3">
            <p className="text-[13px] text-gray-500">
              We couldn&apos;t determine slots for this booking. You can book a fresh appointment
              instead.
            </p>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => {
                setShowReschedule(false);
                router.push('/care/medical/book');
              }}
            >
              Go to booking
            </Button>
          </div>
        ) : (
          <>
            {/* Date strip */}
            <div className="flex gap-2 overflow-x-auto pb-1 mb-4">
              {dateOptions.map((opt) => {
                const selected = rDate === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setRDate(opt.value);
                      setRSlot(null);
                    }}
                    className={cn(
                      'shrink-0 w-14 h-16 rounded-xl flex flex-col items-center justify-center border transition-colors',
                      selected
                        ? 'bg-white border-primary-500 ring-1 ring-primary-500'
                        : 'bg-gray-50 border-gray-100 hover:bg-gray-100',
                    )}
                  >
                    <span
                      className={cn(
                        'text-[11px] font-medium',
                        selected ? 'text-primary-700' : 'text-gray-500',
                      )}
                    >
                      {opt.label}
                    </span>
                    <span
                      className={cn(
                        'text-[16px] font-semibold',
                        selected ? 'text-primary-700' : 'text-gray-950',
                      )}
                    >
                      {opt.day}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Slots */}
            {loadingSlots ? (
              <div className="flex flex-wrap gap-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-10 w-24 rounded-lg bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : !visibleSlots.length ? (
              <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 text-center text-[13px] text-gray-500">
                No slots available for this date
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {visibleSlots.map((slot) => {
                  const selected = rSlot === slot.timeSlot;
                  return (
                    <button
                      key={slot.timeSlot}
                      type="button"
                      disabled={!slot.available}
                      onClick={() => slot.available && setRSlot(slot.timeSlot)}
                      className={cn(
                        'min-w-[6rem] h-10 px-3 rounded-lg border text-[13px] font-medium transition-colors',
                        selected
                          ? 'bg-white border-primary-500 ring-1 ring-primary-500 text-primary-700'
                          : slot.available
                            ? 'bg-gray-50 border-gray-200 text-gray-900 hover:bg-gray-100'
                            : 'bg-gray-100 border-gray-100 text-gray-400 cursor-not-allowed',
                      )}
                    >
                      {slot.timeSlot}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </Modal>
    </>
  );
}
