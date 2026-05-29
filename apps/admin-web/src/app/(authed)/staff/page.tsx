'use client';

import { Fragment, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, HardHat, CalendarDays, DollarSign, Upload } from 'lucide-react';
import { api, downloadAdminFile } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ErrorState } from '@/components/ui/ErrorState';
import type { StaffUser, LeaveRequest, LeaveStatus } from '@societyos/api-client';

type StaffLoan = {
  id: string;
  amount: string | number;
  reason?: string | null;
  status: string;
  createdAt: string;
};

const LOAN_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  REPAID: 'bg-gray-100 text-gray-600',
};

function StaffLoansSection({ staffId }: { staffId: string }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ amount: '', reason: '' });

  const { data: loans, isLoading } = useQuery({
    queryKey: ['admin-staff-loans', staffId],
    queryFn: () => api.get<StaffLoan[]>(`/admin/staff/${staffId}/loans`),
  });

  const createMutation = useMutation({
    mutationFn: (data: { amount: number; reason?: string }) =>
      api.post(`/admin/staff/${staffId}/loans`, data),
    onSuccess: () => {
      toast.success('Loan recorded');
      qc.invalidateQueries({ queryKey: ['admin-staff-loans', staffId] });
      setShowForm(false);
      setForm({ amount: '', reason: '' });
    },
    onError: (err: any) => toast.error(err?.message ?? 'Failed to record loan'),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }
    createMutation.mutate({ amount: amt, reason: form.reason || undefined });
  }

  return (
    <div className="mt-4 border-t border-gray-100 pt-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <DollarSign className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Loans</span>
          {loans?.length ? (
            <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-1.5 py-0.5 rounded-full">
              {loans.length}
            </span>
          ) : null}
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="text-xs text-primary-600 hover:text-primary-700 font-medium"
        >
          {showForm ? 'Cancel' : '+ Record Loan'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="flex gap-2 mb-3 flex-wrap">
          <input
            type="number"
            min="1"
            step="0.01"
            placeholder="Amount (₹)"
            className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-primary-400 w-32"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
          />
          <input
            type="text"
            placeholder="Reason (optional)"
            className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-primary-400 flex-1 min-w-32"
            value={form.reason}
            onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
          />
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="bg-primary-500 hover:bg-primary-600 text-white text-xs px-3 py-1.5 rounded-lg disabled:opacity-50"
          >
            Save
          </button>
        </form>
      )}

      {isLoading ? (
        <p className="text-xs text-gray-400">Loading loans…</p>
      ) : !loans?.length ? (
        <p className="text-xs text-gray-400">No loans recorded</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-400">
              <th className="text-left pb-1 font-medium">Date</th>
              <th className="text-left pb-1 font-medium">Amount</th>
              <th className="text-left pb-1 font-medium">Reason</th>
              <th className="text-left pb-1 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loans.map((loan) => (
              <tr key={loan.id}>
                <td className="py-1 pr-4 text-gray-500">
                  {new Date(loan.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </td>
                <td className="py-1 pr-4 font-semibold text-gray-800">
                  ₹{Number(loan.amount).toLocaleString('en-IN')}
                </td>
                <td className="py-1 pr-4 text-gray-500">{loan.reason ?? '—'}</td>
                <td className="py-1">
                  <span className={cn('px-2 py-0.5 rounded-full font-medium', LOAN_STATUS_COLORS[loan.status] ?? 'bg-gray-100 text-gray-600')}>
                    {loan.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const DEPT_COLORS: Record<string, string> = {
  SECURITY: 'bg-blue-100 text-blue-700',
  HOUSEKEEPING: 'bg-green-100 text-green-700',
  MAINTENANCE: 'bg-amber-100 text-amber-700',
  ADMIN: 'bg-purple-100 text-purple-700',
  MEDICAL: 'bg-red-100 text-red-700',
};

const LEAVE_META: Record<LeaveStatus, { label: string; color: string }> = {
  PENDING: { label: 'Pending', color: 'bg-amber-100 text-amber-700' },
  APPROVED: { label: 'Approved', color: 'bg-green-100 text-green-700' },
  REJECTED: { label: 'Rejected', color: 'bg-red-100 text-red-700' },
  CANCELLED: { label: 'Cancelled', color: 'bg-gray-100 text-gray-600' },
};

type LeaveFilterTab = 'All' | 'PENDING' | 'APPROVED' | 'REJECTED';

type LeaveWithStaff = LeaveRequest & { staff?: Pick<StaffUser, 'name' | 'role'> };

type StaffDetail = StaffUser & {
  designation?: string;
  department?: string | null;
  categories?: string[];
  joiningDate?: string;
  leavingDate?: string | null;
  salary?: number;
};

function StaffDrawer({ staffId }: { staffId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-staff', staffId],
    queryFn: () => api.get<StaffDetail>(`/admin/staff/${staffId}`),
  });

  if (isLoading) {
    return (
      <tr>
        <td colSpan={6} className="px-4 py-3 bg-gray-50 text-sm text-gray-400 text-center">
          Loading…
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td colSpan={6} className="px-4 py-4 bg-gray-50 border-b border-gray-100">
        <div className="flex flex-wrap gap-6 text-sm">
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Designation</p>
            <p className="text-gray-900">{data?.designation || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Categories</p>
            <div className="flex flex-wrap gap-1 mt-0.5">
              {data?.categories?.length
                ? data.categories.map((cat) => (
                    <span
                      key={cat}
                      className={cn('text-xs px-2 py-0.5 rounded-full font-medium', DEPT_COLORS[cat] ?? 'bg-gray-100 text-gray-600')}
                    >
                      {cat}
                    </span>
                  ))
                : <span className="text-gray-400">—</span>}
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Joining Date</p>
            <p className="text-gray-900">
              {data?.joiningDate
                ? new Date(data.joiningDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Monthly Salary</p>
            <p className="text-gray-900">{data?.salary != null ? `₹${data.salary.toLocaleString('en-IN')}` : '—'}</p>
          </div>
        </div>
        <StaffLoansSection staffId={staffId} />
      </td>
    </tr>
  );
}

export default function StaffPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [leaveFilterTab, setLeaveFilterTab] = useState<LeaveFilterTab>('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importCsv, setImportCsv] = useState('');
  const [importPreview, setImportPreview] = useState<any>(null);

  const { data: staff, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-staff'],
    queryFn: () => api.get<StaffDetail[]>('/admin/staff'),
  });

  const { data: allLeaves } = useQuery({
    queryKey: ['admin-leaves-all'],
    queryFn: () => api.get<LeaveWithStaff[]>('/admin/leaves'),
  });

  const leaveActionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'reject' }) =>
      api.patch(`/admin/leaves/${id}/${action}`, {}),
    onSuccess: (_, { action }) => {
      qc.invalidateQueries({ queryKey: ['admin-leaves-pending'] });
      qc.invalidateQueries({ queryKey: ['admin-leaves-all'] });
      toast.success(action === 'approve' ? 'Leave approved.' : 'Leave rejected.');
    },
    onError: (err: Error & { code?: string }) => {
      if (err.code === 'LEAVE_ALREADY_DECIDED') {
        toast.error(`${err.message} Refresh the page if the list looks out of date.`);
        qc.invalidateQueries({ queryKey: ['admin-leaves-pending'] });
        qc.invalidateQueries({ queryKey: ['admin-leaves-all'] });
        return;
      }
      toast.error(err.code ? `${err.message} (${err.code})` : err.message);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/staff/${id}/deactivate`, {}),
    onSuccess: () => {
      toast.success('Staff member deactivated');
      qc.invalidateQueries({ queryKey: ['admin-staff'] });
    },
    onError: (err: any) => toast.error(err?.message ?? 'Failed to deactivate staff'),
  });

  const previewStaffImport = useMutation({
    mutationFn: (csv: string) => api.post('/admin/staff/import/preview', { csv }),
    onSuccess: (data) => setImportPreview(data),
    onError: (err: Error) => toast.error(err.message),
  });

  const importStaffMutation = useMutation({
    mutationFn: (csv: string) => api.post('/admin/staff/import', { csv }),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['admin-staff'] });
      setShowImport(false);
      setImportCsv('');
      setImportPreview(null);
      toast.success(`Imported ${data.created} staff (${data.skipped} skipped)`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const leaveCounts: Record<LeaveFilterTab, number> = {
    All: allLeaves?.length ?? 0,
    PENDING: allLeaves?.filter(l => l.status === 'PENDING').length ?? 0,
    APPROVED: allLeaves?.filter(l => l.status === 'APPROVED').length ?? 0,
    REJECTED: allLeaves?.filter(l => l.status === 'REJECTED').length ?? 0,
  };

  const displayedLeaves = leaveFilterTab === 'All'
    ? (allLeaves ?? [])
    : (allLeaves?.filter(l => l.status === leaveFilterTab) ?? []);

  const handleRowClick = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  const handleDeactivate = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to deactivate this staff member?')) return;
    deactivateMutation.mutate(id);
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Staff</h1>
            <p className="text-gray-500 text-sm mt-1">{staff?.length ?? 0} staff members</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowImport(true)}
              className="border border-gray-200 hover:border-gray-300 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium inline-flex items-center gap-1.5"
            >
              <Upload className="w-4 h-4" /> Import CSV
            </button>
            <button
              type="button"
              onClick={() => downloadAdminFile('/admin/staff/import/template', 'staff-import-template.csv').catch((e: Error) => toast.error(e.message))}
              className="border border-gray-200 text-gray-700 px-3 py-2 rounded-xl text-sm"
            >
              Template
            </button>
            <button
              onClick={() => router.push('/staff/add')}
              className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-xl text-sm font-medium inline-flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Staff
            </button>
          </div>
        </div>
      </div>

      {/* Leave requests with filter tabs */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Leave Requests
        </h2>
        {/* Filter tabs */}
        <div className="flex gap-2 mb-3 flex-wrap">
          {(['All', 'PENDING', 'APPROVED', 'REJECTED'] as LeaveFilterTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setLeaveFilterTab(tab)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium border transition-colors flex items-center gap-1.5',
                leaveFilterTab === tab
                  ? 'bg-primary-500 border-primary-500 text-white'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300',
              )}
            >
              {tab === 'All' ? 'All' : LEAVE_META[tab as LeaveStatus]?.label ?? tab}
              <span className={cn('text-xs rounded-full px-1.5 py-0.5', leaveFilterTab === tab ? 'bg-white text-primary-600' : 'bg-gray-100 text-gray-600')}>
                {leaveCounts[tab]}
              </span>
            </button>
          ))}
        </div>

        {displayedLeaves.length > 0 ? (
          <div className="space-y-3">
            {displayedLeaves.map((leave) => {
              const dayCount = Math.ceil(
                (new Date(leave.toDate).getTime() - new Date(leave.fromDate).getTime()) / (1000 * 60 * 60 * 24)
              );
              const isPending = leave.status === 'PENDING';
              return (
                <div key={leave.id} className={cn('bg-white rounded-2xl border shadow-sm p-4 flex items-center justify-between gap-4', isPending ? 'border-amber-200' : 'border-gray-100')}>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-900">
                        {leave.staff?.name ?? 'Unknown'} — {leave.leaveType}
                      </p>
                      {leave.staff?.role && (
                        <span className="text-xs text-gray-500">{leave.staff.role}</span>
                      )}
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                        {dayCount} day{dayCount !== 1 ? 's' : ''}
                      </span>
                      <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', LEAVE_META[leave.status]?.color)}>
                        {LEAVE_META[leave.status]?.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {new Date(leave.fromDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} –{' '}
                      {new Date(leave.toDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{leave.reason}</p>
                    {(leave as any).adminNote && (
                      <p className="text-xs text-gray-400 italic mt-0.5">{(leave as any).adminNote}</p>
                    )}
                  </div>
                  {isPending && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        className="text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg transition-colors"
                        onClick={() => leaveActionMutation.mutate({ id: leave.id, action: 'approve' })}
                      >
                        Approve
                      </button>
                      <button
                        className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded-lg transition-colors"
                        onClick={() => leaveActionMutation.mutate({ id: leave.id, action: 'reject' })}
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-8 text-center">
            <CalendarDays className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No leave requests</p>
          </div>
        )}
      </div>

      {/* Staff table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-gray-400">Loading…</div>
        ) : isError ? (
          <ErrorState onRetry={refetch} message="Staff couldn't be loaded. Your data is safe — please try again." />
        ) : !staff?.length ? (
          <div className="py-16 text-center">
            <HardHat className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No staff yet</p>
            <button
              onClick={() => router.push('/staff/add')}
              className="mt-4 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-xl text-sm font-medium inline-flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Staff
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {['Name', 'Phone', 'Role', 'Department', 'Joined', ''].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {staff.map((s) => (
                <Fragment key={s.id}>
                  <tr
                    className={cn('hover:bg-gray-50 cursor-pointer', s.leavingDate ? 'opacity-60' : '')}
                    onClick={() => handleRowClick(s.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={cn('w-8 h-8 rounded-full flex items-center justify-center shrink-0', s.leavingDate ? 'bg-gray-100' : 'bg-primary-100')}>
                          <span className={cn('text-xs font-semibold', s.leavingDate ? 'text-gray-400' : 'text-primary-600')}>
                            {s.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">{s.name}</span>
                          {s.leavingDate && (
                            <span className="text-xs bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">Ex-Staff</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{s.phone}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{s.designation || s.role}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {s.department ? (
                        <span className={cn('inline-block px-2 py-0.5 rounded-full text-xs', DEPT_COLORS[s.department] ?? 'bg-gray-100 text-gray-600')}>
                          {s.department}
                        </span>
                      ) : s.categories?.length ? (
                        <span className={cn('inline-block px-2 py-0.5 rounded-full text-xs', DEPT_COLORS[s.categories[0]] ?? 'bg-gray-100 text-gray-600')}>
                          {s.categories.join(', ')}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {s.joiningDate
                        ? new Date(s.joiningDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
                        : '-'}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => handleDeactivate(e, s.id)}
                        disabled={deactivateMutation.isPending}
                        className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                      >
                        Deactivate
                      </button>
                    </td>
                  </tr>
                  {expandedId === s.id && <StaffDrawer staffId={s.id} />}
                </Fragment>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold mb-2">Import Staff CSV</h2>
            <p className="text-xs text-gray-500 mb-3">name, phone, designation, department, categories, salary</p>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  const csv = String(reader.result ?? '');
                  setImportCsv(csv);
                  previewStaffImport.mutate(csv);
                };
                reader.readAsText(file);
              }}
            />
            {importPreview && (
              <div className="mt-3 text-xs bg-gray-50 rounded-xl p-3 max-h-32 overflow-y-auto">
                <p>{importPreview.valid?.length ?? 0} valid, {importPreview.errors?.length ?? 0} errors</p>
                {importPreview.errors?.map((e: any) => (
                  <p key={e.row} className="text-red-600">Row {e.row}: {e.reason}</p>
                ))}
              </div>
            )}
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => { setShowImport(false); setImportPreview(null); }} className="text-sm text-gray-500 px-3 py-2">Cancel</button>
              <button
                disabled={!importCsv || importStaffMutation.isPending}
                onClick={() => importStaffMutation.mutate(importCsv)}
                className="bg-primary-500 text-white text-sm px-4 py-2 rounded-xl disabled:opacity-50"
              >
                Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
