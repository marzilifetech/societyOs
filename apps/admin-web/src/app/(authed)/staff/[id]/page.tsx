'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, CalendarDays, ArrowLeftRight, Ban, UserX, Plus, Trash2 } from 'lucide-react';
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

const DOCUMENT_TYPES = [
  'AADHAR',
  'PAN',
  'PASSPORT',
  'DRIVING_LICENSE',
  'VOTER_ID',
  'POLICE_VERIFICATION',
  'INSURANCE',
  'OFFER_LETTER',
  'OTHER',
];

const DEPT_LABELS: Record<string, string> = {
  SECURITY: 'Security',
  HOUSEKEEPING: 'Housekeeping',
  MAINTENANCE: 'Maintenance',
  ADMIN: 'Admin',
  MEDICAL: 'Medical',
};

const DEPT_COLORS: Record<string, string> = {
  SECURITY: 'bg-blue-100 text-blue-700',
  HOUSEKEEPING: 'bg-purple-100 text-purple-700',
  MAINTENANCE: 'bg-orange-100 text-orange-700',
  ADMIN: 'bg-gray-100 text-gray-700',
  MEDICAL: 'bg-green-100 text-green-700',
};

function calcAge(dob: string): number | null {
  if (!dob) return null;
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
  return age >= 0 ? age : null;
}

type FamilyMember = { name: string; relation: string; phone: string };

