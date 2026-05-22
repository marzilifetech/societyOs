'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Store, Plus, Pencil, Inbox } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ErrorState } from '@/components/ui/ErrorState';

type Vendor = {
  id: string;
  name: string;
  category: string;
  phone: string;
  logoUrl?: string;
  isActive: boolean;
};

type VendorOrder = {
  id: string;
  vendor?: { name: string };
  resident?: { name: string; unit?: { flatNumber: string } };
  itemsCount?: number;
  total: number;
  status: string;
  createdAt: string;
};

const CATEGORIES = ['Grocery', 'Pharmacy', 'Restaurant', 'Laundry', 'Cleaning', 'Plumber', 'Electrician', 'Other'];

const ORDER_STATUS_META: Record<string, { label: string; color: string }> = {
  PENDING:    { label: 'Pending',    color: 'bg-amber-100 text-amber-700' },
  CONFIRMED:  { label: 'Confirmed',  color: 'bg-blue-100 text-blue-700' },
  IN_TRANSIT: { label: 'In Transit', color: 'bg-purple-100 text-purple-700' },
  DELIVERED:  { label: 'Delivered',  color: 'bg-green-100 text-green-700' },
  CANCELLED:  { label: 'Cancelled',  color: 'bg-gray-100 text-gray-600' },
};

const CATEGORY_COLORS: Record<string, string> = {
  Grocery:      'bg-green-100 text-green-700',
  Pharmacy:     'bg-blue-100 text-blue-700',
  Restaurant:   'bg-orange-100 text-orange-700',
  Laundry:      'bg-teal-100 text-teal-700',
  Cleaning:     'bg-cyan-100 text-cyan-700',
  Plumber:      'bg-violet-100 text-violet-700',
  Electrician:  'bg-yellow-100 text-yellow-700',
  Other:        'bg-gray-100 text-gray-600',
};

type ModalMode = 'add' | 'edit';

