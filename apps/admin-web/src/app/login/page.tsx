'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import {
  unwrapApiEnvelope,
  isVerifyOtpTotpChallenge,
  type AdminVerifyOtpPayload,
} from '@societyos/api-client';

type Step = 'phone' | 'otp' | '2fa';

/** Same society as configured for this admin deployment (matches SendOtpDto). */
const SOCIETY_ID = process.env.NEXT_PUBLIC_SOCIETY_ID ?? '';

type PendingAdminTotp = {
  phoneE164: string;
  otp: string;
  societyId: string;
};

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

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!SOCIETY_ID) {
      setError('Set NEXT_PUBLIC_SOCIETY_ID in .env.local (society UUID).');
      return;
    }
    setLoading(true);
    try {
      await api.post<object>('/auth/send-otp', { phone: `+91${phone}`, societyId: SOCIETY_ID });
      setStep('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!SOCIETY_ID) {
      setError('Set NEXT_PUBLIC_SOCIETY_ID in .env.local.');
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
        setTotpPending({
          phoneE164: `+91${phone}`,
          otp,
          societyId: SOCIETY_ID,
        });
        setStep('2fa');
        return;
      }

      if (res.user.role !== 'ADMIN' && res.user.role !== 'SUPER_ADMIN') {
        throw new Error('Access denied. Admin account required.');
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
      if (!totpPending) {
        throw new Error('Session expired. Sign in again.');
      }
      const raw = await api.post<object>('/auth/verify-otp', {
        phone: totpPending.phoneE164,
        otp: totpPending.otp,
        societyId: totpPending.societyId,
        totpCode: twoFactorCode,
      });
      const res = unwrapApiEnvelope<AdminVerifyOtpPayload>(raw);

      if (isVerifyOtpTotpChallenge(res)) {
        setError('Invalid authenticator code.');
        return;
      }

      if (res.user.role !== 'ADMIN' && res.user.role !== 'SUPER_ADMIN') {
        throw new Error('Access denied. Admin account required.');
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
      setError(err instanceof Error ? err.message : 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-primary-500 flex items-center justify-center px-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-8">
        {sessionExpired && (
          <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm text-center">
            Your session ended automatically for security. Please sign in again to continue.
          </div>
        )}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">SocietyOS Admin</h1>
          <p className="text-gray-500 text-sm mt-1">
            {step === 'phone' ? 'Sign in to your admin account' : `OTP sent to +91 ${phone}`}
          </p>
        </div>

        {step === '2fa' ? (
          <form onSubmit={handle2fa} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">
                Two-Factor Code
              </label>
              <input
                type="text"
                inputMode="numeric"
                aria-label="Two-factor authentication code"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-center text-2xl font-bold tracking-widest outline-none focus:border-primary-500"
                placeholder="——————"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                required
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-2">
                Enter the 6-digit code from your authenticator app.
              </p>
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={twoFactorCode.length !== 6 || loading}
              className="w-full bg-primary-500 text-white rounded-xl py-3 font-semibold disabled:opacity-40 hover:bg-primary-600 transition-colors"
            >
              {loading ? 'Verifying…' : 'Verify & Sign In'}
            </button>
            <button
              type="button"
              className="w-full text-gray-500 text-sm py-2 inline-flex items-center justify-center gap-1.5 hover:text-gray-700"
              onClick={() => { setStep('otp'); setTwoFactorCode(''); setTotpPending(null); setError(''); }}
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          </form>
        ) : step === 'phone' ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">
                Mobile Number
              </label>
              <div className="flex rounded-xl border border-gray-200 overflow-hidden">
                <span className="bg-gray-50 px-4 py-3 text-gray-500 font-medium border-r border-gray-200">
                  +91
                </span>
                <input
                  type="tel"
                  className="flex-1 px-4 py-3 text-base outline-none"
                  placeholder="10-digit number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  required
                />
              </div>
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={phone.length !== 10 || loading}
              className="w-full bg-primary-500 text-white rounded-xl py-3 font-semibold disabled:opacity-40 hover:bg-primary-600 transition-colors"
            >
              {loading ? 'Sending…' : 'Get OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">
                Enter 4-digit OTP
              </label>
              <input
                type="text"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-center text-2xl font-bold tracking-widest outline-none focus:border-primary-500"
                placeholder="————"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
                maxLength={4}
                required
              />
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={otp.length !== 4 || loading}
              className="w-full bg-primary-500 text-white rounded-xl py-3 font-semibold disabled:opacity-40 hover:bg-primary-600 transition-colors"
            >
              {loading ? 'Verifying…' : 'Sign In'}
            </button>

            <button
              type="button"
              className="w-full text-gray-500 text-sm py-2 inline-flex items-center justify-center gap-1.5 hover:text-gray-700"
              onClick={() => { setStep('phone'); setOtp(''); setError(''); }}
            >
              <ArrowLeft className="w-4 h-4" /> Change number
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// Next.js 15 requires useSearchParams() to sit inside a Suspense boundary
// so the rest of the page can still be prerendered at build time.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}
