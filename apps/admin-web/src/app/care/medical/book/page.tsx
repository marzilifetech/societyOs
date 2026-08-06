'use client';

import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Stethoscope, Check, CalendarDays } from 'lucide-react';
import { careApi } from '@/lib/care-api';
import { CareHeader } from '@/components/care/chrome';
import { Button, Field, Textarea, cn } from '@/components/primitives';
import {
  type Doctor,
  type Slot,
  getDateOptions,
  filterPastTimeSlots,
  doctorSpeciality,
} from '../_components';

function BookInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();

  const paramDoctorId = searchParams.get('doctorId') ?? '';
  const dateOptions = useMemo(() => getDateOptions(), []);

  const [selectedDoctorId, setSelectedDoctorId] = useState(paramDoctorId);
  const [selectedDate, setSelectedDate] = useState(dateOptions[0].value);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  // Doctors — always fetched so we can show the name; picker only shown when
  // no doctor was passed in the URL.
  const { data: doctors } = useQuery<Doctor[]>({
    queryKey: ['medical', 'doctors'],
    queryFn: () => careApi.get<Doctor[]>('/medical/doctors'),
  });

  const { data: slots, isLoading: loadingSlots } = useQuery<Slot[]>({
    queryKey: ['medical', 'slots', selectedDoctorId, selectedDate],
    queryFn: () =>
      careApi.get<Slot[]>(`/medical/slots?doctorId=${selectedDoctorId}&date=${selectedDate}`),
    enabled: !!selectedDoctorId,
  });

  const bookMutation = useMutation({
    mutationFn: () =>
      careApi.post<{ id?: string }>('/medical/appointments', {
        doctorId: selectedDoctorId,
        date: selectedDate,
        timeSlot: selectedSlot,
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['medical', 'slots'] });
      qc.invalidateQueries({ queryKey: ['medical', 'appointments'] });
      toast.success('Appointment booked');
      router.push('/care/medical/appointments');
    },
    onError: (e: Error) => toast.error(e.message || 'Could not book appointment'),
  });

  const visibleSlots = slots ? filterPastTimeSlots(slots, selectedDate) : [];
  const canConfirm = !!selectedDoctorId && !!selectedSlot;

  return (
    <>
      <CareHeader title="Book appointment" back />
      <main className="px-4 pt-4 pb-32">
        {/* Doctor picker (only when none passed) */}
        {!paramDoctorId && (
          <section className="mb-6">
            <h2 className="text-[14px] font-semibold text-gray-950 mb-3">Select doctor</h2>
            {doctors?.length ? (
              <div className="space-y-2.5">
                {doctors.map((doc) => {
                  const selected = selectedDoctorId === doc.id;
                  return (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => {
                        setSelectedDoctorId(doc.id);
                        setSelectedSlot(null);
                      }}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition-colors',
                        selected
                          ? 'bg-white border-primary-500 ring-1 ring-primary-500'
                          : 'bg-gray-50 border-transparent hover:bg-gray-100',
                      )}
                    >
                      <div className="w-11 h-11 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center shrink-0">
                        <Stethoscope className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-semibold text-gray-950 truncate">
                          Dr. {doc.name}
                        </p>
                        {doctorSpeciality(doc) && (
                          <p className="text-[12px] text-gray-500 truncate">
                            {doctorSpeciality(doc)}
                          </p>
                        )}
                      </div>
                      {selected && (
                        <span className="w-6 h-6 rounded-full bg-primary-500 text-white flex items-center justify-center shrink-0">
                          <Check className="w-4 h-4" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-[13px] text-gray-500">Loading doctors…</p>
            )}
          </section>
        )}

        {/* Date strip */}
        <section className="mb-6">
          <h2 className="text-[14px] font-semibold text-gray-950 mb-3">Choose a date</h2>
          <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-4 px-4">
            {dateOptions.map((opt) => {
              const selected = selectedDate === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setSelectedDate(opt.value);
                    setSelectedSlot(null);
                  }}
                  className={cn(
                    'shrink-0 w-16 h-[72px] rounded-2xl flex flex-col items-center justify-center border transition-colors',
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
                      'text-[18px] font-semibold mt-0.5',
                      selected ? 'text-primary-700' : 'text-gray-950',
                    )}
                  >
                    {opt.day}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Slots */}
        <section className="mb-6">
          <h2 className="text-[14px] font-semibold text-gray-950 mb-3">Available slots</h2>
          {!selectedDoctorId ? (
            <div className="rounded-2xl bg-gray-50 border border-gray-100 p-5 text-center text-[13px] text-gray-500">
              Select a doctor to view available slots
            </div>
          ) : loadingSlots ? (
            <div className="flex flex-wrap gap-2.5">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-11 w-28 rounded-xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : !visibleSlots.length ? (
            <div className="rounded-2xl bg-gray-50 border border-gray-100 p-5 text-center text-[13px] text-gray-500">
              No slots available for this date
            </div>
          ) : (
            <div className="flex flex-wrap gap-2.5">
              {visibleSlots.map((slot) => {
                const selected = selectedSlot === slot.timeSlot;
                return (
                  <button
                    key={slot.timeSlot}
                    type="button"
                    disabled={!slot.available}
                    onClick={() => slot.available && setSelectedSlot(slot.timeSlot)}
                    className={cn(
                      'min-w-[7rem] h-11 px-4 rounded-xl border text-[13px] font-medium transition-colors',
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
        </section>

        {/* Notes */}
        <section>
          <Field label="Notes for doctor" hint="Optional — symptoms or context to share">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any symptoms or context to share…"
              maxLength={2000}
              rows={4}
            />
          </Field>
        </section>
      </main>

      {/* Sticky confirm footer */}
      <div className="sticky bottom-0 z-10 bg-white/95 backdrop-blur border-t border-gray-100 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <Button
          variant="primary"
          fullWidth
          className="h-12 rounded-xl"
          disabled={!canConfirm}
          loading={bookMutation.isPending}
          leadingIcon={<CalendarDays className="w-4 h-4" />}
          onClick={() => bookMutation.mutate()}
        >
          Confirm booking
        </Button>
      </div>
    </>
  );
}

export default function BookAppointmentPage() {
  return (
    <Suspense
      fallback={
        <>
          <CareHeader title="Book appointment" back />
          <main className="px-4 pt-4">
            <p className="text-[13px] text-gray-500">Loading…</p>
          </main>
        </>
      }
    >
      <BookInner />
    </Suspense>
  );
}
