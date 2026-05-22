'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Download } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ErrorState } from '@/components/ui/ErrorState';

interface Doctor {
  id: string;
  name: string;
}

interface Appointment {
  id: string;
  residentName: string;
  flat: string;
  doctorName: string;
  date: string;
  slot: string;
  status: string;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  SCHEDULED: { label: 'Scheduled', color: 'bg-blue-100 text-blue-700' },
  COMPLETED: { label: 'Completed', color: 'bg-green-100 text-green-700' },
  CANCELLED: { label: 'Cancelled', color: 'bg-red-100 text-red-700' },
  NO_SHOW: { label: 'No Show', color: 'bg-amber-100 text-amber-700' },
};

function exportCSV(rows: Appointment[]) {
  const headers = ['Resident', 'Flat', 'Doctor', 'Date', 'Slot', 'Status'];
  const data = rows.map((r) => [r.residentName, r.flat, r.doctorName,
    new Date(r.date).toLocaleDateString('en-IN'), r.slot, r.status]);
  const csv = [headers, ...data].map((r) => r.join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = 'appointments.csv'; a.click();
}

export default function AppointmentsPage() {
  const [dateFilter, setDateFilter] = useState('');
  const [doctorFilter, setDoctorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data: doctors } = useQuery({
    queryKey: ['medical-staff'],
    queryFn: () => api.get<Doctor[]>('/medical/staff'),
  });

  const { data: appointments, isLoading, isError, refetch } = useQuery({
    queryKey: ['all-appointments', dateFilter, doctorFilter, statusFilter],
    queryFn: () => {
      const p = new URLSearchParams();
      if (dateFilter) p.set('date', dateFilter);
      if (doctorFilter) p.set('doctorId', doctorFilter);
      if (statusFilter) p.set('status', statusFilter);
      return api.get<Appointment[]>(`/medical/admin/medical/appointments?${p.toString()}`);
    },
  });

  // TODO: backend has no admin appointment-status mutation; status is driven by
  // /medical/appointments/:id/{cancel,complete} from the resident/doctor sides.
  // Surface as read-only here until an admin endpoint exists.

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Appointments</h1>
          <p className="text-gray-500 text-sm mt-1">{appointments?.length ?? 0} appointments</p>
        </div>
        <button
          onClick={() => appointments && exportCSV(appointments)}
          disabled={!appointments?.length}
          className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 disabled:opacity-40 inline-flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      <div className="flex gap-3 mb-6 flex-wrap">
        <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}
          className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none" />
        <select value={doctorFilter} onChange={(e) => setDoctorFilter(e.target.value)}
          className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none">
          <option value="">All Doctors</option>
          {doctors?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none">
          <option value="">All Statuses</option>
          {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
        {isLoading ? (
          <div className="py-16 text-center text-gray-400">Loading…</div>
        ) : isError ? (
          <ErrorState onRetry={refetch} message="Appointments couldn't be loaded. Your data is safe — please try again." />
        ) : !appointments?.length ? (
          <div className="py-16 text-center">
            <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="font-medium text-gray-700">No appointments found</p>
            <p className="text-sm text-gray-400 mt-1">Try clearing filters or pick a different date.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Resident', 'Flat', 'Doctor', 'Date', 'Slot', 'Status'].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {appointments.map((appt) => {
                const meta = STATUS_META[appt.status] ?? STATUS_META.SCHEDULED;
                return (
                  <tr key={appt.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">{appt.residentName}</td>
                    <td className="px-5 py-3 text-gray-600">{appt.flat}</td>
                    <td className="px-5 py-3 text-gray-600">{appt.doctorName}</td>
                    <td className="px-5 py-3 text-gray-600">
                      {new Date(appt.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-3 text-gray-600">{appt.slot}</td>
                    <td className="px-5 py-3">
                      <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', meta.color)}>{meta.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
