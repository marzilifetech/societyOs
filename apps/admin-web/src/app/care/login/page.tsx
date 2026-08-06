'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, HeartPulse, Search, Building2, Check } from 'lucide-react';
import { careApi } from '@/lib/care-api';
import { useCareAuth } from '@/store/care-auth.store';
import { isVerifyOtpTotpChallenge, type VerifyOtpPayload } from '@societyos/api-client';
import { Button, Field } from '@/components/primitives';

type Step = 'society' | 'phone' | 'otp';
type SocietyOption = { id: string; name: string; city?: string };

const FALLBACK_SOCIETY_ID = process.env.NEXT_PUBLIC_SOCIETY_ID ?? '';

function CareLoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const sessionExpired = params.get('reason') === 'session-expired';
  const setAuth = useCareAuth((s) => s.setAuth);

  const [step, setStep] = useState<Step>('society');
  const [societies, setSocieties] = useState<SocietyOption[]>([]);
  const [societiesLoading, setSocietiesLoading] = useState(true);
  const [societySearch, setSocietySearch] = useState('');
  const [society, setSociety] = useState<SocietyOption | null>(null);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resend, setResend] = useState(0);

  // Clear any stale resident session on landing.
  useEffect(() => {
    try {
      localStorage.removeItem('care_token');
      localStorage.removeItem('care_refresh_token');
      localStorage.removeItem('care-auth');
    } catch {
      /* private mode — non-fatal */
    }
  }, []);

  // Load the public society directory for the picker.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await careApi.get<SocietyOption[]>('/societies');
        if (!alive) return;
        setSocieties(Array.isArray(list) ? list : []);
      } catch {
        // Directory unavailable — fall back to a single configured society.
        if (alive && FALLBACK_SOCIETY_ID) {
          setSocieties([{ id: FALLBACK_SOCIETY_ID, name: 'My society' }]);
        }
      } finally {
        if (alive) setSocietiesLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (step !== 'otp' || resend <= 0) return;
    const t = setTimeout(() => setResend((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [step, resend]);

  const filteredSocieties = societies.filter((s) =>
    `${s.name} ${s.city ?? ''}`.toLowerCase().includes(societySearch.trim().toLowerCase()),
  );

  const sendOtp = async () => {
    if (!society) return;
    setError('');
    setLoading(true);
    try {
      await careApi.post('/auth/send-otp', { phone: `+91${phone}`, societyId: society.id });
      setStep('otp');
      setResend(30);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!society) return;
    setError('');
    setLoading(true);
    try {
      const res = await careApi.post<VerifyOtpPayload>('/auth/verify-otp', {
        phone: `+91${phone}`,
        otp,
        societyId: society.id,
      });
      if (isVerifyOtpTotpChallenge(res)) {
        setError('This number needs 2-factor sign-in, which isn’t available here.');
        return;
      }
      setAuth(res.accessToken, res.refreshToken, {
        id: res.user.id,
        name: res.user.name ?? '',
        phone: res.user.phone,
        role: res.user.role,
        status: res.user.status,
        societyId: res.user.societyId ?? society.id,
        societyName: society.name,
      });
      router.replace('/care');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-primary-700 to-primary-800 text-white">
      <div className="px-6 pt-14 pb-8">
        <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center mb-4">
          <HeartPulse className="w-6 h-6" />
        </div>
        <h1 className="text-[26px] font-semibold tracking-tight leading-tight">Marzi Care</h1>
        <p className="text-[14px] text-white/75 mt-1">
          Doctors, appointments, health & emergencies — for your community.
        </p>
      </div>

      <div className="flex-1 bg-gray-50 text-gray-900 rounded-t-3xl px-5 pt-6 pb-10">
        {sessionExpired && (
          <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200">
            <p className="text-[13px] text-amber-900">Your session ended. Please sign in again.</p>
          </div>
        )}

        {step === 'society' && (
          <div>
            <h2 className="text-[20px] font-semibold tracking-tight">Find your society</h2>
            <p className="text-[13px] text-gray-500 mt-1 mb-4">Select the community you live in.</p>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={societySearch}
                onChange={(e) => setSocietySearch(e.target.value)}
                placeholder="Search by name or city"
                className="w-full h-11 pl-9 pr-3 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-100"
              />
            </div>
            {societiesLoading ? (
              <p className="text-[13px] text-gray-500 py-8 text-center">Loading societies…</p>
            ) : filteredSocieties.length === 0 ? (
              <p className="text-[13px] text-gray-500 py-8 text-center">
                No societies available yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {filteredSocieties.map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => {
                        setSociety(s);
                        setStep('phone');
                        setError('');
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-200 hover:border-primary-300 active:bg-gray-50 transition-colors text-left"
                    >
                      <div className="w-9 h-9 rounded-lg bg-primary-50 text-primary-700 flex items-center justify-center shrink-0">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[14px] font-medium text-gray-950 truncate">{s.name}</p>
                        {s.city && <p className="text-[12px] text-gray-500 truncate">{s.city}</p>}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {step === 'phone' && society && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendOtp();
            }}
          >
            <button
              type="button"
              onClick={() => {
                setStep('society');
                setError('');
              }}
              className="inline-flex items-center gap-1.5 text-[13px] text-gray-500 mb-4"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> {society.name}
            </button>
            <h2 className="text-[20px] font-semibold tracking-tight">Enter your mobile number</h2>
            <p className="text-[13px] text-gray-500 mt-1 mb-4">
              We’ll send a one-time code to verify it’s you.
            </p>
            <Field label="Mobile number" required error={error || undefined}>
              <div className="flex h-12 rounded-xl border border-gray-200 bg-white focus-within:border-primary-500 focus-within:ring-4 focus-within:ring-primary-100 overflow-hidden">
                <span className="px-3 flex items-center text-[14px] font-medium text-gray-500 bg-gray-50 border-r border-gray-200">
                  +91
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="10-digit number"
                  className="flex-1 px-3 text-[15px] text-gray-900 outline-none"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  autoFocus
                />
              </div>
            </Field>
            <Button
              type="submit"
              fullWidth
              loading={loading}
              disabled={phone.length !== 10}
              trailingIcon={!loading ? <ArrowRight className="w-4 h-4" /> : undefined}
              className="mt-5 h-12 rounded-xl"
            >
              {loading ? 'Sending…' : 'Send code'}
            </Button>
          </form>
        )}

        {step === 'otp' && society && (
          <form onSubmit={verify}>
            <button
              type="button"
              onClick={() => {
                setStep('phone');
                setOtp('');
                setError('');
              }}
              className="inline-flex items-center gap-1.5 text-[13px] text-gray-500 mb-4"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Change number
            </button>
            <h2 className="text-[20px] font-semibold tracking-tight">Enter the code</h2>
            <p className="text-[13px] text-gray-500 mt-1 mb-4">
              Sent to +91 {phone.slice(0, 5)} {phone.slice(5)}.
            </p>
            <Field label="One-time code" required error={error || undefined}>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="••••"
                maxLength={6}
                className="w-full h-14 text-center text-[26px] font-semibold tracking-[0.4em] rounded-xl border border-gray-200 bg-white outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-100"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                autoFocus
              />
            </Field>
            <div className="flex items-center justify-between text-[12px] mt-2">
              <span className="text-gray-500">Didn’t get it?</span>
              {resend > 0 ? (
                <span className="text-gray-400">Resend in {resend}s</span>
              ) : (
                <button
                  type="button"
                  onClick={sendOtp}
                  disabled={loading}
                  className="text-primary-700 font-medium disabled:opacity-40"
                >
                  Resend code
                </button>
              )}
            </div>
            <Button
              type="submit"
              fullWidth
              loading={loading}
              disabled={otp.length < 4}
              trailingIcon={!loading ? <Check className="w-4 h-4" /> : undefined}
              className="mt-5 h-12 rounded-xl"
            >
              {loading ? 'Verifying…' : 'Verify & continue'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function CareLoginPage() {
  return (
    <Suspense fallback={null}>
      <CareLoginInner />
    </Suspense>
  );
}
