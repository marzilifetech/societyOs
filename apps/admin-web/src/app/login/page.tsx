'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  ShieldCheck,
  Headphones,
  Layers,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import {
  unwrapApiEnvelope,
  isVerifyOtpTotpChallenge,
  type AdminVerifyOtpPayload,
} from '@societyos/api-client';
import { Button, Field, Input } from '@/components/primitives';

type Step = 'phone' | 'otp' | '2fa';

const SOCIETY_ID = process.env.NEXT_PUBLIC_SOCIETY_ID ?? '';

type PendingAdminTotp = {
  phoneE164: string;
  otp: string;
  societyId: string;
};

const STEP_ORDER: Step[] = ['phone', 'otp', '2fa'];

const VALUE_PROPS: Array<{ icon: React.ComponentType<{ className?: string }>; title: string; body: string }> = [
  {
    icon: Building2,
    title: 'Multi-society admin',
    body: 'Switch between communities, suspend, archive — all from one console.',
  },
  {
    icon: ShieldCheck,
    title: 'Compliance built-in',
    body: 'DPDP-ready audit trail, OTP via Marzi, role-scoped access.',
  },
  {
    icon: Headphones,
    title: 'Resident care, faster',
    body: 'Real-time SOS, complaints, and service requests in one queue.',
  },
];

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionExpired = searchParams.get('reason') === 'session-expired';
  const setAuth = useAuthStore((s) => s.setAuth);

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [totpPending, setTotpPending] = useState<PendingAdminTotp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);

  // Resend cooldown — 30s after OTP request, decrements once per second.
  useEffect(() => {
    if (step !== 'otp' || resendCountdown <= 0) return;
    const t = setTimeout(() => setResendCountdown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [step, resendCountdown]);

  // Wipe any stale auth artefacts when the user lands on /login. Belt-and-
  // braces with the api-client's auth-route filter: even if some legacy
  // code path leaks credentials, this ensures a fresh-start state.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_selected_society_id');
      localStorage.removeItem('auth-storage');
      sessionStorage.removeItem('admin_reauth_token');
    } catch {
      /* private mode or quota — non-fatal */
    }
  }, []);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!SOCIETY_ID) {
      setError('NEXT_PUBLIC_SOCIETY_ID is not set. Check the admin-web .env.local.');
      return;
    }
    setLoading(true);
    try {
      await api.post<object>('/auth/send-otp', { phone: `+91${phone}`, societyId: SOCIETY_ID });
      setStep('otp');
      setResendCountdown(30);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCountdown > 0 || loading) return;
    setError('');
    setLoading(true);
    try {
      await api.post<object>('/auth/send-otp', { phone: `+91${phone}`, societyId: SOCIETY_ID });
      setResendCountdown(30);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!SOCIETY_ID) {
      setError('NEXT_PUBLIC_SOCIETY_ID is not set.');
      return;
    }
    setLoading(true);
    try {
      const raw = await api.post<object>('/auth/verify-otp', {
        phone: `+91${phone}`,
        otp,
        societyId: SOCIETY_ID,
      });
      const res = unwrapApiEnvelope<AdminVerifyOtpPayload>(raw);

      if (isVerifyOtpTotpChallenge(res)) {
        setTotpPending({ phoneE164: `+91${phone}`, otp, societyId: SOCIETY_ID });
        setStep('2fa');
        return;
      }

      if (res.user.role !== 'ADMIN' && res.user.role !== 'SUPER_ADMIN') {
        throw new Error('Access denied — this console is for society admins only.');
      }

      setAuth(res.accessToken, {
        id: res.user.id,
        name: res.user.name ?? '',
        phone: res.user.phone,
        role: res.user.role,
        societyId: res.user.societyId ?? SOCIETY_ID,
      });
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  const handle2fa = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (!totpPending) throw new Error('Session expired. Sign in again.');
      const raw = await api.post<object>('/auth/verify-otp', {
        phone: totpPending.phoneE164,
        otp: totpPending.otp,
        societyId: totpPending.societyId,
        totpCode: twoFactorCode,
      });
      const res = unwrapApiEnvelope<AdminVerifyOtpPayload>(raw);

      if (isVerifyOtpTotpChallenge(res)) {
        setError('Invalid authenticator code. Try again.');
        return;
      }
      if (res.user.role !== 'ADMIN' && res.user.role !== 'SUPER_ADMIN') {
        throw new Error('Access denied — this console is for society admins only.');
      }
      setAuth(res.accessToken, {
        id: res.user.id,
        name: res.user.name ?? '',
        phone: res.user.phone,
        role: res.user.role,
        societyId: res.user.societyId ?? totpPending.societyId,
      });
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code.');
    } finally {
      setLoading(false);
    }
  };

  const stepIndex = STEP_ORDER.indexOf(step);

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Brand panel — hidden on small screens. Solid magenta with a subtle
          diagonal pattern overlay; intentionally low-key so the form is the
          centre of attention. */}
      <aside className="hidden lg:flex relative w-[42%] xl:w-[44%] bg-primary-700 text-white overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />
        <div className="relative flex flex-col justify-between p-12 xl:p-16 w-full">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <span className="text-[15px] font-semibold tracking-tight">SocietyOS</span>
          </div>

          <div className="max-w-md">
            <h1 className="text-[42px] xl:text-[48px] leading-[1.05] font-semibold tracking-tight">
              The control room for your community.
            </h1>
            <p className="mt-5 text-[15px] text-white/75 leading-relaxed">
              Operate every society you manage from one calm dashboard —
              residents, staff, billing, and emergencies, all in one place.
            </p>
          </div>

          <ul className="space-y-5 max-w-md">
            {VALUE_PROPS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-3.5">
                <div className="shrink-0 w-9 h-9 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center">
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[14px] font-medium">{title}</p>
                  <p className="text-[13px] text-white/70 mt-0.5 leading-relaxed">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Form panel */}
      <main className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-[400px]">
          {/* Compact mobile-only brand mark */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg bg-primary-700 text-white flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <span className="text-[14px] font-semibold tracking-tight text-gray-950">SocietyOS</span>
          </div>

          {sessionExpired && (
            <div className="mb-6 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <p className="text-[13px] text-amber-900 leading-snug">
                Your session ended automatically. Sign in again to continue.
              </p>
            </div>
          )}

          {/* Step indicator — three dots, current is filled */}
          <div className="flex items-center gap-2 mb-6" aria-label={`Step ${stepIndex + 1} of 3`}>
            {STEP_ORDER.map((s, i) => (
              <span
                key={s}
                className={
                  'h-1 rounded-full transition-all ' +
                  (i === stepIndex
                    ? 'w-8 bg-primary-700'
                    : i < stepIndex
                      ? 'w-8 bg-primary-200'
                      : 'w-4 bg-gray-200')
                }
              />
            ))}
            <span className="ml-auto text-[12px] text-gray-500 font-medium">
              {stepIndex + 1} of 3
            </span>
          </div>

          {step === 'phone' && (
            <PhoneStep
              phone={phone}
              setPhone={setPhone}
              loading={loading}
              error={error}
              onSubmit={handleSendOtp}
            />
          )}

          {step === 'otp' && (
            <OtpStep
              phone={phone}
              otp={otp}
              setOtp={setOtp}
              loading={loading}
              error={error}
              resendCountdown={resendCountdown}
              onSubmit={handleVerify}
              onResend={handleResend}
              onBack={() => {
                setStep('phone');
                setOtp('');
                setError('');
              }}
            />
          )}

          {step === '2fa' && (
            <TotpStep
              code={twoFactorCode}
              setCode={setTwoFactorCode}
              loading={loading}
              error={error}
              onSubmit={handle2fa}
              onBack={() => {
                setStep('otp');
                setTwoFactorCode('');
                setTotpPending(null);
                setError('');
              }}
            />
          )}

          <p className="text-[12px] text-gray-500 mt-8 text-center">
            Trouble signing in? Reach the platform team at{' '}
            <a className="text-gray-700 underline" href="mailto:platform@marzitech.in">
              platform@marzitech.in
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Step components — kept inline rather than separate files because the login
// page is the only consumer and the steps share visual identity.
// ──────────────────────────────────────────────────────────────────────────────

function StepHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-[24px] font-semibold tracking-tight text-gray-950 leading-tight">{title}</h2>
      <p className="text-[14px] text-gray-500 mt-1.5 leading-relaxed">{subtitle}</p>
    </div>
  );
}