export default function StaffDetailPage() {
  const router = useRouter();
  const params = useParams();
  const qc = useQueryClient();
  const staffId = params.id as string;
  const [tab, setTab] = useState<'overview' | 'documents' | 'salary' | 'family'>('overview');
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferForm, setTransferForm] = useState({ toSocietyId: '', reason: '' });
  const [showDeactivate, setShowDeactivate] = useState(false);
  const [showDismiss, setShowDismiss] = useState(false);
  const [salaryForm, setSalaryForm] = useState<Record<SalaryKey, string>>({ base: '', hra: '', da: '', allowances: '' });
  const [salaryEdited, setSalaryEdited] = useState(false);

  // Profile edit state
  const [editForm, setEditForm] = useState<{
    gender: string;
    dateOfBirth: string;
    department: string;
    designation: string;
    leavingDate: string;
  }>({ gender: '', dateOfBirth: '', department: '', designation: '', leavingDate: '' });
  const [profileEdited, setProfileEdited] = useState(false);

  // Document upload state
  const [showDocUpload, setShowDocUpload] = useState(false);
  const [docForm, setDocForm] = useState({ documentType: 'AADHAR', file: null as File | null });

  // Family state
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [familyEdited, setFamilyEdited] = useState(false);
  const [emergencyContact, setEmergencyContact] = useState({ name: '', phone: '', relation: '' });
  const [ecEdited, setEcEdited] = useState(false);

  const { data: staff, isLoading, isError, refetch } = useQuery({
    queryKey: ['staff-detail', staffId],
    queryFn: () => api.get<any>(`/admin/staff/${staffId}`),
    enabled: !!staffId,
  });

  useEffect(() => {
    if (!staff) return;
    if (staff.salaryStructure && typeof staff.salaryStructure === 'object') {
      const ss = staff.salaryStructure as Record<string, any>;
      setSalaryForm({
        base: ss.base != null ? String(ss.base) : '',
        hra: ss.hra != null ? String(ss.hra) : '',
        da: ss.da != null ? String(ss.da) : '',
        allowances: ss.allowances != null ? String(ss.allowances) : '',
      });
    }
    setSalaryEdited(false);
    setEditForm({
      gender: staff.gender ?? '',
      dateOfBirth: staff.dateOfBirth ? staff.dateOfBirth.slice(0, 10) : '',
      department: staff.department ?? '',
      designation: staff.designation ?? '',
      leavingDate: staff.leavingDate ? staff.leavingDate.slice(0, 10) : '',
    });
    setProfileEdited(false);
    if (Array.isArray(staff.familyDetails)) {
      setFamilyMembers(staff.familyDetails as FamilyMember[]);
    }
    setFamilyEdited(false);
    const ec = (staff as any).emergencyContact;
    setEmergencyContact({
      name: ec?.name ?? '',
      phone: ec?.phone ?? '',
      relation: ec?.relation ?? '',
    });
    setEcEdited(false);
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

  const dismissMutation = useMutation({
    mutationFn: () => api.patch(`/admin/staff/${staffId}/dismiss`, {}),
    onSuccess: () => {
      setShowDismiss(false);
      toast.success('Staff marked as left society');
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

  const updateProfileMutation = useMutation({
    mutationFn: () => api.patch(`/admin/staff/${staffId}`, {
      gender: editForm.gender || undefined,
      dateOfBirth: editForm.dateOfBirth || null,
      department: editForm.department || undefined,
      designation: editForm.designation || undefined,
      leavingDate: editForm.leavingDate || null,
    }),
    onSuccess: () => {
      setProfileEdited(false);
      qc.invalidateQueries({ queryKey: ['staff-detail', staffId] });
      qc.invalidateQueries({ queryKey: ['admin-staff'] });
      toast.success('Profile updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateFamilyMutation = useMutation({
    mutationFn: () => api.patch(`/admin/staff/${staffId}`, { familyDetails: familyMembers }),
    onSuccess: () => {
      setFamilyEdited(false);
      qc.invalidateQueries({ queryKey: ['staff-detail', staffId] });
      toast.success('Family details saved');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateEmergencyContactMutation = useMutation({
    mutationFn: () =>
      api.patch(`/admin/staff/${staffId}`, {
        emergencyContact: emergencyContact.name || emergencyContact.phone
          ? emergencyContact
          : null,
      }),
    onSuccess: () => {
      setEcEdited(false);
      qc.invalidateQueries({ queryKey: ['staff-detail', staffId] });
      toast.success('Emergency contact saved');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteDocMutation = useMutation({
    mutationFn: (docId: string) => api.delete(`/admin/staff/${staffId}/documents/${docId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff-documents', staffId] });
      toast.success('Document deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const verifyDocMutation = useMutation({
    // Use /review (alias of /verify) — see backend admin.controller.ts comment.
    // Brave + EasyList block URLs with "verify" as a tracking-pixel false-positive.
    mutationFn: (docId: string) => api.patch(`/admin/staff/${staffId}/documents/${docId}/review`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff-documents', staffId] });
      toast.success('Document verified');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const uploadDocMutation = useMutation({
    mutationFn: async () => {
      if (!docForm.file) throw new Error('Select a file to upload');
      const presign = await api.post<{ url: string; publicUrl: string }>('/upload/presign', {
        contentType: docForm.file.type || 'application/octet-stream',
        folder: `staff/${staffId}/documents`,
      });
      await fetch(presign.url, {
        method: 'PUT',
        body: docForm.file,
        headers: { 'Content-Type': docForm.file.type || 'application/octet-stream' },
      });
      return api.post(`/admin/staff/${staffId}/documents`, {
        documentType: docForm.documentType,
        fileUrl: presign.publicUrl,
      });
    },
    onSuccess: () => {
      setShowDocUpload(false);
      setDocForm({ documentType: 'AADHAR', file: null });
      qc.invalidateQueries({ queryKey: ['staff-documents', staffId] });
      toast.success('Document uploaded');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Close modals on Escape
  useEffect(() => {
    if (!showTransfer && !showDeactivate && !showDismiss) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setShowTransfer(false);
      setShowDeactivate(false);
      setShowDismiss(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showTransfer, showDeactivate, showDismiss]);

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

  const isExStaff = !!staff.leavingDate;
  const age = staff.dateOfBirth ? calcAge(staff.dateOfBirth) : null;

  return (
    <div className="p-6 lg:p-8">
      <button onClick={() => router.back()} className="text-primary-500 hover:text-primary-600 mb-4 inline-flex items-center gap-1.5 text-sm">
        <ArrowLeft className="w-4 h-4" /> Back to Staff
      </button>

      <div className={cn('bg-white rounded-2xl border border-gray-100 p-6 mb-4', isExStaff && 'opacity-75')}>
        <div className="flex items-center gap-4 mb-4">
          <div className={cn('w-16 h-16 rounded-full flex items-center justify-center', isExStaff ? 'bg-gray-100' : 'bg-primary-50')}>
            <span className={cn('text-2xl font-bold', isExStaff ? 'text-gray-400' : 'text-primary-600')}>
              {staff?.name?.charAt(0) || '?'}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">{staff?.name || 'Unknown'}</h1>
              {isExStaff && (
                <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full font-medium">Ex-Staff</span>
              )}
            </div>
            <p className="text-gray-500 text-sm">{staff?.designation || staff?.role}</p>
            {staff?.department && (
              <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium mt-1 inline-block', DEPT_COLORS[staff.department] ?? 'bg-gray-100 text-gray-600')}>
                {DEPT_LABELS[staff.department] ?? staff.department}
              </span>
            )}
            {(staff?.pendingLoansCount ?? 0) > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium mt-1 inline-block bg-amber-100 text-amber-700">
                {staff.pendingLoansCount} pending loan{staff.pendingLoansCount === 1 ? '' : 's'}
              </span>
            )}
          </div>
        </div>

        <div className="space-y-2.5 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Phone</span>
            <span className="text-gray-900">{staff?.phone}</span>
          </div>
          {staff?.gender && (
            <div className="flex justify-between">
              <span className="text-gray-500">Gender</span>
              <span className="text-gray-900 capitalize">{staff.gender.toLowerCase()}</span>
            </div>
          )}
          {age !== null && (
            <div className="flex justify-between">
              <span className="text-gray-500">Age</span>
              <span className="text-gray-900">{age} yrs {staff.dateOfBirth ? `(${new Date(staff.dateOfBirth).toLocaleDateString('en-IN')})` : ''}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-500">Categories</span>
            <span className="text-gray-900">{staff?.categories?.join(', ') || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Joining Date</span>
            <span className="text-gray-900">
              {staff?.joiningDate ? new Date(staff.joiningDate).toLocaleDateString('en-IN') : '-'}
            </span>
          </div>
          {staff?.leavingDate && (
            <div className="flex justify-between">
              <span className="text-gray-500">Leaving Date</span>
              <span className="text-red-600">{new Date(staff.leavingDate).toLocaleDateString('en-IN')}</span>
            </div>
          )}
          {staff?.salary && (
            <div className="flex justify-between">
              <span className="text-gray-500">Monthly Salary</span>
              <span className="text-gray-900">₹{staff.salary.toLocaleString('en-IN')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(['overview', 'documents', 'salary', 'family'] as const).map((t) => (
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
        <div className="space-y-4">
          {/* Edit profile fields */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Edit Profile</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Gender</label>
                <select
                  value={editForm.gender}
                  onChange={(e) => { setEditForm(f => ({ ...f, gender: e.target.value })); setProfileEdited(true); }}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-50"
                >
                  <option value="">Not specified</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Date of Birth</label>
                <input
                  type="date"
                  value={editForm.dateOfBirth}
                  onChange={(e) => { setEditForm(f => ({ ...f, dateOfBirth: e.target.value })); setProfileEdited(true); }}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-50"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Department</label>
                <select
                  value={editForm.department}
                  onChange={(e) => { setEditForm(f => ({ ...f, department: e.target.value })); setProfileEdited(true); }}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-50"
                >
                  <option value="">Not assigned</option>
                  {Object.entries(DEPT_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Designation</label>
                <input
                  type="text"
                  value={editForm.designation}
                  onChange={(e) => { setEditForm(f => ({ ...f, designation: e.target.value })); setProfileEdited(true); }}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-50"
                  placeholder="e.g. Senior Electrician"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Leaving Date</label>
                <input
                  type="date"
                  value={editForm.leavingDate}
                  onChange={(e) => { setEditForm(f => ({ ...f, leavingDate: e.target.value })); setProfileEdited(true); }}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-50"
                />
              </div>
            </div>
            <button
              onClick={() => updateProfileMutation.mutate()}
              disabled={!profileEdited || updateProfileMutation.isPending}
              className="mt-4 px-4 py-2 bg-primary-500 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
            >
              {updateProfileMutation.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
            <h2 className="font-semibold text-gray-900 mb-3">Emergency Contact</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                placeholder="Name"
                value={emergencyContact.name}
                onChange={(e) => { setEmergencyContact((c) => ({ ...c, name: e.target.value })); setEcEdited(true); }}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm"
              />
              <input
                placeholder="Phone"
                value={emergencyContact.phone}
                onChange={(e) => { setEmergencyContact((c) => ({ ...c, phone: e.target.value })); setEcEdited(true); }}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm"
              />
              <input
                placeholder="Relation"
                value={emergencyContact.relation}
                onChange={(e) => { setEmergencyContact((c) => ({ ...c, relation: e.target.value })); setEcEdited(true); }}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <button
              onClick={() => updateEmergencyContactMutation.mutate()}
              disabled={!ecEdited || updateEmergencyContactMutation.isPending}
              className="mt-3 px-4 py-2 bg-primary-500 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
            >
              Save Emergency Contact
            </button>
          </div>

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

          {!isExStaff && (
            <button
              onClick={() => setShowDismiss(true)}
              className="w-full py-3 rounded-xl border border-orange-200 bg-white hover:bg-orange-50 text-left px-4 text-orange-600 flex items-center gap-2.5 text-sm transition-colors"
            >
              <UserX className="w-4 h-4" /> Mark as Left Society
            </button>
          )}

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
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Documents</h2>
            <button
              onClick={() => setShowDocUpload(v => !v)}
              className="flex items-center gap-1.5 text-sm text-primary-500 hover:text-primary-600 font-medium"
            >
              <Plus className="w-4 h-4" /> Upload
            </button>
          </div>

          {showDocUpload && (
            <div className="mb-5 p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Document Type</label>
                <select
                  value={docForm.documentType}
                  onChange={e => setDocForm(f => ({ ...f, documentType: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary-400"
                >
                  {DOCUMENT_TYPES.map(dt => (
                    <option key={dt} value={dt}>{dt.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">File</label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={e => setDocForm(f => ({ ...f, file: e.target.files?.[0] ?? null }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary-400"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDocUpload(false)}
                  className="flex-1 py-2 border border-gray-200 rounded-xl text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={() => uploadDocMutation.mutate()}
                  disabled={!docForm.file || uploadDocMutation.isPending}
                  className="flex-1 py-2 bg-primary-500 text-white rounded-xl text-sm disabled:opacity-50"
                >
                  {uploadDocMutation.isPending ? 'Uploading…' : 'Upload'}
                </button>
              </div>
            </div>
          )}

          {!documents ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : documents.length === 0 ? (
            <p className="text-sm text-gray-400">No documents uploaded yet.</p>
          ) : (
            <div className="space-y-3">
              {documents.map((doc: any, i: number) => (
                <div key={doc.id ?? i} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full font-medium">
                      {(doc.documentType ?? doc.type ?? '').replace('_', ' ')}
                    </span>
                    {doc.verifiedAt && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Verified</span>
                    )}
                    {doc.uploadedAt && (
                      <span className="text-xs text-gray-400">{new Date(doc.uploadedAt).toLocaleDateString('en-IN')}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {(doc.fileUrl ?? doc.url) && (
                      <a
                        href={doc.fileUrl ?? doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary-500 hover:underline"
                      >
                        View
                      </a>
                    )}
                    {doc.id && !doc.verifiedAt && (
                      <button onClick={() => verifyDocMutation.mutate(doc.id)} className="text-xs text-green-600">Verify</button>
                    )}
                    {doc.id && (
                      <button onClick={() => deleteDocMutation.mutate(doc.id)} className="text-xs text-red-600">Delete</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'family' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Family Details</h2>
            <button
              onClick={() => {
                setFamilyMembers(m => [...m, { name: '', relation: '', phone: '' }]);
                setFamilyEdited(true);
              }}
              className="flex items-center gap-1.5 text-sm text-primary-500 hover:text-primary-600 font-medium"
            >
              <Plus className="w-4 h-4" /> Add Member
            </button>
          </div>

          {familyMembers.length === 0 ? (
            <p className="text-sm text-gray-400">No family details added.</p>
          ) : (
            <div className="space-y-4">
              {familyMembers.map((member, i) => (
                <div key={i} className="p-4 border border-gray-100 rounded-xl bg-gray-50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Member {i + 1}</span>
                    <button
                      onClick={() => {
                        setFamilyMembers(m => m.filter((_, idx) => idx !== i));
                        setFamilyEdited(true);
                      }}
                      className="text-red-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Name</label>
                      <input
                        type="text"
                        value={member.name}
                        onChange={e => {
                          setFamilyMembers(m => m.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x));
                          setFamilyEdited(true);
                        }}
                        placeholder="Full name"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary-400"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Relation</label>
                      <input
                        type="text"
                        value={member.relation}
                        onChange={e => {
                          setFamilyMembers(m => m.map((x, idx) => idx === i ? { ...x, relation: e.target.value } : x));
                          setFamilyEdited(true);
                        }}
                        placeholder="e.g. Spouse"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary-400"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Phone</label>
                      <input
                        type="tel"
                        value={member.phone}
                        onChange={e => {
                          setFamilyMembers(m => m.map((x, idx) => idx === i ? { ...x, phone: e.target.value } : x));
                          setFamilyEdited(true);
                        }}
                        placeholder="+91..."
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary-400"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {familyEdited && (
            <button
              onClick={() => updateFamilyMutation.mutate()}
              disabled={updateFamilyMutation.isPending}
              className="mt-4 px-4 py-2 bg-primary-500 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
            >
              {updateFamilyMutation.isPending ? 'Saving…' : 'Save Family Details'}
            </button>
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

      {showDismiss && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowDismiss(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-2">Mark as Left Society?</h2>
            <p className="text-gray-500 mb-4 text-sm">
              This will set today as {staff?.name}&apos;s leaving date and suspend their account. This action marks them as ex-staff.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setShowDismiss(false)}
                className="flex-1 py-2 border border-gray-200 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => dismissMutation.mutate()}
                disabled={dismissMutation.isPending}
                className="flex-1 py-2 bg-orange-500 text-white rounded-xl disabled:opacity-50"
              >
                {dismissMutation.isPending ? 'Processing…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
