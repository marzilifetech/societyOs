'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Building2, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { ErrorState } from '@/components/ui/ErrorState';

type Admin = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  status: string;
  role: 'ADMIN' | 'BUILDING_ADMIN';
  createdAt: string;
};

type CreateForm = {
  name: string;
  phone: string;
};

export default function AdminsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateForm>({ name: '', phone: '' });

  const { data: admins = [], isLoading, isError, refetch } = useQuery<Admin[]>({
    queryKey: ['building-admins'],
    queryFn: () => api.get<Admin[]>('/admin/building-admins'),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post('/admin/building-admins', {
        name: form.name.trim(),
        phone: form.phone.trim(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['building-admins'] });
      toast.success('Admin created');
      setShowForm(false);
      setForm({ name: '', phone: '' });
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to create'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/building-admins/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['building-admins'] });
      toast.success('Admin removed');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to remove'),
  });

  const isFormValid = form.name.trim() && form.phone.trim();

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admins</h1>
          <p className="text-gray-500 text-sm mt-1">
            Society administrators with full access across this society
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition"
        >
          {showForm ? 'Cancel' : <><Plus className="w-5 h-5" /> Add Admin</>}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-4">New Admin</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Name *</label>
              <input
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
                placeholder="Full name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Phone *</label>
              <input
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
                placeholder="+91XXXXXXXXXX"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
          </div>
          <button
            onClick={() => createMutation.mutate()}
            disabled={!isFormValid || createMutation.isPending}
            className="mt-4 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition"
          >
            {createMutation.isPending ? 'Creating…' : 'Create'}
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : isError ? (
        <ErrorState onRetry={refetch} message="Admins couldn't be loaded. Please try again." />
      ) : admins.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm py-16 flex flex-col items-center text-center">
          <Building2 className="w-10 h-10 text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-700">No admins yet</p>
          <p className="text-xs text-gray-400 mt-1 mb-4">Add a society administrator to grant full access</p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold px-4 py-2 rounded-xl"
          >
            <Plus className="w-4 h-4" />
            Add Admin
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-5 py-3 text-xs text-gray-500 uppercase tracking-wide font-medium">
                  Name
                </th>
                <th className="text-left px-5 py-3 text-xs text-gray-500 uppercase tracking-wide font-medium">
                  Phone
                </th>
                <th className="text-left px-5 py-3 text-xs text-gray-500 uppercase tracking-wide font-medium">
                  Added
                </th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {admins.map((admin) => (
                <tr key={admin.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-900">{admin.name}</p>
                  </td>
                  <td className="px-5 py-3 text-gray-600 font-mono text-xs">{admin.phone}</td>
                  <td className="px-5 py-3 text-gray-500 text-xs">
                    {new Date(admin.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => {
                        if (window.confirm(`Remove ${admin.name} as admin?`)) {
                          deleteMutation.mutate(admin.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
