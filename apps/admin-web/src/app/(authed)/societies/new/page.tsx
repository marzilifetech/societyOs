'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  ShieldAlert,
  UploadCloud,
  UserCog,
} from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { Button, Card, Field, Input, Textarea } from '@/components/primitives';

type Step = 1 | 2 | 3 | 4 | 5;

const STEPS: { n: Step; label: string; icon: typeof Building2 }[] = [
  { n: 1, label: 'Society', icon: Building2 },
  { n: 2, label: 'Admin', icon: UserCog },
  { n: 3, label: 'Flats', icon: UploadCloud },
  { n: 4, label: 'Residents', icon: UploadCloud },
  { n: 5, label: 'Review', icon: CheckCircle2 },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PINCODE_RE = /^\d{4,8}$/;
const SHORTCODE_RE = /^[A-Za-z0-9-]{2,20}$/;
const PHONE_RE = /^\+?\d[\d\s-]{7,14}$/;

export default function NewSocietyPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [step, setStep] = useState<Step>(1);
  const [done, setDone] = useState(false);
  const [result, setResult] = useState<any>(null);

  const [society, setSociety] = useState({
    name: '',
    shortCode: '',
    address: '',
    city: '',
    pincode: '',
    contactEmail: '',
    contactPhone: '',
    showInDirectory: true,
  });
  const [admin, setAdmin] = useState({ name: '', phone: '', email: '' });
  const [flatsCsv, setFlatsCsv] = useState('');
  const [flatsName, setFlatsName] = useState('');
  const [residentsCsv, setResidentsCsv] = useState('');
  const [residentsName, setResidentsName] = useState('');

  const createMutation = useMutation({
    mutationFn: () =>
      api.post('/admin/societies', {
        name: society.name.trim(),
        address: society.address.trim(),
        city: society.city.trim(),
        pincode: society.pincode.trim(),
        showInDirectory: society.showInDirectory,
        // Optional society fields — omit when blank so the backend's
        // forbidNonWhitelisted validation and the UNIQUE shortCode column
        // aren't handed empty strings.
        contactEmail: society.contactEmail.trim() || undefined,
        contactPhone: society.contactPhone.trim() || undefined,
        shortCode: society.shortCode.trim().toUpperCase() || undefined,
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

  // Per-field validation. Errors only surface for fields the user has touched
  // OR once they try to advance, so the form doesn't shout on first paint.
  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!society.name.trim() || society.name.trim().length < 2)
      e.name = 'Enter the society name (min 2 characters).';
    if (!society.address.trim()) e.address = 'Address is required.';
    if (!society.city.trim()) e.city = 'City is required.';
    if (!PINCODE_RE.test(society.pincode.trim())) e.pincode = 'Pincode must be 4–8 digits.';
    if (society.shortCode.trim() && !SHORTCODE_RE.test(society.shortCode.trim()))
      e.shortCode = '2–20 letters, numbers, or dashes.';
    if (society.contactEmail.trim() && !EMAIL_RE.test(society.contactEmail.trim()))
      e.contactEmail = 'Enter a valid email.';
    if (society.contactPhone.trim() && !PHONE_RE.test(society.contactPhone.trim()))
      e.contactPhone = 'Enter a valid phone number.';
    if (!admin.name.trim() || admin.name.trim().length < 2)
      e.adminName = 'Admin name is required (min 2 characters).';
    if (!PHONE_RE.test(admin.phone.trim())) e.adminPhone = 'Enter a valid admin phone.';
    if (admin.email.trim() && !EMAIL_RE.test(admin.email.trim()))
      e.adminEmail = 'Enter a valid email.';
    return e;
  }, [society, admin]);

  const stepValid = (s: Step): boolean => {
    if (s === 1)
      return (
        !errors.name &&
        !errors.address &&
        !errors.city &&
        !errors.pincode &&
        !errors.shortCode &&
        !errors.contactEmail &&
        !errors.contactPhone
      );
    if (s === 2) return !errors.adminName && !errors.adminPhone && !errors.adminEmail;
    return true; // steps 3 & 4 are optional imports
  };

  const [showErrors, setShowErrors] = useState(false);
  const err = (key: string) => (showErrors ? errors[key] : undefined);

  const goNext = () => {
    if (!stepValid(step)) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    setStep((s) => (s + 1) as Step);
  };
  const goBack = () => {
    setShowErrors(false);
    setStep((s) => (s - 1) as Step);
  };

  const readFile = (file: File, setter: (v: string) => void, nameSetter: (v: string) => void) => {
    const reader = new FileReader();
    reader.onload = () => setter(String(reader.result ?? ''));
    reader.readAsText(file);
    nameSetter(file.name);
  };

  if (user?.role !== 'SUPER_ADMIN') {
    return (
      <div className="p-8">
        <Card>
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-gray-950">Restricted</h2>
              <p className="text-[13px] text-gray-500 mt-0.5">
                Only super-admins can onboard societies.
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (done && result) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center">
        <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Society Created</h1>
        <p className="text-gray-500 text-sm mb-1">
          <span className="font-medium text-gray-800">{result.society?.name}</span> is ready.
        </p>
        <p className="text-gray-500 text-sm mb-6">
          {result.flats?.created ?? 0} flats · {result.residents?.created ?? 0} residents · admin{' '}
          {result.admin?.name}
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/societies">
            <Button variant="secondary">All societies</Button>
          </Link>
          <Button onClick={() => router.push(`/societies/${result.society?.id}`)}>
            View details
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-2xl">
      <Link
        href="/societies"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Back to societies
      </Link>

      <p className="text-[12px] font-medium text-gray-500 tracking-wide uppercase">Platform</p>
      <h1 className="text-[28px] font-semibold tracking-tight text-gray-950 mt-1">
        Onboard a society
      </h1>
      <p className="text-[14px] text-gray-500 mt-1 mb-6">
        Create the tenant, its first admin, and (optionally) import flats &amp; residents.
      </p>

      {/* Stepper */}
      <div className="flex items-center gap-1 mb-6 overflow-x-auto">
        {STEPS.map((s, i) => {
          const active = s.n === step;
          const complete = s.n < step;
          return (
            <div key={s.n} className="flex items-center gap-1 shrink-0">
              <div
                className={
                  'flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-[13px] font-medium ' +
                  (active
                    ? 'bg-gray-950 text-white'
                    : complete
                      ? 'bg-gray-100 text-gray-900'
                      : 'text-gray-400')
                }
              >
                {complete ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <s.icon className="w-3.5 h-3.5" />
                )}
                {s.label}
              </div>
              {i < STEPS.length - 1 && <span className="w-4 h-px bg-gray-200" />}
            </div>
          );
        })}
      </div>

      <Card>
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="font-semibold text-gray-950">Society details</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Field label="Society name" required error={err('name')}>
                  <Input
                    value={society.name}
                    invalid={!!err('name')}
                    placeholder="e.g. Prestige Lakeside Habitat"
                    onChange={(e) => setSociety((p) => ({ ...p, name: e.target.value }))}
                  />
                </Field>
              </div>
              <Field
                label="Join / short code"
                hint="Optional. Unique code residents can use to find the society."
                error={err('shortCode')}
              >
                <Input
                  value={society.shortCode}
                  invalid={!!err('shortCode')}
                  placeholder="e.g. MZ-PLH1"
                  onChange={(e) => setSociety((p) => ({ ...p, shortCode: e.target.value }))}
                />
              </Field>
              <Field label="Pincode" required error={err('pincode')}>
                <Input
                  value={society.pincode}
                  invalid={!!err('pincode')}
                  inputMode="numeric"
                  placeholder="560103"
                  onChange={(e) => setSociety((p) => ({ ...p, pincode: e.target.value }))}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Address" required error={err('address')}>
                  <Textarea
                    value={society.address}
                    invalid={!!err('address')}
                    rows={2}
                    placeholder="Street, area, landmark"
                    onChange={(e) => setSociety((p) => ({ ...p, address: e.target.value }))}
                  />
                </Field>
              </div>
              <Field label="City" required error={err('city')}>
                <Input
                  value={society.city}
                  invalid={!!err('city')}
                  placeholder="Bengaluru"
                  onChange={(e) => setSociety((p) => ({ ...p, city: e.target.value }))}
                />
              </Field>
              <Field
                label="Contact phone"
                hint="Shown to residents"
                error={err('contactPhone')}
              >
                <Input
                  value={society.contactPhone}
                  invalid={!!err('contactPhone')}
                  inputMode="tel"
                  placeholder="+91 98765 43210"
                  onChange={(e) => setSociety((p) => ({ ...p, contactPhone: e.target.value }))}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Contact email" hint="Shown to residents" error={err('contactEmail')}>
                  <Input
                    value={society.contactEmail}
                    invalid={!!err('contactEmail')}
                    inputMode="email"
                    placeholder="office@society.in"
                    onChange={(e) => setSociety((p) => ({ ...p, contactEmail: e.target.value }))}
                  />
                </Field>
              </div>
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-gray-800 pt-1 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-gray-300"
                checked={society.showInDirectory}
                onChange={(e) =>
                  setSociety((p) => ({ ...p, showInDirectory: e.target.checked }))
                }
              />
              Show in the resident-app pre-login directory
            </label>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="font-semibold text-gray-950">Primary admin</h2>
            <p className="text-[13px] text-gray-500 -mt-2">
              This person gets an ADMIN account in the new society and can log in immediately.
            </p>
            <Field label="Admin name" required error={err('adminName')}>
              <Input
                value={admin.name}
                invalid={!!err('adminName')}
                placeholder="Full name"
                onChange={(e) => setAdmin((p) => ({ ...p, name: e.target.value }))}
              />
            </Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Admin phone" required error={err('adminPhone')}>
                <Input
                  value={admin.phone}
                  invalid={!!err('adminPhone')}
                  inputMode="tel"
                  placeholder="+91 98765 43210"
                  onChange={(e) => setAdmin((p) => ({ ...p, phone: e.target.value }))}
                />
              </Field>
              <Field label="Admin email" hint="Optional" error={err('adminEmail')}>
                <Input
                  value={admin.email}
                  invalid={!!err('adminEmail')}
                  inputMode="email"
                  placeholder="admin@society.in"
                  onChange={(e) => setAdmin((p) => ({ ...p, email: e.target.value }))}
                />
              </Field>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <h2 className="font-semibold text-gray-950">Import flats (optional)</h2>
            <p className="text-[13px] text-gray-500">
              CSV columns: <code className="text-gray-700">block,floor,number,areaSqft</code>. You
              can also skip this and add flats later.
            </p>
            <label className="flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-xl px-4 py-6 text-sm text-gray-500 cursor-pointer hover:border-gray-400 hover:bg-gray-50">
              <UploadCloud className="w-4 h-4" />
              {flatsName || 'Choose a CSV file'}
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) =>
                  e.target.files?.[0] &&
                  readFile(e.target.files[0], setFlatsCsv, setFlatsName)
                }
              />
            </label>
            {flatsCsv && (
              <p className="text-[13px] text-green-600">
                Loaded {flatsName} · {Math.max(0, flatsCsv.trim().split('\n').length - 1)} rows
              </p>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <h2 className="font-semibold text-gray-950">Import residents (optional)</h2>
            <p className="text-[13px] text-gray-500">
              CSV columns:{' '}
              <code className="text-gray-700">name,phone,email,block,flatNumber,type</code>.
            </p>
            <label className="flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-xl px-4 py-6 text-sm text-gray-500 cursor-pointer hover:border-gray-400 hover:bg-gray-50">
              <UploadCloud className="w-4 h-4" />
              {residentsName || 'Choose a CSV file'}
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) =>
                  e.target.files?.[0] &&
                  readFile(e.target.files[0], setResidentsCsv, setResidentsName)
                }
              />
            </label>
            {residentsCsv && (
              <p className="text-[13px] text-green-600">
                Loaded {residentsName} ·{' '}
                {Math.max(0, residentsCsv.trim().split('\n').length - 1)} rows
              </p>
            )}
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4 text-sm">
            <h2 className="font-semibold text-gray-950">Review &amp; create</h2>
            <dl className="divide-y divide-gray-100">
              {[
                ['Society', `${society.name}`],
                ['Short code', society.shortCode.trim().toUpperCase() || '—'],
                ['Address', `${society.address}, ${society.city} ${society.pincode}`],
                [
                  'Contact',
                  [society.contactPhone.trim(), society.contactEmail.trim()]
                    .filter(Boolean)
                    .join(' · ') || '—',
                ],
                ['Directory', society.showInDirectory ? 'Visible' : 'Hidden'],
                ['Admin', `${admin.name} · ${admin.phone}${admin.email ? ` · ${admin.email}` : ''}`],
                ['Flats CSV', flatsCsv ? `${flatsName}` : 'Skipped'],
                ['Residents CSV', residentsCsv ? `${residentsName}` : 'Skipped'],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-4 py-2">
                  <dt className="w-28 shrink-0 text-gray-500">{k}</dt>
                  <dd className="text-gray-900 break-words">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </Card>

      <div className="flex justify-between mt-6">
        <Button variant="ghost" onClick={goBack} disabled={step === 1}>
          Back
        </Button>
        {step < 5 ? (
          <Button onClick={goNext} trailingIcon={<ArrowRight className="w-4 h-4" />}>
            Next
          </Button>
        ) : (
          <Button
            onClick={() => {
              // Final guard — both required steps must be valid before we POST.
              if (!stepValid(1) || !stepValid(2)) {
                setShowErrors(true);
                setStep(!stepValid(1) ? 1 : 2);
                toast.error('Please fix the highlighted fields.');
                return;
              }
              createMutation.mutate();
            }}
            loading={createMutation.isPending}
          >
            Create society
          </Button>
        )}
      </div>
    </div>
  );
}
