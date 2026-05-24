'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Building2, Plus, Archive, RotateCcw } from 'lucide-react';
import { api } from '@/lib/api';
import { ErrorState } from '@/components/ui/ErrorState';
import { useAuthStore } from '@/store/auth.store';
import { useRouter } from 'next/navigation';

type SocietyRow = {
  id: string;
  name: string;
  city: string;
  pincode: string;
  flatCount: number;
  userCount: number;
  showInDirectory: boolean;
  archivedAt: string | null;
  createdAt: string;
};

export default function SocietiesPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);

  if (user?.role !== 'SUPER_ADMIN') {
    return (
      <div className="p-8">
        <p className="text-gray-500">Only super-admins can manage societies.</p>
      </div>
    );
  }

  const { data: societies = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-societies', search, includeArchived],
    queryFn: () =>
      api.get<SocietyRow[]>(
        `/admin/societies?search=${encodeURIComponent(search)}&includeArchived=${includeArchived}`,
      ),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/societies/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-societies'] });
      toast.success('Society archived');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/societies/${id}/restore`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-societies'] });
      toast.success('Society restored');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Societies</h1>
          <p className="text-gray-500 text-sm mt-1">Onboard and manage housing societies</p>
        </div>
        <Link
          href="/societies/new"
          className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition"
        >
          <Plus className="w-5 h-5" /> Onboard Society
        </Link>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or city…"
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm min-w-[240px]"
        />
        <label className="inline-flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
          />
          Show archived
        </label>
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : societies.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
          <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">No societies yet</p>
          <Link href="/societies/new" className="text-primary-600 font-medium text-sm">
            Create your first society →
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">City</th>
                <th className="px-4 py-3 font-medium">Flats</th>
                <th className="px-4 py-3 font-medium">Users</th>
                <th className="px-4 py-3 font-medium">Directory</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {societies.map((s) => (
                <tr key={s.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                  <td className="px-4 py-3 text-gray-600">{s.city}</td>
                  <td className="px-4 py-3">{s.flatCount}</td>
                  <td className="px-4 py-3">{s.userCount}</td>
                  <td className="px-4 py-3">{s.showInDirectory ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-3">
                    {s.archivedAt ? (
                      <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full text-xs">Archived</span>
                    ) : (
                      <span className="text-green-700 bg-green-50 px-2 py-0.5 rounded-full text-xs">Active</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => router.push(`/societies/${s.id}`)}
                        className="text-primary-600 hover:underline text-xs"
                      >
                        View
                      </button>
                      {!s.archivedAt ? (
                        <button
                          onClick={() => archiveMutation.mutate(s.id)}
                          className="text-red-600 hover:underline text-xs inline-flex items-center gap-1"
                        >
                          <Archive className="w-3 h-3" /> Archive
                        </button>
                      ) : (
                        <button
                          onClick={() => restoreMutation.mutate(s.id)}
                          className="text-green-600 hover:underline text-xs inline-flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" /> Restore
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