function PhoneStep({
  phone,
  setPhone,
  loading,
  error,
  onSubmit,
}: {
  phone: string;
  setPhone: (v: string) => void;
  loading: boolean;
  error: string;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <StepHeader
        title="Sign in"
        subtitle="Enter your registered mobile number. We'll send you a one-time code."
      />

      <Field label="Mobile number" required error={error || undefined}>
        <div className="flex h-9 rounded-lg border border-gray-300 bg-white focus-within:border-gray-900 focus-within:ring-4 focus-within:ring-gray-200 transition-colors overflow-hidden">
          <span className="px-3 flex items-center text-[13px] font-medium text-gray-500 bg-gray-50 border-r border-gray-300">
            +91
          </span>
          <input
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="10-digit number"
            className="flex-1 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            autoFocus
          />
        </div>
      </Field>

      <Button
        type="submit"
        fullWidth
        size="md"
        loading={loading}
        disabled={phone.length !== 10}
        trailingIcon={!loading ? <ArrowRight className="w-4 h-4" /> : undefined}
      >
        {loading ? 'Sending OTP…' : 'Continue'}
      </Button>
    </form>
  );
}

function OtpStep({
  phone,
  otp,
  setOtp,
  loading,
  error,
  resendCountdown,
  onSubmit,
  onResend,
  onBack,
}: {
  phone: string;
  otp: string;
  setOtp: (v: string) => void;
  loading: boolean;
  error: string;
  resendCountdown: number;
  onSubmit: (e: React.FormEvent) => void;
  onResend: () => void;
  onBack: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-gray-900 transition-colors mb-1"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Change number
      </button>

      <StepHeader
        title="Enter the code"
        subtitle={`A 4-digit OTP was sent to +91 ${phone.slice(0, 5)} ${phone.slice(5)}.`}
      />

      <Field label="One-time code" required error={error || undefined}>
        <div className="relative">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="••••"
            maxLength={4}
            className="w-full h-14 text-center text-[28px] font-semibold tracking-[0.4em] rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-300 outline-none focus:border-gray-900 focus:ring-4 focus:ring-gray-200 transition-colors"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
            autoFocus
          />
        </div>
      </Field>

      <div className="flex items-center justify-between text-[12px]">
        <span className="text-gray-500">Didn't receive it?</span>
        {resendCountdown > 0 ? (
          <span className="text-gray-400">Resend in {resendCountdown}s</span>
        ) : (
          <button
            type="button"
            onClick={onResend}
            disabled={loading}
            className="text-gray-900 font-medium hover:underline disabled:opacity-40"
          >
            Resend OTP
          </button>
        )}
      </div>

      <Button
        type="submit"
        fullWidth
        size="md"
        loading={loading}
        disabled={otp.length !== 4}
        trailingIcon={!loading ? <ArrowRight className="w-4 h-4" /> : undefined}
      >
        {loading ? 'Verifying…' : 'Verify & sign in'}
      </Button>
    </form>
  );
}

function TotpStep({
  code,
  setCode,
  loading,
  error,
  onSubmit,
  onBack,
}: {
  code: string;
  setCode: (v: string) => void;
  loading: boolean;
  error: string;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-gray-900 transition-colors mb-1"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back
      </button>

      <StepHeader
        title="Two-factor code"
        subtitle="Enter the 6-digit code from your authenticator app."
      />

      <Field label="Authenticator code" required error={error || undefined}>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="••••••"
          maxLength={6}
          className="w-full h-14 text-center text-[28px] font-semibold tracking-[0.4em] rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-300 outline-none focus:border-gray-900 focus:ring-4 focus:ring-gray-200 transition-colors"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          autoFocus
        />
      </Field>

      <Button
        type="submit"
        fullWidth
        size="md"
        loading={loading}
        disabled={code.length !== 6}
        trailingIcon={!loading ? <ShieldCheck className="w-4 h-4" /> : undefined}
      >
        {loading ? 'Verifying…' : 'Verify & sign in'}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}
