'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Building2, ChevronDown, Check, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { StatusPill, Modal, Button, Input, Field } from '@/components/primitives';

type SocietyRow = {
  id: string;
  name: string;
  city: string;
  status?: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
};

type MeResponse = { id: string; totpEnabled?: boolean };
type ReauthResponse = { reauthToken: string; expiresInSeconds: number };

/**
 * Backend's REAUTH_FRESH_WINDOW_SECONDS — must match. Within this window
 * after the JWT was minted, tenant switches are allowed without an
 * explicit reauth token (Marzi OTP just happened, so the JWT is itself
 * proof of recent strong auth). Beyond it, we open the reauth modal.
 */
const FRESH_LOGIN_WINDOW_SECONDS = 300;

function readBearerIat(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const token = localStorage.getItem('admin_token');
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload?.iat === 'number' ? payload.iat : null;
  } catch {
    return null;
  }
}

/**
 * SocietySwitcher
 *
 * Lets SUPER_ADMIN re-target every subsequent API call at a different society
 * (via the `X-Society-Id` header set in `api.ts`). We deliberately use a hard
 * reload after a switch — every page caches per-society lists in React Query
 * and partial invalidation across 30+ query keys is more fragile than a full
 * remount. The brief flash is the cost of correctness.
 *
 * C1: every tenant switch now goes through a re-auth modal. The user
 * confirms identity via TOTP (if enabled) or a fresh OTP, the backend
 * issues a one-shot `X-ReAuth-Token`, we stash it in sessionStorage, and
 * the next request consumes it. Replacing the previous trivially-spoofed
 * `X-ReAuth-Confirmed: 1` boolean header.
 */
