'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Stethoscope } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import Link from 'next/link';
import { ErrorState } from '@/components/ui/ErrorState';

interface Doctor {
  id: string;
  name: string;
  designation: string;
  specialty?: string;
  qualifications?: string;
  availableDays: string[];
  appointmentCount?: number;
  isAvailable: boolean;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const defaultForm = { name: '', designation: '', specialty: '', qualifications: '', availableDays: [] as string[] };

export default function DoctorsPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Doctor | null>(null);
  const [form, setForm] = useState(defaultForm);

  const { data: doctors, isLoading, isError, refetch } = useQuery({
    queryKey: ['medical-staff'],
    queryFn: () => api.get<Doctor[]>('/medical/staff'),
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name.trim(),
        designation: form.designation.trim(),
        specialty: form.specialty.trim(),
        qualifications: form.qualifications.trim(),
        availableDays: form.availableDays,
      };
      return editing
        ? api.patch(`/medical/admin/medical/staff/${editing.id}`, payload)
        : api.post('/medical/admin/medical/staff', payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['medical-staff'] });
      setShowModal(false);
      setEditing(null);
      setForm(defaultForm);
      toast.success(editing ? 'Doctor updated' : 'Doctor added');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Save failed'),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/medical/admin/medical/staff/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['medical-staff'] });
      toast.success('Doctor deactivated');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to deactivate'),
  });

  function openAdd() {
    setEditing(null);
    setForm(defaultForm);
    setShowModal(true);
  }

  function openEdit(doc: Doctor) {
    setEditing(doc);
    setForm({ name: doc.name, designation: doc.designation, specialty: doc.specialty ?? '', qualifications: doc.qualifications ?? '', availableDays: doc.availableDays });
    setShowModal(true);
  }

  function toggleDay(day: string) {
    setForm((f) => ({
      ...f,
      availableDays: f.availableDays.includes(day)
        ? f.availableDays.filter((d) => d !== day)
        : [...f.availableDays, day],
    }));
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Doctors</h1>
          <p className="text-gray-500 text-sm mt-1">{doctors?.length ?? 0} on panel</p>
        </div>
        <button
          onClick={openAdd}
          className="bg-primary-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary-600 transition-colors inline-flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Doctor
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
        {isLoading ? (
          <div className="py-16 text-center text-gray-400">Loading…</div>
        ) : isError ? (
          <ErrorState onRetry={refetch} message="Doctors couldn't be loaded. Your data is safe — please try again." />
        ) : !doctors?.length ? (
          <div className="py-16 text-center">
            <Stethoscope className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="font-medium text-gray-700">No doctors yet</p>
            <p className="text-sm text-gray-400 mt-1 mb-4">Add the first doctor to your panel.</p>
            <button
              onClick={openAdd}
              className="inline-flex items-center gap-2 bg-primary-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary-600 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Doctor
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Name', 'Specialty', "Today's Schedule", 'Appointments', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {doctors.map((doc) => {
                const today = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date().getDay()];
                const isToday = doc.availableDays.includes(today);
                return (
                  <tr key={doc.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                          <span className="text-primary-600 text-xs font-semibold">
                            {doc.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{doc.name}</p>
                          <p className="text-xs text-gray-500">{doc.designation}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{doc.specialty || doc.designation}</td>
                    <td className="px-5 py-3">
                      <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', isToday ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                        {isToday ? 'Available today' : 'Not today'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-700">{doc.appointmentCount ?? 0}</td>
                    <td className="px-5 py-3">
                      <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', doc.isAvailable ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600')}>
                        {doc.isAvailable ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-3 flex gap-2">
                      <Link
                        href={`/medical/doctors/${doc.id}`}
                        className="text-xs px-3 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100"
                      >
                        View
                      </Link>
                      <button
                        onClick={() => openEdit(doc)}
                        className="text-xs px-3 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => { if (window.confirm('Deactivate this doctor?')) deactivateMutation.mutate(doc.id); }}
                        disabled={deactivateMutation.isPending}
                        className="text-xs px-3 py-1 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-40"
                      >
                        Deactivate
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
            <h2 className="font-semibold text-gray-900 mb-4">{editing ? 'Edit Doctor' : 'Add Doctor'}</h2>
            <div className="space-y-3">
              <input className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none" placeholder="Full Name *"
                value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              <input className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none" placeholder="Designation *"
                value={form.designation} onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))} />
              <input className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none" placeholder="Specialty"
                value={form.specialty} onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))} />
              <input className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none" placeholder="Qualifications"
                value={form.qualifications} onChange={(e) => setForm((f) => ({ ...f, qualifications: e.target.value }))} />
              <div>
                <p className="text-xs text-gray-500 mb-2">Available Days</p>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((day) => (
                    <button key={day} type="button" onClick={() => toggleDay(day)}
                      className={cn('px-3 py-1 rounded-lg text-sm font-medium border transition-colors',
                        form.availableDays.includes(day) ? 'bg-primary-500 text-white border-primary-500' : 'border-gray-200 text-gray-600 hover:bg-gray-50')}>
                      {day}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => saveMutation.mutate()}
                disabled={!form.name || !form.designation || saveMutation.isPending}
                className="flex-1 bg-primary-500 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
              >
                {saveMutation.isPending ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => { setShowModal(false); setEditing(null); setForm(defaultForm); }}
                className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