function VendorModal({
  mode,
  vendor,
  onClose,
}: {
  mode: ModalMode;
  vendor?: Vendor;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(vendor?.name ?? '');
  const [category, setCategory] = useState(vendor?.category ?? CATEGORIES[0]);
  const [phone, setPhone] = useState(vendor?.phone ?? '');
  const [logoUrl, setLogoUrl] = useState(vendor?.logoUrl ?? '');

  const mutation = useMutation({
    mutationFn: (body: Partial<Vendor>) =>
      mode === 'add'
        ? api.post('/vendors', body)
        : api.patch(`/vendors/${vendor!.id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendors'] });
      toast.success(mode === 'add' ? 'Vendor added' : 'Vendor updated');
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      name: name.trim(),
      category,
      phone: phone.trim(),
      ...(logoUrl.trim() ? { logoUrl: logoUrl.trim() } : {}),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {mode === 'add' ? 'Add Vendor' : 'Edit Vendor'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary-400"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary-400"
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary-400"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Logo URL (optional)</label>
            <input
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary-400"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 bg-primary-500 hover:bg-primary-600 text-white py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-60"
            >
              {mutation.isPending ? 'Saving…' : mode === 'add' ? 'Add Vendor' : 'Save Changes'}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function VendorsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'vendors' | 'orders'>('vendors');
  const [modal, setModal] = useState<{ mode: ModalMode; vendor?: Vendor } | null>(null);
  const [ordersPage, setOrdersPage] = useState(1);

  const { data: vendors, isLoading, isError, refetch } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => api.get<Vendor[]>('/vendors'),
  });

  const { data: ordersData, isLoading: ordersLoading, isError: ordersError, refetch: ordersRefetch } = useQuery({
    queryKey: ['vendor-orders', ordersPage],
    queryFn: () => api.get<{ orders: VendorOrder[]; total: number }>(`/vendors/orders?page=${ordersPage}`),
    enabled: tab === 'orders',
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/vendors/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendors'] }),
    onError: (err: Error) => toast.error(err.message),
  });

  const updateOrderStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/vendors/orders/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendor-orders'] }),
    onError: (err: Error) => toast.error(err.message),
  });

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  const orders: VendorOrder[] = ordersData?.orders ?? [];

  return (
    <div className="p-6 lg:p-8">
      {modal && (
        <VendorModal
          mode={modal.mode}
          vendor={modal.vendor}
          onClose={() => setModal(null)}
        />
      )}

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendors</h1>
          <p className="text-gray-500 text-sm mt-1">{vendors?.length ?? 0} vendors registered</p>
        </div>
        {tab === 'vendors' && (
          <button
            onClick={() => setModal({ mode: 'add' })}
            className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Vendor
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-6">
        {(['vendors', 'orders'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-1.5 rounded-full text-sm font-medium border transition-colors',
              tab === t
                ? 'bg-primary-500 border-primary-500 text-white'
                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300',
            )}
          >
            {t === 'vendors' ? 'Vendors' : 'Orders'}
          </button>
        ))}
      </div>

      {tab === 'vendors' && (
        <>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-2xl" />)}
            </div>
          ) : isError ? (
            <ErrorState onRetry={refetch} message="Vendors couldn't be loaded. Please try again." />
          ) : !vendors?.length ? (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm py-16 flex flex-col items-center text-center">
              <Store className="w-10 h-10 text-gray-300 mb-3" />
              <p className="text-sm font-medium text-gray-700">No vendors yet</p>
              <p className="text-xs text-gray-400 mt-1 mb-4">Add registered vendors to start accepting orders</p>
              <button
                onClick={() => setModal({ mode: 'add' })}
                className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-xl text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Add Vendor
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-50">
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Vendor</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Category</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Phone</th>
                    <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">Status</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map((v) => (
                    <tr key={v.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          {v.logoUrl ? (
                            <img src={v.logoUrl} alt={v.name} className="w-8 h-8 rounded-lg object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-400">
                              {v.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <span className="font-medium text-gray-900">{v.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', CATEGORY_COLORS[v.category] ?? 'bg-gray-100 text-gray-600')}>
                          {v.category}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-600">{v.phone}</td>
                      <td className="px-5 py-3 text-center">
                        <button
                          onClick={() => toggleActiveMutation.mutate({ id: v.id, isActive: !v.isActive })}
                          className={cn(
                            'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                            v.isActive ? 'bg-green-500' : 'bg-gray-300',
                          )}
                        >
                          <span className={cn('inline-block h-3 w-3 rounded-full bg-white transition-transform', v.isActive ? 'translate-x-5' : 'translate-x-1')} />
                        </button>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => setModal({ mode: 'edit', vendor: v })}
                          className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                          title="Edit"
                          aria-label="Edit vendor"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'orders' && (
        <>
          {ordersLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => <div key={i} className="h-14 bg-gray-100 animate-pulse rounded-2xl" />)}
            </div>
          ) : ordersError ? (
            <ErrorState onRetry={ordersRefetch} message="Orders couldn't be loaded. Please try again." />
          ) : !orders.length ? (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm py-16 flex flex-col items-center text-center">
              <Inbox className="w-10 h-10 text-gray-300 mb-3" />
              <p className="text-sm font-medium text-gray-700">No orders yet</p>
              <p className="text-xs text-gray-400 mt-1">Orders placed by residents will show up here</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-50">
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Resident</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Vendor</th>
                    <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">Items</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-gray-500">Total</th>
                    <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">Status</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-gray-500">Date</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-gray-500">Update</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o: VendorOrder) => {
                    const meta = ORDER_STATUS_META[o.status] ?? { label: o.status, color: 'bg-gray-100 text-gray-600' };
                    return (
                      <tr key={o.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                        <td className="px-5 py-3">
                          <p className="font-medium text-gray-900">{o.resident?.name ?? '—'}</p>
                          <p className="text-xs text-gray-400">{o.resident?.unit?.flatNumber ?? ''}</p>
                        </td>
                        <td className="px-5 py-3 text-gray-600">{o.vendor?.name ?? '—'}</td>
                        <td className="px-5 py-3 text-center text-gray-600">{o.itemsCount ?? '—'}</td>
                        <td className="px-5 py-3 text-right font-medium text-gray-900">{fmt(o.total)}</td>
                        <td className="px-5 py-3 text-center">
                          <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', meta.color)}>
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right text-gray-500 text-xs">
                          {new Date(o.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <select
                            value={o.status}
                            onChange={(e) => updateOrderStatusMutation.mutate({ id: o.id, status: e.target.value })}
                            className="text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-primary-400"
                          >
                            {Object.entries(ORDER_STATUS_META).map(([k, v]) => (
                              <option key={k} value={k}>{v.label}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
                <button
                  disabled={ordersPage <= 1}
                  onClick={() => setOrdersPage((p) => p - 1)}
                  className="text-xs text-gray-600 hover:text-gray-900 disabled:opacity-40 px-3 py-1.5 border border-gray-200 rounded-lg"
                >
                  Previous
                </button>
                <span className="text-xs text-gray-500">Page {ordersPage}</span>
                <button
                  onClick={() => setOrdersPage((p) => p + 1)}
                  className="text-xs text-gray-600 hover:text-gray-900 px-3 py-1.5 border border-gray-200 rounded-lg"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