export function SocietySwitcher() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [selectedId, setSelectedId] = useState(user?.societyId ?? '');
  const [open, setOpen] = useState(false);
  // C1 reauth modal state
  const [pendingTarget, setPendingTarget] = useState<SocietyRow | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [otpCode, setOtpCode] = useState('');

  useEffect(() => {
    const stored = typeof window === 'undefined'
      ? null
      : localStorage.getItem('admin_selected_society_id');
    setSelectedId(stored ?? user?.societyId ?? '');
  }, [user?.societyId]);

  const { data: societies = [] } = useQuery({
    queryKey: ['admin-societies', 'switcher'],
    // Include archived & suspended so a super-admin can still reach them.
    queryFn: () => api.get<SocietyRow[]>('/admin/societies?includeArchived=true'),
    enabled: isSuperAdmin,
    staleTime: 60_000,
  });

  // Used by the reauth modal to decide which input to show (TOTP vs OTP).
  const { data: me } = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => api.get<MeResponse>('/auth/me'),
    enabled: isSuperAdmin,
    staleTime: 5 * 60_000,
  });

  const reauthMutation = useMutation({
    mutationFn: (creds: { totpCode?: string; otp?: string }) =>
      api.post<ReauthResponse>('/auth/reauth', creds),
    onSuccess: (res) => {
      if (!pendingTarget) return;
      // Stash the token + selection together. Tenant middleware will consume
      // the token on the very first request after reload (api.ts reads it
      // from sessionStorage on every outbound request).
      try {
        sessionStorage.setItem('admin_reauth_token', res.reauthToken);
      } catch {
        // sessionStorage can throw in private mode; fall through and let
        // the next request 400 with REAUTH_REQUIRED so the user retries.
      }
      finalizeSwitch(pendingTarget.id);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  if (!isSuperAdmin) return null;

  const selected = societies.find((s) => s.id === selectedId);
  const isOverriding = selected && selected.id !== user?.societyId;

  const finalizeSwitch = (societyId: string) => {
    if (societyId === user?.societyId) {
      localStorage.removeItem('admin_selected_society_id');
    } else {
      localStorage.setItem('admin_selected_society_id', societyId);
    }
    setPendingTarget(null);
    setTotpCode('');
    setOtpCode('');
    qc.clear();
    window.location.reload();
  };

  const onSwitch = (societyId: string) => {
    // Switching back to the home society — no privileged data shift, no
    // reauth needed.
    if (societyId === user?.societyId) {
      finalizeSwitch(societyId);
      return;
    }
    const target = societies.find((s) => s.id === societyId);
    if (!target) return;

    // Fresh-login fast path: if the current access token was minted within
    // the last FRESH_LOGIN_WINDOW_SECONDS (Marzi OTP happened recently), the
    // backend will accept the switch without a separate reauth token. Skip
    // the modal entirely — much smoother UX for the typical "log in, do
    // multi-society work" flow.
    const iat = readBearerIat();
    const now = Math.floor(Date.now() / 1000);
    const ageSeconds = iat ? now - iat : Number.POSITIVE_INFINITY;
    if (ageSeconds <= FRESH_LOGIN_WINDOW_SECONDS) {
      finalizeSwitch(societyId);
      return;
    }

    // Stale session — fall back to explicit reauth modal.
    setPendingTarget(target);
  };

  const submitReauth = () => {
    const creds: { totpCode?: string; otp?: string } = {};
    if (me?.totpEnabled) {
      if (totpCode.length !== 6) return;
      creds.totpCode = totpCode;
    } else {
      if (!otpCode) return;
      creds.otp = otpCode;
    }
    reauthMutation.mutate(creds);
  };

  return (
    <div className="px-3 pb-3 relative">
      <label className="block text-[10px] font-semibold tracking-widest uppercase text-gray-400 mb-1.5 px-1">
        Active society
      </label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          'w-full flex items-center gap-2 pl-2.5 pr-2 py-2 rounded-lg border text-left transition-colors ' +
          (isOverriding
            ? 'bg-amber-50/60 border-amber-200 hover:bg-amber-50'
            : 'bg-gray-50 border-gray-200 hover:bg-gray-100')
        }
      >
        <Building2 className="w-4 h-4 text-gray-500 shrink-0" />
        <span className="text-[13px] text-gray-900 font-medium truncate flex-1">
          {selected ? selected.name : 'Loading…'}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
      </button>
      {isOverriding && (
        <p className="text-[10px] text-amber-700 mt-1 px-1">
          Viewing as super-admin · re-auth confirmed
        </p>
      )}

      {/* C1: reauth modal — only opens when switching to a different society. */}
      <Modal
        open={!!pendingTarget}
        onClose={() => {
          setPendingTarget(null);
          setTotpCode('');
          setOtpCode('');
        }}
        title="Re-authenticate to switch society"
        description={
          pendingTarget
            ? `Confirm your identity to view ${pendingTarget.name}. This is a privileged action.`
            : undefined
        }
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setPendingTarget(null);
                setTotpCode('');
                setOtpCode('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={reauthMutation.isPending}
              onClick={submitReauth}
              leadingIcon={<ShieldCheck className="w-4 h-4" />}
              disabled={
                me?.totpEnabled ? totpCode.length !== 6 : otpCode.length < 4
              }
            >
              Confirm & switch
            </Button>
          </>
        }
      >
        {me?.totpEnabled ? (
          <Field
            label="Authenticator code"
            hint="6-digit code from your authenticator app"
          >
            <Input
              autoFocus
              inputMode="numeric"
              maxLength={6}
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
            />
          </Field>
        ) : (
          <Field label="OTP" hint="Enter the OTP sent to your registered phone">
            <Input
              autoFocus
              inputMode="numeric"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
              placeholder="1234"
            />
          </Field>
        )}
      </Modal>

      {open && (
        <>
          <button
            aria-hidden
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-3 right-3 mt-1 z-40 max-h-72 overflow-auto bg-white rounded-lg border border-gray-200 shadow-lg py-1">
            {societies.length === 0 ? (
              <p className="px-3 py-2 text-[12px] text-gray-500">No societies.</p>
            ) : (
              societies.map((s) => {
                const isSelected = s.id === selectedId;
                const status = s.status ?? 'ACTIVE';
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onSwitch(s.id);
                    }}
                    className={
                      'w-full flex items-center gap-2 px-3 py-2 text-left text-[13px] ' +
                      (isSelected
                        ? 'bg-gray-50 text-gray-950'
                        : 'text-gray-700 hover:bg-gray-50')
                    }
                  >
                    <span className="flex-1 min-w-0">
                      <span className="font-medium truncate block">{s.name}</span>
                      <span className="text-[11px] text-gray-500">{s.city}</span>
                    </span>
                    {status !== 'ACTIVE' && (
                      <StatusPill tone={status === 'SUSPENDED' ? 'warning' : 'neutral'}>
                        {status.toLowerCase()}
                      </StatusPill>
                    )}
                    {isSelected && <Check className="w-3.5 h-3.5 text-gray-600" />}
                  </button>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
