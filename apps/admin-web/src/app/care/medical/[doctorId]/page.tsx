'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Stethoscope, Info, CalendarDays, AlertCircle } from 'lucide-react';
import { careApi } from '@/lib/care-api';
import { CareHeader } from '@/components/care/chrome';
import { Button, EmptyState } from '@/components/primitives';
import {
  type DoctorDetail,
  Stars,
  doctorSpeciality,
  doctorQualification,
} from '../_components';

export default function DoctorProfile() {
  const params = useParams<{ doctorId: string }>();
  const router = useRouter();
  const doctorId = params?.doctorId;

  const {
    data: doctor,
    isLoading,
    isError,
    refetch,
  } = useQuery<DoctorDetail>({
    queryKey: ['medical', 'doctor', doctorId],
    queryFn: () => careApi.get<DoctorDetail>(`/medical/doctors/${doctorId}`),
    enabled: !!doctorId,
  });

  const speciality = doctorSpeciality(doctor);
  const qualification = doctorQualification(doctor);

  return (
    <>
      <CareHeader title="Doctor profile" back />
      <main className="px-4 pt-4 pb-32">
        {isLoading ? (
          <div className="space-y-3">
            <div className="h-48 rounded-2xl bg-white border border-gray-100 shadow-sm animate-pulse" />
            <div className="h-28 rounded-2xl bg-white border border-gray-100 shadow-sm animate-pulse" />
          </div>
        ) : isError || !doctor ? (
          <EmptyState
            icon={<AlertCircle className="w-5 h-5" />}
            title="Couldn't load doctor"
            description="Something went wrong. Please try again."
            action={
              <Button variant="primary" size="sm" onClick={() => refetch()}>
                Retry
              </Button>
            }
          />
        ) : (
          <div className="space-y-4">
            {/* Profile header card */}
            <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5 flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-2xl bg-primary-50 text-primary-700 flex items-center justify-center overflow-hidden mb-3">
                {doctor.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={doctor.photoUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Stethoscope className="w-9 h-9" />
                )}
              </div>
              <h2 className="text-[18px] font-semibold text-gray-950">Dr. {doctor.name}</h2>
              {speciality && <p className="text-[14px] text-primary-700 mt-0.5">{speciality}</p>}
              {qualification && <p className="text-[13px] text-gray-500 mt-0.5">{qualification}</p>}
              {typeof doctor.avgRating === 'number' && doctor.avgRating > 0 && (
                <div className="flex items-center gap-2 mt-3">
                  <Stars value={doctor.avgRating} />
                  <span className="text-[13px] text-gray-500">
                    {doctor.avgRating.toFixed(1)}
                    {typeof doctor.ratingCount === 'number' && ` (${doctor.ratingCount} reviews)`}
                  </span>
                </div>
              )}
            </div>

            {/* Bio */}
            {doctor.bio && (
              <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-7 h-7 rounded-lg bg-primary-50 text-primary-700 flex items-center justify-center">
                    <Info className="w-4 h-4" />
                  </span>
                  <h3 className="text-[14px] font-semibold text-gray-950">About</h3>
                </div>
                <p className="text-[14px] text-gray-600 leading-relaxed">{doctor.bio}</p>
              </div>
            )}

            {/* Available days */}
            {doctor.availableDays?.length ? (
              <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                    <CalendarDays className="w-4 h-4" />
                  </span>
                  <h3 className="text-[14px] font-semibold text-gray-950">Available days</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {doctor.availableDays.map((d) => (
                    <span
                      key={d}
                      className="px-3 py-1.5 rounded-full bg-primary-50 text-primary-700 text-[13px] font-medium"
                    >
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Reviews */}
            {doctor.reviews?.length ? (
              <div>
                <h3 className="text-[15px] font-semibold text-gray-950 mb-3">Patient reviews</h3>
                <div className="space-y-3">
                  {doctor.reviews.map((r) => (
                    <div
                      key={r.id}
                      className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[14px] font-semibold text-gray-950">
                          {r.residentName ?? 'Resident'}
                        </p>
                        <Stars value={r.rating} />
                      </div>
                      {r.comment && (
                        <p className="text-[13px] text-gray-600 leading-relaxed">{r.comment}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </main>

      {/* Sticky footer CTA */}
      {doctor && (
        <div className="sticky bottom-0 z-10 bg-white/95 backdrop-blur border-t border-gray-100 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <Button
            variant="primary"
            fullWidth
            className="h-12 rounded-xl"
            leadingIcon={<CalendarDays className="w-4 h-4" />}
            onClick={() => router.push(`/care/medical/book?doctorId=${doctor.id}`)}
          >
            Book appointment
          </Button>
        </div>
      )}
    </>
  );
}
