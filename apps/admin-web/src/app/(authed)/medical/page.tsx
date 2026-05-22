'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Stethoscope, Calendar, Siren } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ErrorState } from '@/components/ui/ErrorState';

type ActiveTab = 'doctors' | 'appointments' | 'sos';

interface Doctor {
  id: string;
  name: string;
  designation: string;
  availableDays: string[];
  isAvailable: boolean;
}

interface Appointment {
  id: string;
  residentName: string;
  flat: string;
  doctorId: string;
  doctorName: string;
  date: string;
  slot: string;
  status: string;
}

interface SosLog {
  id: string;
  residentName: string;
  flat: string;
  alertTime: string;
  acknowledged: boolean;
  resolved: boolean;
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const defaultDoctorForm = {
  name: '',
  designation: '',
  availableDays: [] as string[],
};

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'bg-red-100 text-red-700',
  ACKNOWLEDGED: 'bg-amber-100 text-amber-700',
  RESOLVED: 'bg-green-100 text-green-700',
};

const APPT_STATUS_BADGE: Record<string, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
};

export default function MedicalPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<ActiveTab>('doctors');
  const [showDoctorModal, setShowDoctorModal] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  const [doctorForm, setDoctorForm] = useState(defaultDoctorForm);
  const [apptDateFilter, setApptDateFilter] = useState('');
  const [apptDoctorFilter, setApptDoctorFilter] = useState('');

  const { data: doctors, isLoading: doctorsLoading, isError: doctorsError, refetch: refetchDoctors } = useQuery({
    queryKey: ['medical-staff'],
    queryFn: () => api.get<Doctor[]>('/medical/staff'),
  });

  const { data: appointments, isLoading: apptLoading, isError: apptError, refetch: refetchAppt } = useQuery({
    queryKey: ['medical-appointments', apptDateFilter, apptDoctorFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (apptDateFilter) params.set('date', apptDateFilter);
      if (apptDoctorFilter) params.set('doctorId', apptDoctorFilter);
      return api.get<Appointment[]>(`/medical/admin/medical/appointments?${params.toString()}`);
    },
    enabled: activeTab === 'appointments',
  });

  const { data: sosLog, isLoading: sosLoading, isError: sosError, refetch: refetchSos } = useQuery({
    queryKey: ['sos-log'],
    queryFn: () => api.get<SosLog[]>('/medical/admin/sos/log').catch(() => api.get<SosLog[]>('/sos/active')),
    enabled: activeTab === 'sos',
  });

  const addDoctorMutation = useMutation({
    mutationFn: () =>
      api.post('/medical/admin/medical/staff', {
        ...doctorForm,
        name: doctorForm.name.trim(),
        designation: doctorForm.designation.trim(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['medical-staff'] });
      setShowDoctorModal(false);
      setDoctorForm(defaultDoctorForm);
      toast.success('Doctor added');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to add doctor'),
  });

  const updateDoctorMutation = useMutation({
    mutationFn: (id: string) =>
      api.patch(`/medical/admin/medical/staff/${id}`, {
        ...doctorForm,
        name: doctorForm.name.trim(),
        designation: doctorForm.designation.trim(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['medical-staff'] });
      setShowDoctorModal(false);
      setEditingDoctor(null);
      setDoctorForm(defaultDoctorForm);
      toast.success('Doctor updated');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to update doctor'),
  });

  const toggleAvailabilityMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/medical/admin/medical/staff/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['medical-staff'] });
      toast.success('Doctor deactivated');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to deactivate'),
  });

  function openAddModal() {
    setEditingDoctor(null);
    setDoctorForm(defaultDoctorForm);
    setShowDoctorModal(true);
  }

  function openEditModal(doc: Doctor) {
    setEditingDoctor(doc);
    setDoctorForm({ name: doc.name, designation: doc.designation, availableDays: doc.availableDays });
    setShowDoctorModal(true);
  }

  function toggleDay(day: string) {
    setDoctorForm((f) => ({
      ...f,
      availableDays: f.availableDays.includes(day)
        ? f.availableDays.filter((d) => d !== day)
        : [...f.availableDays, day],
    }));
  }

  const TABS: { key: ActiveTab; label: string }[] = [
    { key: 'doctors', label: 'Doctors' },
    { key: 'appointments', label: 'Appointments' },
    { key: 'sos', label: 'SOS Log' },
  ];

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Medical</h1>
        {activeTab === 'doctors' && (
          <button
            onClick={openAddModal}
            className="bg-primary-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary-600 transition-colors inline-flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add Doctor
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-medium transition-colors',
              activeTab === tab.key
                ? 'bg-primary-500 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Doctors tab */}
      {activeTab === 'doctors' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
          {doctorsLoading ? (
            <div className="py-16 text-center text-gray-400">Loading…</div>
          ) : doctorsError ? (
            <ErrorState onRetry={refetchDoctors} message="Doctors couldn't be loaded. Your data is safe — please try again." />
          ) : !doctors?.length ? (
            <div className="py-16 text-center">
              <Stethoscope className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="font-medium text-gray-700">No doctors yet</p>
              <p className="text-sm text-gray-400 mt-1 mb-4">Add the first doctor to your panel.</p>
              <button
                onClick={openAddModal}
                className="inline-flex items-center gap-2 bg-primary-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary-600 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Add Doctor
              </button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-gray-500">
                  <th className="text-left px-5 py-3 font-medium">Name</th>
                  <th className="text-left px-5 py-3 font-medium">Designation</th>
                  <th className="text-left px-5 py-3 font-medium">Available Days</th>
                  <th className="text-left px-5 py-3 font-medium">Status</th>
                  <th className="text-left px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {doctors.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">{doc.name}</td>
                    <td className="px-5 py-3 text-gray-600">{doc.designation}</td>
                    <td className="px-5 py-3 text-gray-600">{doc.availableDays.join(', ')}</td>
                    <td className="px-5 py-3">
                      <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', doc.isAvailable ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                        {doc.isAvailable ? 'Available' : 'Unavailable'}
                      </span>
                    </td>
                    <td className="px-5 py-3 flex gap-2">
                      <button
                        onClick={() => openEditModal(doc)}
                        className="text-xs px-3 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => { if (window.confirm('Deactivate this doctor?')) toggleAvailabilityMutation.mutate(doc.id); }}
                        disabled={toggleAvailabilityMutation.isPending}
                        className="text-xs px-3 py-1 rounded-lg border border-amber-200 text-amber-600 hover:bg-amber-50 disabled:opacity-40"
                      >
                        Deactivate
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Appointments tab */}
      {activeTab === 'appointments' && (
        <div>
          {appointments && appointments.length > 0 && (
            <div className="flex gap-3 mb-5">
              {[
                { label: 'Total Today', value: appointments.length, color: 'bg-primary-50 text-primary-700' },
                { label: 'Completed', value: appointments.filter((a) => a.status === 'COMPLETED').length, color: 'bg-green-50 text-green-700' },
                { label: 'Pending', value: appointments.filter((a) => a.status === 'SCHEDULED').length, color: 'bg-blue-50 text-blue-700' },
              ].map((badge) => (
                <div key={badge.label} className={cn('rounded-2xl px-5 py-3 flex flex-col items-center min-w-[100px]', badge.color)}>
                  <span className="text-2xl font-bold">{badge.value}</span>
                  <span className="text-xs font-medium mt-0.5">{badge.label}</span>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-3 mb-4">
            <input
              type="date"
              className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary-400"
              value={apptDateFilter}
              onChange={(e) => setApptDateFilter(e.target.value)}
            />
            <select
              className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none"
              value={apptDoctorFilter}
              onChange={(e) => setApptDoctorFilter(e.target.value)}
            >
              <option value="">All Doctors</option>
              {doctors?.map((doc) => (
                <option key={doc.id} value={doc.id}>{doc.name}</option>
              ))}
            </select>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
            {apptLoading ? (
              <div className="py-16 text-center text-gray-400">Loading…</div>
            ) : apptError ? (
              <ErrorState onRetry={refetchAppt} message="Appointments couldn't be loaded. Your data is safe — please try again." />
            ) : !appointments?.length ? (
              <div className="py-16 text-center">
                <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="font-medium text-gray-700">No appointments yet</p>
                <p className="text-sm text-gray-400 mt-1">Try a different date or doctor filter.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-500">
                    <th className="text-left px-5 py-3 font-medium">Resident</th>
                    <th className="text-left px-5 py-3 font-medium">Flat</th>
                    <th className="text-left px-5 py-3 font-medium">Doctor</th>
                    <th className="text-left px-5 py-3 font-medium">Date</th>
                    <th className="text-left px-5 py-3 font-medium">Slot</th>
                    <th className="text-left px-5 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {appointments.map((appt) => (
                    <tr key={appt.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-900">{appt.residentName}</td>
                      <td className="px-5 py-3 text-gray-600">{appt.flat}</td>
                      <td className="px-5 py-3 text-gray-600">{appt.doctorName}</td>
                      <td className="px-5 py-3 text-gray-600">
                        {new Date(appt.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </td>
                      <td className="px-5 py-3 text-gray-600">{appt.slot}</td>
                      <td className="px-5 py-3">
                        <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', APPT_STATUS_BADGE[appt.status] ?? 'bg-gray-100 text-gray-500')}>
                          {appt.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* SOS Log tab */}
      {activeTab === 'sos' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
          {sosLoading ? (
            <div className="py-16 text-center text-gray-400">Loading…</div>
          ) : sosError ? (
            <ErrorState onRetry={refetchSos} message="SOS alerts couldn't be loaded. Your data is safe — please try again." />
          ) : !sosLog?.length ? (
            <div className="py-16 text-center">
              <Siren className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="font-medium text-gray-700">No SOS alerts</p>
              <p className="text-sm text-gray-400 mt-1">Recent emergency alerts will appear here.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-gray-500">
                  <th className="text-left px-5 py-3 font-medium">Resident</th>
                  <th className="text-left px-5 py-3 font-medium">Flat</th>
                  <th className="text-left px-5 py-3 font-medium">Alert Time</th>
                  <th className="text-left px-5 py-3 font-medium">Acknowledged</th>
                  <th className="text-left px-5 py-3 font-medium">Resolved</th>
                  <th className="text-left px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sosLog.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">{log.residentName}</td>
                    <td className="px-5 py-3 text-gray-600">{log.flat}</td>
                    <td className="px-5 py-3 text-gray-600">
                      {new Date(log.alertTime).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-5 py-3">
                      <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', log.acknowledged ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                        {log.acknowledged ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', log.resolved ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                        {log.resolved ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', STATUS_BADGE[log.status] ?? 'bg-gray-100 text-gray-500')}>
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Doctor modal */}
      {showDoctorModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h2 className="font-semibold text-gray-900 mb-4">
              {editingDoctor ? 'Edit Doctor' : 'Add Doctor'}
            </h2>
            <div className="space-y-4">
              <input
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary-400"
                placeholder="Name *"
                value={doctorForm.name}
                onChange={(e) => setDoctorForm((f) => ({ ...f, name: e.target.value }))}
              />
              <input
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary-400"
                placeholder="Designation *"
                value={doctorForm.designation}
                onChange={(e) => setDoctorForm((f) => ({ ...f, designation: e.target.value }))}
              />
              <div>
                <p className="text-sm text-gray-700 mb-2">Available Days</p>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={cn(
                        'px-3 py-1 rounded-lg text-sm font-medium border transition-colors',
                        doctorForm.availableDays.includes(day)
                          ? 'bg-primary-500 text-white border-primary-500'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50',
                      )}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => {
                  if (editingDoctor) {
                    updateDoctorMutation.mutate(editingDoctor.id);
                  } else {
                    addDoctorMutation.mutate();
                  }
                }}
                disabled={!doctorForm.name || !doctorForm.designation || addDoctorMutation.isPending || updateDoctorMutation.isPending}
                className="flex-1 bg-primary-500 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
              >
                {addDoctorMutation.isPending || updateDoctorMutation.isPending ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => {
                  setShowDoctorModal(false);
                  setEditingDoctor(null);
                  setDoctorForm(defaultDoctorForm);
                }}
                className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium"
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
