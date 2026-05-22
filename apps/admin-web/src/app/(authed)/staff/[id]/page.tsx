'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, CalendarDays, ArrowLeftRight, Ban } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ErrorState } from '@/components/ui/ErrorState';

const SALARY_FIELDS = [
  { key: 'base', label: 'Basic (₹)' },
  { key: 'hra', label: 'HRA (₹)' },
  { key: 'da', label: 'DA (₹)' },
  { key: 'allowances', label: 'Allowances (₹)' },
] as const;

type SalaryKey = (typeof SALARY_FIELDS)[number]['key'];

export default function StaffDetailPage() {
  const router = useRouter();
  const params = useParams();
  const qc = useQueryClient();
  const staffId = params.id as string;
  const [tab, setTab] = useState<'overview' | 'documents' | 'salary'>('overview');
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferForm, setTransferForm] = useState({ toSocietyId: '', reason: '' });
  const [showDeactivate, setShowDeactivate] = useState(false);
  const [salaryForm, setSalaryForm] = useState<Record<SalaryKey, string>>({ base: '', hra: '', da: '', allowances: '' });
  const [salaryEdited, setSalaryEdited] = useState(false);

  const { data: staff, isLoading, isError, refetch } = useQuery({
    queryKey: ['staff-detail', staffId],
    queryFn: () => api.get<any>(`/admin/staff/${staffId}`),
    enabled: !!staffId,
  });

  useEffect(() => {
    if (!staff?.salaryStructure || typeof staff.salaryStructure !== 'object') return;
    const ss = staff.salaryStructure as Record<string, any>;
    setSalaryForm({
      base: ss.base != null ? String(ss.base) : '',
      hra: ss.hra != null ? String(ss.hra) : '',
      da: ss.da != null ? String(ss.da) : '',
      allowances: ss.allowances != null ? String(ss.allowances) : '',
    });
    setSalaryEdited(false);
  }, [staff]);

  const { data: documents } = useQuery({
    queryKey: ['staff-documents', staffId],
    queryFn: () => api.get<any[]>(`/admin/staff/${staffId}/documents`),
    enabled: tab === 'documents' && !!staffId,
  });

  const { data: salarySlips } = useQuery({
    queryKey: ['staff-salary-slips', staffId],
    queryFn: () => api.get<any[]>(`/admin/staff/${staffId}/salary-slips`),
    enabled: tab === 'salary' && !!staffId,
  });

  const transferMutation = useMutation({
    mutationFn: () => api.patch(`/admin/staff/${staffId}/transfer`, {
      toSocietyId: transferForm.toSocietyId,
      reason: transferForm.reason,
    }),
    onSuccess: () => {
      setShowTransfer(false);
      qc.invalidateQueries({ queryKey: ['staff-detail', staffId] });
      toast.success('Staff transferred successfully');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deactivateMutation = useMutation({
    mutationFn: () => api.patch(`/admin/staff/${staffId}/deactivate`, {}),
    onSuccess: () => {
      setShowDeactivate(false);
      toast.success('Staff deactivated');
      router.push('/staff');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateSalaryMutation = useMutation({
    mutationFn: () => {
      const salaryStructure: Record<string, number | null> = {};
      for (const f of SALARY_FIELDS) {
        const raw = salaryForm[f.key];
        if (raw === '') { salaryStructure[f.key] = null; continue; }
        const n = Number(raw);
        if (!Number.isFinite(n) || n < 0) throw new Error(`Invalid value for ${f.label}`);
        salaryStructure[f.key] = n;
      }
      return api.patch(`/admin/staff/${staffId}`, { salaryStructure });
    },
    onSuccess: () => {
      setSalaryEdited(false);
      qc.invalidateQueries({ queryKey: ['staff-detail', staffId] });
      toast.success('Salary structure saved');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Close modals on Escape
  useEffect(() => {
    if (!showTransfer && !showDeactivate) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setShowTransfer(false);
      setShowDeactivate(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showTransfer, showDeactivate]);

  if (isLoading) {
    return <div className="p-8 text-center text-gray-400">Loading…</div>;
  }

  if (isError) return <ErrorState onRetry={refetch} message="Staff information couldn't be loaded. Your data is safe — please try again." />;

  if (!staff) {
    return (
      <div className="p-6 lg:p-8">
        <button onClick={() => router.back()} className="text-primary-500 hover:text-primary-600 mb-4 inline-flex items-center gap-1.5 text-sm">
          <ArrowLeft className="w-4 h-4" /> Back to Staff
        </button>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center text-gray-400">
          Staff member not found.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      <button onClick={() => router.back()} className="text-primary-500 hover:text-primary-600 mb-4 inline-flex items-center gap-1.5 text-sm">
        <ArrowLeft className="w-4 h-4" /> Back to Staff
      </button>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-primary-50 flex items-center justify-center">
            <span className="text-2xl font-bold text-primary-600">
              {staff?.name?.charAt(0) || '?'}
            </span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{staff?.name || 'Unknown'}</h1>
            <p className="text-gray-500">{staff?.role || staff?.designation}</p>
          </div>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Phone</span>
            <span className="text-gray-900">{staff?.phone}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Categories</span>
            <span className="text-gray-900">{staff?.categories?.join(', ') || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Joining Date</span>
            <span className="text-gray-900">
              {staff?.joiningDate
                ? new Date(staff.joiningDate).toLocaleDateString('en-IN')
                : '-'}
            </span>
          </div>
          {staff?.salary && (
            <div className="flex justify-between">
              <span className="text-gray-500">Monthly Salary</span>
              <span className="text-gray-900">₹{staff.salary.toLocaleString('en-IN')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(['overview', 'documents', 'salary'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-1.5 rounded-full text-sm font-medium border transition-colors capitalize',
              tab === t
                ? 'bg-primary-500 border-primary-500 text-white'
                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-3">
          <Link
            href={`/staff/${staffId}/attendance`}
            className="w-full py-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-left px-4 flex items-center gap-2.5 text-sm text-gray-700 transition-colors"
          >
            <CalendarDays className="w-4 h-4 text-gray-500" /> Attendance
          </Link>

          <button
            onClick={() => setShowTransfer(true)}
            className="w-full py-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-left px-4 flex items-center gap-2.5 text-sm text-gray-700 transition-colors"
          >
            <ArrowLeftRight className="w-4 h-4 text-gray-500" /> Transfer to Another Society
          </button>

          <button
            onClick={() => setShowDeactivate(true)}
            className="w-full py-3 rounded-xl border border-red-200 bg-white hover:bg-red-50 text-left px-4 text-red-600 flex items-center gap-2.5 text-sm transition-colors"
          >
            <Ban className="w-4 h-4" /> Deactivate Staff
          </button>
        </div>
      )}

      {tab === 'documents' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Documents</h2>
          {!documents ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : documents.length === 0 ? (
            <p className="text-sm text-gray-400">No documents uploaded yet.</p>
          ) : (
            <div className="space-y-3">
              {documents.map((doc: any) => (
                <div key={doc.type} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{doc.type.replace('_', ' ')}</p>
                    <p className="text-xs text-gray-400">{doc.status}</p>
                  </div>
                  {doc.url && (
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary-500 hover:underline"
                    >
                      View
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'salary' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Salary Structure</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              {SALARY_FIELDS.map(({ key, label }) => (
                <div key={key}>
                  <label className="text-xs text-gray-400 mb-1 block">{label}</label>
                  <input
                    type="number"
                    min={0}
                    step="100"
                    value={salaryForm[key]}
                    onChange={(e) => {
                      setSalaryForm((f) => ({ ...f, [key]: e.target.value }));
                      setSalaryEdited(true);
                    }}
                    placeholder="0"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-50 transition-colors"
                  />
                </div>
              ))}
            </div>
            {(() => {
              const total = SALARY_FIELDS.reduce((sum, f) => {
                const n = Number(salaryForm[f.key]);
                return sum + (Number.isFinite(n) ? n : 0);
              }, 0);
              return total > 0 ? (
                <p className="text-sm text-gray-500 mb-4">Gross: ₹{total.toLocaleString('en-IN')}</p>
              ) : null;
            })()}
            <button
              onClick={() => updateSalaryMutation.mutate()}
              disabled={!salaryEdited || updateSalaryMutation.isPending}
              className="px-4 py-2 bg-primary-500 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
            >
              {updateSalaryMutation.isPending ? 'Saving…' : 'Save Salary Structure'}
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Salary Slips</h2>
            {!salarySlips ? (
              <p className="text-sm text-gray-400">Loading…</p>
            ) : salarySlips.length === 0 ? (
              <p className="text-sm text-gray-400">No salary slips generated yet.</p>
            ) : (
              <div className="space-y-2">
                {salarySlips.map((slip: any) => (
                  <div key={slip.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{slip.period}</p>
                      <p className="text-xs text-gray-400">Net: ₹{Number(slip.netPay).toLocaleString('en-IN')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Gross: ₹{Number(slip.grossPay).toLocaleString('en-IN')}</p>
                      {slip.fileUrl && (
                        <a
                          href={slip.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary-500 hover:underline"
                        >
                          Download
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showTransfer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowTransfer(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">Transfer Staff</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Society ID
                </label>
                <input
                  type="text"
                  value={transferForm.toSocietyId}
                  onChange={e => setTransferForm(prev => ({ ...prev, toSocietyId: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2"
                  placeholder="Enter society ID"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason (optional)
                </label>
                <textarea
                  value={transferForm.reason}
                  onChange={e => setTransferForm(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2"
                  rows={2}
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowTransfer(false)}
                  className="flex-1 py-2 border border-gray-200 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  onClick={() => transferMutation.mutate()}
                  disabled={!transferForm.toSocietyId || transferMutation.isPending}
                  className="flex-1 py-2 bg-primary-500 text-white rounded-xl"
                >
                  {transferMutation.isPending ? 'Transferring...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeactivate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowDeactivate(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-2">Deactivate Staff?</h2>
            <p className="text-gray-500 mb-4 text-sm">
              This will deactivate {staff?.name}&apos;s account. They will no longer be able to login.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setShowDeactivate(false)}
                className="flex-1 py-2 border border-gray-200 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => deactivateMutation.mutate()}
                disabled={deactivateMutation.isPending}
                className="flex-1 py-2 bg-red-500 text-white rounded-xl disabled:opacity-50"
              >
                {deactivateMutation.isPending ? 'Deactivating…' : 'Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
