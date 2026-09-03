'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Wallet, X, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ErrorState } from '@/components/ui/ErrorState';

type WalletTxn = {
  id: string;
  type: string;
  amount: number;
  description?: string;
  reference?: string;
  status: string;
  createdAt: string;
  resident?: { user?: { name?: string }; flat?: { flatNumber?: string } };
};

const TYPE_META: Record<string, { label: string; color: string }> = {
  CREDIT: { label: 'Credit', color: 'bg-green-100 text-green-700' },
  DEBIT: { label: 'Debit', color: 'bg-amber-100 text-amber-700' },
  REFUND: { label: 'Refund', color: 'bg-teal-100 text-teal-700' },
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  SUCCESS: { label: 'Success', color: 'bg-green-100 text-green-700' },
  PENDING: { label: 'Pending', color: 'bg-amber-100 text-amber-700' },
  FAILED: { label: 'Failed', color: 'bg-red-100 text-red-700' },
};

type ResidentOption = {
  id: string;
  name: string;
  phone: string | null;
  flat: string | null;
  walletBalance: number;
};

function RefundModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (amount: number) => void }) {
  const [residentId, setResidentId] = useState('');
  const [residentQuery, setResidentQuery] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');

  /**
   * The form used to ask the operator to type a raw resident id ("res_abc123"),
   * which nobody has to hand. Search by name, phone or flat instead.
   */
  const { data: residents = [], isFetching: searching } = useQuery({
    queryKey: ['refund-resident-search', residentQuery],
    queryFn: () =>
      api.get<ResidentOption[]>(
        `/admin/wallet/residents${residentQuery.trim() ? `?q=${encodeURIComponent(residentQuery.trim())}` : ''}`,
      ),
    staleTime: 30_000,
  });

  const selected = residents.find((r) => r.id === residentId) ?? null;

  const refundMutation = useMutation({
    mutationFn: () =>
      api.post('/admin/wallet/refund', {
        residentId: residentId.trim(),
        amount: parseFloat(amount),
        // The API accepts `reason` (this form's label) or `description`.
        // It used to require `description` while forbidding unknown fields, so
        // every submit failed with "property reason should not exist".
        reason: reason.trim(),
        ...(reference.trim() ? { reference: reference.trim() } : {}),
      }),
    onSuccess: () => {
      onSuccess(parseFloat(amount));
    },
    onError: (err: Error & { code?: string }) => {
      toast.error(err.code ? `${err.message} (${err.code})` : err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!residentId.trim() || !amount || !reason.trim()) return;
    refundMutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Issue Refund</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Resident</label>
            <input
              type="text"
              value={residentQuery}
              onChange={(e) => { setResidentQuery(e.target.value); setResidentId(''); }}
              placeholder="Search by name, phone or flat…"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-primary-400 transition-colors"
            />
            {!selected && (
              <div className="mt-1 max-h-40 overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-50">
                {searching && <p className="px-3 py-2 text-xs text-gray-400">Searching…</p>}
                {!searching && residents.length === 0 && (
                  <p className="px-3 py-2 text-xs text-gray-400">No matching resident.</p>
                )}
                {residents.map((r) => (
                  <button
                    type="button"
                    key={r.id}
                    onClick={() => { setResidentId(r.id); setResidentQuery(r.name); }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50"
                  >
                    <span className="text-sm text-gray-900">{r.name}</span>
                    <span className="text-xs text-gray-400 ml-2">
                      {[r.flat, r.phone].filter(Boolean).join(' · ')}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {selected && (
              <p className="mt-1 text-xs text-gray-500">
                {selected.flat ? `${selected.flat} · ` : ''}Wallet balance ₹
                {selected.walletBalance.toLocaleString('en-IN')}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Amount (₹)</label>
            <input
              type="number"
              min="1"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              placeholder="0.00"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-primary-400 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Reason</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              placeholder="Reason for refund…"
              rows={3}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-primary-400 transition-colors resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Reference <span className="text-gray-400 font-normal">(optional)</span></label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. txn_xyz"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-primary-400 transition-colors"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 px-4 py-2 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={refundMutation.isPending}
              className="flex-1 text-sm bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
            >
              {refundMutation.isPending ? 'Processing…' : 'Submit Refund'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function WalletPage() {
  const qc = useQueryClient();
  const [showRefund, setShowRefund] = useState(false);

  const { data: transactions, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-wallet-activity'],
    queryFn: () => api.get<WalletTxn[]>('/admin/wallet/activity'),
  });

  const handleRefundSuccess = (amount: number) => {
    toast.success(`Refund of ₹${amount.toLocaleString('en-IN')} has been processed.`);
    qc.invalidateQueries({ queryKey: ['admin-wallet-activity'] });
    setShowRefund(false);
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Wallet Activity</h1>
            <p className="text-gray-500 text-sm mt-1">Society wallet transactions and refunds</p>
          </div>
          <button
            onClick={() => setShowRefund(true)}
            className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
          >
            <Plus className="w-5 h-5" />
            Issue Refund
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-gray-400">Loading…</div>
        ) : isError ? (
          <ErrorState onRetry={refetch} message="Wallet activity couldn't be loaded. Your data is safe — please try again." />
        ) : !transactions?.length ? (
          <div className="py-16 flex flex-col items-center text-center">
            <Wallet className="w-10 h-10 text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-700">No wallet activity yet</p>
            <p className="text-xs text-gray-400 mt-1 mb-4">Refunds and credits will appear here</p>
            <button
              onClick={() => setShowRefund(true)}
              className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Issue Refund
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {['Resident', 'Flat', 'Type', 'Amount', 'Description', 'Reference', 'Status', 'Date'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {transactions.map((txn) => {
                const typeMeta = TYPE_META[txn.type] ?? { label: txn.type, color: 'bg-gray-100 text-gray-600' };
                const statusMeta = STATUS_META[txn.status] ?? { label: txn.status, color: 'bg-gray-100 text-gray-600' };
                return (
                  <tr key={txn.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {txn.resident?.user?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {txn.resident?.flat?.flatNumber ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', typeMeta.color)}>
                        {typeMeta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      ₹{txn.amount.toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                      {txn.description ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {txn.reference ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', statusMeta.color)}>
                        {statusMeta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400 whitespace-nowrap">
                      {new Date(txn.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {showRefund && (
        <RefundModal
          onClose={() => setShowRefund(false)}
          onSuccess={handleRefundSuccess}
        />
      )}
    </div>
  );
}
