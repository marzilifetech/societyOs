'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

type Step = 1 | 2 | 3 | 4 | 5;

export default function NewSocietyPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [step, setStep] = useState<Step>(1);
  const [done, setDone] = useState(false);
  const [result, setResult] = useState<any>(null);

  const [society, setSociety] = useState({
    name: '',
    address: '',
    city: '',
    pincode: '',
    showInDirectory: true,
  });
  const [admin, setAdmin] = useState({ name: '', phone: '', email: '' });
  const [flatsCsv, setFlatsCsv] = useState('');
  const [residentsCsv, setResidentsCsv] = useState('');

  const createMutation = useMutation({
    mutationFn: () =>
      api.post('/admin/societies', {
        ...society,
        adminName: admin.name.trim(),
        adminPhone: admin.phone.trim(),
        adminEmail: admin.email.trim() || undefined,
        flatsCsv: flatsCsv.trim() || undefined,
        residentsCsv: residentsCsv.trim() || undefined,
      }),
    onSuccess: (data) => {
      setResult(data);
      setDone(true);
      toast.success('Society onboarded successfully');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (user?.role !== 'SUPER_ADMIN') {
    return <div className="p-8 text-gray-500">Only super-admins can onboard societies.</div>;
  }

  const readFile = (file: File, setter: (v: string) => void) => {
    const reader = new FileReader();
    reader.onload = () => setter(String(reader.result ?? ''));
    reader.readAsText(file);
  };

  if (done && result) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center">
        <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Society Created</h1>
        <p className="text-gray-500 text-sm mb-4">
          {result.society?.name} is ready. Flats: {result.flats?.created ?? 0} created.
          Residents: {result.residents?.created ?? 0} created.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/societies" className="text-primary-600 font-medium text-sm">All societies</Link>
          <button
            onClick={() => router.push(`/societies/${result.society?.id}`)}
            className="text-primary-600 font-medium text-sm"
          >
            View details →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-2xl">
      <Link href="/societies" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to societies
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-1">Onboard Society</h1>
      <p className="text-gray-500 text-sm mb-6">Step {step} of 5</p>

      {step === 1 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
          <h2 className="font-semibold">Society details</h2>
          {(['name', 'address', 'city', 'pincode'] as const).map((field) => (
            <div key={field}>
              <label className="block text-xs text-gray-500 mb-1 capitalize">{field} *</label>
              <input
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                value={society[field]}
                onChange={(e) => setSociety((p) => ({ ...p, [field]: e.target.value }))}
              />
            </div>
          ))}
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={society.showInDirectory}
              onChange={(e) => setSociety((p) => ({ ...p, showInDirectory: e.target.checked }))}
            />
            Show in resident app directory
          </label>
        </div>
      )}

      {step === 2 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
          <h2 className="font-semibold">Primary admin</h2>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Name *</label>
            <input className="w-full border rounded-xl px-3 py-2 text-sm" value={admin.name} onChange={(e) => setAdmin((p) => ({ ...p, name: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Phone *</label>
            <input className="w-full border rounded-xl px-3 py-2 text-sm" value={admin.phone} onChange={(e) => setAdmin((p) => ({ ...p, phone: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Email</label>
            <input className="w-full border rounded-xl px-3 py-2 text-sm" value={admin.email} onChange={(e) => setAdmin((p) => ({ ...p, email: e.target.value }))} />
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
          <h2 className="font-semibold">Import flats (optional)</h2>
          <p className="text-xs text-gray-500">CSV: block,floor,number,areaSqft</p>
          <input type="file" accept=".csv" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0], setFlatsCsv)} />
          {flatsCsv && <p className="text-xs text-green-600">CSV loaded ({flatsCsv.split('\n').length - 1} rows)</p>}
        </div>
      )}

      {step === 4 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
          <h2 className="font-semibold">Import residents (optional)</h2>
          <p className="text-xs text-gray-500">CSV: name,phone,email,block,flatNumber,type</p>
          <input type="file" accept=".csv" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0], setResidentsCsv)} />
          {residentsCsv && <p className="text-xs text-green-600">CSV loaded</p>}
        </div>
      )}

      {step === 5 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3 text-sm">
          <h2 className="font-semibold">Review</h2>
          <p><span className="text-gray-500">Society:</span> {society.name}, {society.city}</p>
          <p><span className="text-gray-500">Admin:</span> {admin.name} ({admin.phone})</p>
          <p><span className="text-gray-500">Flats CSV:</span> {flatsCsv ? 'Yes' : 'Skipped'}</p>
          <p><span className="text-gray-500">Residents CSV:</span> {residentsCsv ? 'Yes' : 'Skipped'}</p>
        </div>
      )}

      <div className="flex justify-between mt-6">
        <button
          disabled={step === 1}
          onClick={() => setStep((s) => (s - 1) as Step)}
          className="px-4 py-2 text-sm text-gray-600 disabled:opacity-40"
        >
          Back
        </button>
        {step < 5 ? (
          <button
            onClick={() => setStep((s) => (s + 1) as Step)}
            className="inline-flex items-center gap-1 bg-primary-500 text-white px-4 py-2 rounded-xl text-sm font-semibold"
          >
            Next <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !society.name || !admin.name || !admin.phone}
            className="bg-primary-500 text-white px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
          >
            {createMutation.isPending ? 'Creating…' : 'Create Society'}
          </button>
        )}
      </div>
    </div>
  );
}
