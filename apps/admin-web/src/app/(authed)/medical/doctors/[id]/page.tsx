'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Calendar, MessageSquare, ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ErrorState } from '@/components/ui/ErrorState';

interface Doctor {
  id: string;
  name: string;
  designation: string;
  specialty?: string;
  qualifications?: string;
  availableDays?: string[];
}

interface DoctorAppointment {
  id: string;
  residentName: string;
  flat: string;
  date: string;
  slot: string;
  status: string;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function DoctorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'schedule' | 'appointments' | 'ratings'>('schedule');
  const [availableDays, setAvailableDays] = useState<string[]>([]);
  const [daysEditing, setDaysEditing] = useState(false);

  const { data: doctor, isLoading, isError, refetch, error } = useQuery<Doctor>({
    queryKey: ['doctor', id],
    queryFn: () => api.get<Doctor>(`/medical/doctors/${id}`),
  });

  useEffect(() => {
    if (doctor && !daysEditing) {
      setAvailableDays(doctor.availableDays ?? []);
    }
  }, [doctor, daysEditing]);

  const { data: appointments } = useQuery<DoctorAppointment[]>({
    queryKey: ['doctor-appointments', id],
    queryFn: () => api.get<DoctorAppointment[]>(`/medical/admin/medical/appointments?doctorId=${id}`),
    enabled: activeTab === 'appointments',
  });

  // TODO: backend has no /medical/admin/medical/staff/:id/ratings endpoint yet —
  // wire this up once that endpoint exists. Until then we render an empty state.

  const schedMutation = useMutation({
    mutationFn: () => api.patch(`/medical/admin/medical/staff/${id}`, { availableDays }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doctor', id] });
      setDaysEditing(false);
      toast.success('Schedule updated');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Save failed'),
  });

  function toggleDay(day: string) {
    setAvailableDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  if (isLoading) return <div className="p-6 lg:p-8 text-gray-400">Loading…</div>;
  if (isError) {
    const notFound = /not found/i.test(error?.message ?? '');
    return (
      <div className="p-6 lg:p-8">
        <Link href="/medical/doctors" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Doctors
        </Link>
        {notFound ? (
          <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center">
            <p className="font-medium text-gray-700">Doctor not found</p>
            <p className="text-sm text-gray-400 mt-1">This doctor may have been removed.</p>
          </div>
        ) : (
          <ErrorState onRetry={refetch} message="Doctor information couldn't be loaded. Your data is safe — please try again." />
        )}
      </div>
    );
  }
  if (!doctor) return <div className="p-6 lg:p-8 text-gray-400">Doctor not found</div>;

  const TABS = [
    { key: 'schedule' as const, label: 'Schedule' },
    { key: 'appointments' as const, label: 'Appointments' },
    { key: 'ratings' as const, label: 'Ratings' },
  ];

  return (
    <div className="p-6 lg:p-8">
      <Link href="/medical/doctors" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Doctors
      </Link>
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-primary-100 flex items-center justify-center shrink-0">
            <span className="text-primary-600 text-xl font-bold">
              {doctor.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{doctor.name}</h1>
            <p className="text-gray-500 text-sm">{doctor.designation}{doctor.specialty ? ` · ${doctor.specialty}` : ''}</p>
            {doctor.qualifications && <p className="text-xs text-gray-400 mt-0.5">{doctor.qualifications}</p>}
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        {TABS.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={cn('px-4 py-2 rounded-xl text-sm font-medium transition-colors',
              activeTab === tab.key ? 'bg-primary-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50')}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'schedule' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Available Days</h2>
            {!daysEditing ? (
              <button onClick={() => { setDaysEditing(true); setAvailableDays(doctor.availableDays ?? []); }}
                className="text-sm text-primary-500 hover:underline">Edit</button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => schedMutation.mutate()} disabled={schedMutation.isPending}
                  className="text-sm bg-primary-500 text-white px-3 py-1 rounded-lg disabled:opacity-40">
                  {schedMutation.isPending ? 'Saving…' : 'Save'}
                </button>
                <button onClick={() => setDaysEditing(false)} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((day) => {
              const active = (daysEditing ? availableDays : doctor.availableDays ?? []).includes(day);
              return (
                <button key={day} type="button"
                  onClick={() => daysEditing && toggleDay(day)}
                  className={cn('px-4 py-2 rounded-xl text-sm font-medium border transition-colors',
                    active ? 'bg-primary-500 text-white border-primary-500' : 'border-gray-200 text-gray-500',
                    !daysEditing && 'cursor-default')}>
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'appointments' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
          {!appointments?.length ? (
            <div className="py-16 text-center">
              <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="font-medium text-gray-700">No appointments yet</p>
              <p className="text-sm text-gray-400 mt-1">This doctor&apos;s bookings will appear here.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Resident', 'Flat', 'Date', 'Slot', 'Status'].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {appointments.map((appt) => (
                  <tr key={appt.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">{appt.residentName}</td>
                    <td className="px-5 py-3 text-gray-600">{appt.flat}</td>
                    <td className="px-5 py-3 text-gray-600">
                      {new Date(appt.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-3 text-gray-600">{appt.slot}</td>
                    <td className="px-5 py-3">
                      <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full">{appt.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'ratings' && (
        <div>
          <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center">
            <MessageSquare className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="font-medium text-gray-700">No reviews yet</p>
            <p className="text-sm text-gray-400 mt-1">Resident feedback will appear once collected.</p>
          </div>
        </div>
      )}
    </div>
  );
}
