'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Package as PackageIcon, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ErrorState } from '@/components/ui/ErrorState';

type PackageStatus = 'PENDING' | 'NOTIFIED' | 'COLLECTED' | 'RETURNED';

const STATUS_META: Record<PackageStatus, { label: string; color: string }> = {
  PENDING:   { label: 'Pending',   color: 'bg-amber-100 text-amber-700' },
  NOTIFIED:  { label: 'Notified',  color: 'bg-blue-100 text-blue-700' },
  COLLECTED: { label: 'Collected', color: 'bg-green-100 text-green-700' },
  RETURNED:  { label: 'Returned',  color: 'bg-gray-100 text-gray-600' },
};

const FILTERS = ['ALL', 'PENDING', 'NOTIFIED', 'COLLECTED', 'RETURNED'] as const;
type Filter = typeof FILTERS[number];

type Package = {
  id: string;
  courierName: string;
  trackingNumber?: string;
  description?: string;
  status: PackageStatus;
  arrivedAt: string;
  collectedAt?: string;
  photoUrl?: string;
  resident?: {
    user?: { name: string };
    flat?: { number: string; block: string };
  };
};

export default function PackagesPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data, isLoading, isError, refetch } = useQuery<{ data: Package[]; total: number }>({
    queryKey: ['admin-packages', page],
    queryFn: () => api.get(`/packages?page=${page}&limit=30`),
  });

  const collectMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/packages/${id}/collect`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-packages'] });
      toast.success('Package marked as collected');
    },
    onError: (err: any) => toast.error(err?.message ?? 'Failed'),
  });

  const packages: Package[] = (data as { data?: Package[] } | undefined)?.data ?? (Array.isArray(data) ? data : []);
  const trimmedSearch = search.trim().toLowerCase();
  const filtered = packages.filter((p) => {
    if (filter !== 'ALL' && p.status !== filter) return false;
    if (!trimmedSearch) return true;
    const name = (p.resident?.user?.name ?? '').toLowerCase();
    const courier = (p.courierName ?? '').toLowerCase();
    const tracking = (p.trackingNumber ?? '').toLowerCase();
    const flat = p.resident?.flat ? `${p.resident.flat.block}-${p.resident.flat.number}`.toLowerCase() : '';
    return [name, courier, tracking, flat].some((s) => s.includes(trimmedSearch));
  });

  const pendingCount = packages.filter((p) => p.status === 'PENDING' || p.status === 'NOTIFIED').length;

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Package Tracking</h1>
          <p className="text-gray-500 text-sm mt-1">Manage resident package arrivals</p>
        </div>
        {pendingCount > 0 && (
          <span className="bg-amber-100 text-amber-700 text-sm font-semibold px-3 py-1 rounded-full">
            {pendingCount} awaiting collection
          </span>
        )}
      </div>

      <div className="relative mb-4">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by resident, courier, tracking number or flat…"
          aria-label="Search packages"
          className="w-full md:w-96 border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-sm outline-none focus:border-primary-400"
        />
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium border transition',
              filter === f
                ? 'bg-primary-500 text-white border-primary-500'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300',
            )}
          >
            {f === 'ALL' ? 'All' : STATUS_META[f as PackageStatus]?.label ?? f}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : isError ? (
        <ErrorState onRetry={refetch} message="Packages couldn't be loaded. Please try again." />
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm py-16 flex flex-col items-center justify-center text-center">
          <PackageIcon className="w-10 h-10 text-gray-300 mb-3" />
          <p className="font-medium text-gray-700">No packages yet</p>
          <p className="text-sm text-gray-400 mt-1">Resident packages will appear here as they arrive.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-5 py-3 text-xs text-gray-500 uppercase tracking-wide font-medium">Resident</th>
                <th className="text-left px-5 py-3 text-xs text-gray-500 uppercase tracking-wide font-medium">Courier</th>
                <th className="text-left px-5 py-3 text-xs text-gray-500 uppercase tracking-wide font-medium">Arrived</th>
                <th className="text-left px-5 py-3 text-xs text-gray-500 uppercase tracking-wide font-medium">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((pkg) => {
                const meta = STATUS_META[pkg.status] ?? STATUS_META.PENDING;
                const name = pkg.resident?.user?.name ?? '—';
                const flat = pkg.resident?.flat
                  ? `${pkg.resident.flat.block}-${pkg.resident.flat.number}`
                  : '—';
                return (
                  <tr key={pkg.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900">{name}</p>
                      <p className="text-xs text-gray-400">Flat {flat}</p>
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-gray-800">{pkg.courierName}</p>
                      {pkg.trackingNumber && (
                        <p className="text-xs text-gray-400 font-mono">{pkg.trackingNumber}</p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {new Date(pkg.arrivedAt).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td className="px-5 py-3">
                      <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full', meta.color)}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {(pkg.status === 'PENDING' || pkg.status === 'NOTIFIED') && (
                        <button
                          onClick={() => collectMutation.mutate(pkg.id)}
                          disabled={collectMutation.isPending}
                          className="text-xs font-semibold text-primary-600 hover:text-primary-700 disabled:opacity-50"
                        >
                          Mark Collected
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
