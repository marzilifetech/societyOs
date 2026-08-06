'use client';

import { Star } from 'lucide-react';
import { cn } from '@/components/primitives';

/* ------------------------------------------------------------------ */
/* Shared types (derived from how the resident-app medical screens use  */
/* the endpoints — kept permissive where the payload is uncertain).     */
/* ------------------------------------------------------------------ */

export type AppointmentStatus =
  | 'BOOKED'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

export interface Doctor {
  id: string;
  name: string;
  specialization?: string;
  designation?: string;
  qualification?: string;
  qualifications?: string;
  rating?: number;
  nextSlot?: string;
  photoUrl?: string;
  isAvailable?: boolean;
}

export interface Review {
  id: string;
  rating: number;
  comment?: string;
  residentName?: string;
  createdAt?: string;
}

export interface DoctorDetail extends Doctor {
  bio?: string;
  availableDays?: string[];
  avgRating?: number;
  ratingCount?: number;
  reviews?: Review[];
}

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  role?: string;
}

export interface Slot {
  timeSlot: string;
  available: boolean;
}

export interface Appointment {
  id: string;
  doctor?: { name?: string; designation?: string; specialization?: string };
  doctorId?: string;
  date: string;
  timeSlot: string;
  status: AppointmentStatus;
  notes?: string;
  reason?: string;
  rating?: number;
  cancellable?: boolean;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Doctor's primary label — designation or specialization, whichever exists. */
export function doctorSpeciality(d?: {
  specialization?: string;
  designation?: string;
}): string | undefined {
  return d?.specialization ?? d?.designation;
}

/** Doctor's qualification line — either spelling the backend may use. */
export function doctorQualification(d?: {
  qualification?: string;
  qualifications?: string;
}): string | undefined {
  return d?.qualification ?? d?.qualifications;
}

export const isUpcoming = (s: AppointmentStatus) => s === 'BOOKED' || s === 'CONFIRMED';

export type StatusMeta = {
  tone: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
  label: string;
};

export function statusMeta(status: AppointmentStatus): StatusMeta {
  switch (status) {
    case 'BOOKED':
    case 'CONFIRMED':
      return { tone: 'info', label: 'Upcoming' };
    case 'COMPLETED':
      return { tone: 'success', label: 'Completed' };
    case 'CANCELLED':
      return { tone: 'danger', label: 'Cancelled' };
    case 'NO_SHOW':
      return { tone: 'neutral', label: 'No-show' };
    default:
      return { tone: 'neutral', label: status };
  }
}

/** Local YYYY-MM-DD for a Date (avoids UTC off-by-one). */
export function toLocalIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

export interface DateOption {
  label: string; // weekday abbr, e.g. "Mon"
  day: string; // date number, e.g. "14"
  value: string; // YYYY-MM-DD
}

/** 7 days starting today, for the horizontal date strip. */
export function getDateOptions(): DateOption[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return {
      label: d.toLocaleDateString('en-IN', { weekday: 'short' }),
      day: String(d.getDate()),
      value: toLocalIso(d),
    };
  });
}

/** True when YYYY-MM-DD is today (local time). */
export function isToday(dateIso: string): boolean {
  return dateIso === toLocalIso(new Date());
}

/** Drop slots that have already passed when the selected date is today. */
export function filterPastTimeSlots(slots: Slot[], dateIso: string): Slot[] {
  if (!isToday(dateIso)) return slots;
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return slots.filter((slot) => {
    const match = slot.timeSlot.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!match) return true;
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const meridiem = match[3]?.toUpperCase();
    if (meridiem === 'PM' && hours < 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes > nowMinutes;
  });
}

/** "14 August 2026, 10:00 AM" (falls back gracefully on bad input). */
export function fmtDateTime(iso: string, slot?: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return slot ? `${iso}, ${slot}` : iso;
  const month = d.toLocaleDateString('en-US', { month: 'long' });
  const base = `${d.getDate()} ${month} ${d.getFullYear()}`;
  return slot ? `${base}, ${slot}` : base;
}

/** "14 August" (short form). */
export function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const month = d.toLocaleDateString('en-US', { month: 'long' });
  return `${d.getDate()} ${month}`;
}

/* ------------------------------------------------------------------ */
/* Presentational bits                                                */
/* ------------------------------------------------------------------ */

/** Read-only star row. */
export function Stars({
  value,
  className,
  starClassName,
}: {
  value: number;
  className?: string;
  starClassName?: string;
}) {
  return (
    <div className={cn('flex items-center gap-0.5', className)}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={cn(
            'w-4 h-4',
            s <= Math.round(value)
              ? 'fill-amber-400 text-amber-400'
              : 'fill-gray-200 text-gray-200',
            starClassName,
          )}
        />
      ))}
    </div>
  );
}

/** Interactive 1–5 star picker. */
export function StarRating({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const active = n <= value;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            className={cn(
              'w-11 h-11 rounded-full flex items-center justify-center transition-colors',
              active ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200',
            )}
          >
            <Star className={cn('w-5 h-5', active && 'fill-white')} />
          </button>
        );
      })}
    </div>
  );
}
