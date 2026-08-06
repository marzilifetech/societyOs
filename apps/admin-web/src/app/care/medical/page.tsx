'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Stethoscope,
  Star,
  Clock,
  ChevronRight,
  CalendarDays,
  CalendarPlus,
  Phone,
  Siren,
  AlertCircle,
} from 'lucide-react';
import { careApi } from '@/lib/care-api';
import { CareHeader, CareBody, BottomNav } from '@/components/care/chrome';
import { Button, EmptyState, cn } from '@/components/primitives';
import {
  type Doctor,
  type EmergencyContact,
  doctorSpeciality,
  doctorQualification,
} from './_components';

function SosButton() {
  return (
    <Link
      href="/care/sos"
      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-red-600 text-white text-[13px] font-semibold hover:bg-red-700 active:bg-red-800 transition-colors"
    >
      <Siren className="w-4 h-4" />
      SOS
    </Link>
  );
}

function DoctorCard({ doctor }: { doctor: Doctor }) {
  const router = useRouter();
  const speciality = doctorSpeciality(doctor);
  const qualification = doctorQualification(doctor);
  const available = doctor.isAvailable !== false;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/care/medical/${doctor.id}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          router.push(`/care/medical/${doctor.id}`);
        }
      }}
      className="text-left w-full rounded-2xl bg-white border border-gray-100 shadow-sm p-4 active:bg-gray-50 transition-colors cursor-pointer"
    >
      <div className="flex items-start gap-3">
        <div className="w-14 h-14 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center shrink-0 overflow-hidden">
          {doctor.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={doctor.photoUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <Stethoscope className="w-7 h-7" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[15px] font-semibold text-gray-950 truncate">Dr. {doctor.name}</p>
            {typeof doctor.rating === 'number' && (
              <span className="inline-flex items-center gap-1 shrink-0 text-[12px] font-semibold text-amber-700">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                {doctor.rating.toFixed(1)}
              </span>
            )}
          </div>
          {speciality && <p className="text-[13px] text-primary-700 mt-0.5 truncate">{speciality}</p>}
          {qualification && (
            <p className="text-[12px] text-gray-500 mt-0.5 truncate">{qualification}</p>
          )}
          <div className="flex items-center gap-3 mt-1.5">
            <span
              className={cn(
                'inline-flex items-center gap-1 text-[12px] font-medium',
                available ? 'text-emerald-600' : 'text-gray-400',
              )}
            >
              <span
                className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  available ? 'bg-emerald-500' : 'bg-gray-300',
                )}
              />
              {available ? 'Available' : 'Unavailable'}
            </span>
            {doctor.nextSlot && (
              <span className="inline-flex items-center gap-1 text-[12px] text-gray-500">
                <Clock className="w-3.5 h-3.5" />
                Next: {doctor.nextSlot}
              </span>
            )}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          router.push(`/care/medical/book?doctorId=${doctor.id}`);
        }}
        className="mt-3 w-full h-11 rounded-xl bg-gray-950 text-white text-[13px] font-semibold hover:bg-gray-800 active:bg-black transition-colors"
      >
        Book appointment
      </button>
    </div>
  );
}

export default function MedicalHome() {
  const {
    data: doctors,
    isLoading,
    isError,
    refetch,
  } = useQuery<Doctor[]>({
    queryKey: ['medical', 'doctors'],
    queryFn: () => careApi.get<Doctor[]>('/medical/doctors'),
  });

  const { data: contacts } = useQuery<EmergencyContact[]>({
    queryKey: ['medical', 'emergency-contacts'],
    queryFn: () => careApi.get<EmergencyContact[]>('/medical/emergency-contacts'),
  });

  return (
    <>
      <CareHeader
        title="Med Help Desk"
        subtitle="Book a doctor & manage visits"
        right={<SosButton />}
      />
      <CareBody>
        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <Link
            href="/care/medical/book"
            className="p-4 rounded-2xl bg-white border border-gray-100 shadow-sm active:bg-gray-50 transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center">
              <CalendarPlus className="w-5 h-5" />
            </div>
            <p className="text-[14px] font-semibold text-gray-950 mt-3">Book appointment</p>
            <p className="text-[12px] text-gray-500 mt-0.5">Schedule a visit</p>
          </Link>
          <Link
            href="/care/medical/appointments"
            className="p-4 rounded-2xl bg-white border border-gray-100 shadow-sm active:bg-gray-50 transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <CalendarDays className="w-5 h-5" />
            </div>
            <p className="text-[14px] font-semibold text-gray-950 mt-3">My appointments</p>
            <p className="text-[12px] text-gray-500 mt-0.5">Upcoming & past</p>
          </Link>
        </div>

        {/* Emergency SOS call-out */}
        <Link
          href="/care/sos"
          className="flex items-center gap-3 p-4 rounded-2xl bg-red-600 text-white shadow-sm active:bg-red-700 transition-colors mb-5"
        >
          <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center">
            <Siren className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className="text-[15px] font-semibold">Emergency SOS</p>
            <p className="text-[12px] text-white/80">Alert security & responders instantly</p>
          </div>
          <ChevronRight className="w-5 h-5 text-white/70" />
        </Link>

        {/* Doctors */}
        <h2 className="text-[15px] font-semibold text-gray-950 mb-3">Available doctors</h2>

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
            title="Couldn't load doctors"
            description="Something went wrong. Please try again."
            action={
              <Button variant="primary" size="sm" onClick={() => refetch()}>
                Retry
              </Button>
            }
          />
        ) : !doctors?.length ? (
          <EmptyState
            icon={<Stethoscope className="w-5 h-5" />}
            title="No doctors available"
            description="There are no doctors listed for your society yet."
          />
        ) : (
          <div className="space-y-3">
            {doctors.map((doc) => (
              <DoctorCard key={doc.id} doctor={doc} />
            ))}
          </div>
        )}

        {/* Emergency contacts */}
        {contacts?.length ? (
          <div className="mt-6">
            <h2 className="text-[15px] font-semibold text-gray-950 mb-3">Emergency contacts</h2>
            <div className="rounded-2xl bg-primary-50 border border-primary-100 divide-y divide-primary-100">
              {contacts.map((c) => (
                <a
                  key={c.id}
                  href={`tel:${c.phone}`}
                  className="flex items-center gap-3 p-4 active:bg-primary-100/60 transition-colors first:rounded-t-2xl last:rounded-b-2xl"
                >
                  <div className="w-11 h-11 rounded-full bg-primary-500 text-white flex items-center justify-center shrink-0">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-gray-950 truncate">{c.name}</p>
                    {c.role && <p className="text-[12px] text-gray-500 truncate">{c.role}</p>}
                  </div>
                  <span className="text-[14px] font-semibold text-primary-700 shrink-0">
                    {c.phone}
                  </span>
                </a>
              ))}
            </div>
          </div>
        ) : null}
      </CareBody>

      <BottomNav />
    </>
  );
}
