'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { ErrorState } from '@/components/ui/ErrorState';

type SocietyDetail = {
  id: string;
  name: string;
  address: string;
  city: string;
  pincode: string;
  showInDirectory: boolean;
  archivedAt: string | null;
  stats: { flats: number; users: number; staff: number; activeResidents: number };
};

export default function SocietyDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', address: '', city: '', pincode: '', showInDirectory: false });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['society-detail', id],
    queryFn: () => api.get<SocietyDetail>(`/admin/societies/${id}`),
  });

  const updateMutation = useMutation({
    mutationFn: () => api.patch(`/admin/societies/${id}`, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['society-detail', id] });
      qc.invalidateQueries({ queryKey: ['admin-societies'] });
      setEditing(false);
      toast.success('Society updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const startEdit = () => {
    if (!data) return;
    setForm({
      name: data.name,
      address: data.address,
      city: data.city,
      pincode: data.pincode,
      showInDirectory: data.showInDirectory,
    });
    setEditing(true);
  };

  if (isLoading) return <div className="p-8 text-gray-500">Loading…</div>;
  if (isError || !data) return <ErrorState onRetry={() => refetch()} />;

  return (
    <div className="p-6 lg:p-8 max-w-3xl">
      <Link href="/societies" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-4">
        <ArrowLeft className="w-4 h-4" /> Societies
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{data.name}</h1>
          <p className="text-gray-500 text-sm">{data.city} · {data.pincode}</p>
        </div>
        {!editing && (
          <button onClick={startEdit} className="text-sm text-primary-600 font-medium">Edit</button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          ['Flats', data.stats.flats],
          ['Residents', data.stats.activeResidents],
          ['Staff', data.stats.staff],
          ['Users', data.stats.users],
        ].map(([label, value]) => (
          <div key={label as string} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{value as number}</p>
            <p className="text-xs text-gray-500">{label as string}</p>
          </div>
        ))}
      </div>

      {editing ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
          {(['name', 'address', 'city', 'pincode'] as const).map((f) => (
            <div key={f}>
              <label className="text-xs text-gray-500 capitalize">{f}</label>
              <input
                className="w-full border rounded-xl px-3 py-2 text-sm mt-1"
                value={form[f]}
                onChange={(e) => setForm((p) => ({ ...p, [f]: e.target.value }))}
              />
            </div>
          ))}
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.showInDirectory} onChange={(e) => setForm((p) => ({ ...p, showInDirectory: e.target.checked }))} />
            Show in directory
          </label>
          <div className="flex gap-2 pt-2">
            <button onClick={() => updateMutation.mutate()} className="bg-primary-500 text-white px-4 py-2 rounded-xl text-sm">Save</button>
            <button onClick={() => setEditing(false)} className="text-gray-500 px-4 py-2 text-sm">Cancel</button>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 text-sm space-y-2">
          <p><span className="text-gray-500">Address:</span> {data.address}</p>
          <p><span className="text-gray-500">Directory:</span> {data.showInDirectory ? 'Visible' : 'Hidden'}</p>
          <p><span className="text-gray-500">Status:</span> {data.archivedAt ? 'Archived' : 'Active'}</p>
        </div>
      )}
    </div>
  );
}
