'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Dumbbell, Plus, X } from 'lucide-react';
import { api } from '@/lib/api';
import { ErrorState } from '@/components/ui/ErrorState';

type Amenity = {
  id: string;
  name: string;
  category: string;
  maxCapacity: number;
  pricePerHour: number;
  status: string;
  description?: string;
  availableFrom?: string;
  availableTo?: string;
};

const CATEGORIES = ['GYM', 'POOL', 'CLUBHOUSE', 'TENNIS', 'BADMINTON', 'OTHER'];

export default function AmenitiesPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'GYM', description: '', availableFrom: '06:00', availableTo: '22:00', maxCapacity: 10, pricePerHour: 0 });

  const { data: amenities, isLoading, isError, refetch } = useQuery<Amenity[]>({
    queryKey: ['admin-amenities'],
    queryFn: () => api.get<Amenity[]>('/admin/amenities'),
  });

  const createMutation = useMutation({
    mutationFn: (body: typeof form) =>
      api.post('/amenities', {
        ...body,
        name: body.name.trim(),
        description: body.description.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-amenities'] });
      setShowForm(false);
      setForm({ name: '', category: 'GYM', description: '', availableFrom: '06:00', availableTo: '22:00', maxCapacity: 10, pricePerHour: 0 });
      toast.success('Done! The change has been saved.');
    },
    onError: (err: Error) => {
      toast.error(err?.message ?? 'Something went wrong. Please try again.');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/amenities/${id}`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-amenities'] });
      toast.success('Done! The change has been saved.');
    },
    onError: (err: Error) => {
      toast.error(err?.message ?? 'Something went wrong. Please try again.');
    },
  });

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Amenities</h1>
          <p className="text-gray-500 text-sm mt-1">{amenities?.length ?? 0} amenities configured</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2"
        >
          {showForm ? <><X className="w-4 h-4" />Cancel</> : <><Plus className="w-4 h-4" />Add Amenity</>}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">New Amenity</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Swimming Pool"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary-400"
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary-400 resize-none"
                rows={2}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Available From</label>
              <input
                type="time"
                value={form.availableFrom}
                onChange={(e) => setForm({ ...form, availableFrom: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Available To</label>
              <input
                type="time"
                value={form.availableTo}
                onChange={(e) => setForm({ ...form, availableTo: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Max Capacity</label>
              <input
                type="number"
                value={form.maxCapacity}
                onChange={(e) => setForm({ ...form, maxCapacity: Number(e.target.value) })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Price / hr (₹)</label>
              <input
                type="number"
                value={form.pricePerHour}
                onChange={(e) => setForm({ ...form, pricePerHour: Number(e.target.value) })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary-400"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
            <button
              onClick={() => createMutation.mutate(form)}
              disabled={createMutation.isPending || !form.name.trim()}
              className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {createMutation.isPending ? 'Creating…' : 'Create Amenity'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left text-xs font-semibold text-gray-500 px-6 py-3">Name</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-6 py-3">Category</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-6 py-3">Capacity</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-6 py-3">Price/hr</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-6 py-3">Status</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-6 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400 text-sm">Loading…</td></tr>
            ) : isError ? (
              <tr><td colSpan={6} className="px-6 py-12"><ErrorState onRetry={refetch} message="Amenities couldn't be loaded. Your data is safe — please try again." /></td></tr>
            ) : !amenities?.length ? (
              <tr><td colSpan={6} className="px-6 py-12">
                <div className="flex flex-col items-center justify-center text-center">
                  <Dumbbell className="w-10 h-10 text-gray-300 mb-3" />
                  <p className="font-medium text-gray-700">No amenities yet</p>
                  <p className="text-sm text-gray-400 mt-1 mb-4">Add the gym, pool, clubhouse and more so residents can book them.</p>
                  <button
                    onClick={() => setShowForm(true)}
                    className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />Add Amenity
                  </button>
                </div>
              </td></tr>
            ) : (
              amenities.map((amenity) => (
                <tr key={amenity.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900 text-sm">{amenity.name}</div>
                    {amenity.description && <div className="text-xs text-gray-400 mt-0.5 line-clamp-1">{amenity.description}</div>}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{amenity.category}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{amenity.maxCapacity}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{amenity.pricePerHour > 0 ? `₹${amenity.pricePerHour}` : 'Free'}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${amenity.status === 'AVAILABLE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {amenity.status === 'AVAILABLE' ? 'Available' : 'Unavailable'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => {
                        const next = amenity.status === 'AVAILABLE' ? 'UNAVAILABLE' : 'AVAILABLE';
                        if (next === 'UNAVAILABLE' && !window.confirm(`Disable ${amenity.name}? Residents won't be able to book this amenity.`)) return;
                        toggleMutation.mutate({ id: amenity.id, status: next });
                      }}
                      disabled={toggleMutation.isPending}
                      className="text-xs text-primary-600 hover:text-primary-800 font-medium disabled:opacity-50"
                    >
                      {amenity.status === 'AVAILABLE' ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
