'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Siren,
  Headset,
  Shield,
  Users,
  MapPin,
  MapPinOff,
  CircleCheck,
  X,
  Plus,
  History,
  Check,
  LoaderCircle,
  ChevronRight,
} from 'lucide-react';
import { careApi } from '@/lib/care-api';
import { useCareAuth } from '@/store/care-auth.store';
import { CareHeader, CareBody, BottomNav } from '@/components/care/chrome';
import { Button, Textarea, Modal, cn } from '@/components/primitives';
import {
  SosBeacon,
  fmtCoords,
  isTerminal,
  type SosAlert,
  type SosHistoryItem,
} from './_components';

type Phase = 'form' | 'countdown' | 'active' | 'resolved' | 'cancelled';
type LocState = 'idle' | 'locating' | 'ok' | 'denied';

const CANCEL_REASONS = [
  'Feeling better now',
  'Help already here',
  'Accidental press',
  'Situation resolved',
];

const RESPONDERS = [
  { label: 'Help Desk', icon: Headset, ack: 'Dispatching help' },
  { label: 'Security Gate', icon: Shield, ack: 'Security alerted' },
  { label: 'First Responder', icon: Users, ack: 'On the way' },
];

export default function CareSosPage() {
  const qc = useQueryClient();
  const user = useCareAuth((s) => s.user);

  const [phase, setPhase] = useState<Phase>('form');
  const [countdown, setCountdown] = useState(5);
  const [alertId, setAlertId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locState, setLocState] = useState<LocState>('idle');

  const [showNote, setShowNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState<string | null>(null);
  const [cancelComments, setCancelComments] = useState('');

  const coordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const abortRef = useRef(false);

  // ── geolocation ────────────────────────────────────────────────────────────
  // Requested the moment the resident initiates SOS. Optional: if denied or
  // unavailable we still trigger without coordinates and surface a small note.
  const captureLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocState('denied');
      return;
    }
    setLocState('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        coordsRef.current = c;
        setCoords(c);
        setLocState('ok');
      },
      () => setLocState('denied'),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    );
  }, []);

  // ── trigger ──────────────────────────────────────────────────────────────--
  const triggerMutation = useMutation({
    mutationFn: async (): Promise<SosAlert> => {
      const c = coordsRef.current;
      const body: { lat?: number; lng?: number } = {};
      if (c) {
        body.lat = c.lat;
        body.lng = c.lng;
      }
      const alert = await careApi.post<SosAlert>('/sos/trigger', body);
      const n = note.trim();
      if (n) {
        // Best-effort note attach — never let it fail the trigger.
        await careApi.patch(`/sos/${alert.id}/note`, { note: n }).catch(() => {});
      }
      return alert;
    },
    onSuccess: (alert) => {
      setAlertId(alert.id);
      setPhase('active');
      qc.invalidateQueries({ queryKey: ['care-sos-history'] });
      qc.invalidateQueries({ queryKey: ['care-sos-active'] });
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : 'Could not send SOS. Please call security directly.');
      setPhase('form');
    },
  });

  // Fire via ref so the countdown effect doesn't restart when the mutation
  // object identity changes.
  const fireRef = useRef<() => void>(() => {});
  fireRef.current = () => triggerMutation.mutate();

  useEffect(() => {
    if (phase !== 'countdown') return;
    abortRef.current = false;
    setCountdown(5);
    const id = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(id);
          if (!abortRef.current) fireRef.current();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  const startCountdown = () => {
    captureLocation();
    setPhase('countdown');
  };
  const cancelCountdown = () => {
    abortRef.current = true;
    setPhase('form');
  };

  // ── resume: existing active alert on mount ──────────────────────────────────
  const bootstrap = useQuery({
    queryKey: ['care-sos-active', user?.id],
    queryFn: async (): Promise<SosAlert | null> => {
      const list = await careApi.get<SosAlert[]>('/sos/active');
      const mine = (Array.isArray(list) ? list : []).filter(
        (a) => String(a.residentId) === String(user?.id),
      );
      return mine[0] ?? null;
    },
    enabled: phase === 'form' && !alertId,
  });

  useEffect(() => {
    const a = bootstrap.data;
    if (!a || alertId || phase !== 'form') return;
    setAlertId(a.id);
    if (a.lat != null && a.lng != null) {
      const c = { lat: a.lat, lng: a.lng };
      coordsRef.current = c;
      setCoords(c);
      setLocState('ok');
    }
    setPhase('active');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootstrap.data]);

  // ── live status polling (every 4s, stops on terminal) ───────────────────────
  const liveQuery = useQuery({
    queryKey: ['care-sos-live', alertId],
    queryFn: async (): Promise<SosHistoryItem | null> => {
      const list = await careApi.get<SosHistoryItem[]>('/sos/history');
      return (Array.isArray(list) ? list : []).find((a) => String(a.id) === String(alertId)) ?? null;
    },
    enabled: !!alertId && phase === 'active',
    staleTime: 0,
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return s && isTerminal(s) ? false : 4000;
    },
  });

  const liveStatus = liveQuery.data?.status;
  const acknowledged = liveStatus === 'ACKNOWLEDGED';

  // Reconcile: a responder may resolve / flag the alert while we poll.
  useEffect(() => {
    if (liveStatus === 'RESOLVED') setPhase('resolved');
    else if (liveStatus === 'FALSE_ALARM') setPhase('cancelled');
  }, [liveStatus]);

  // ── actions ─────────────────────────────────────────────────────────────---
  const noteMutation = useMutation({
    mutationFn: (n: string) => careApi.patch(`/sos/${alertId}/note`, { note: n }),
    onSuccess: () => {
      toast.success('Note added');
      setShowNote(false);
      setNoteDraft('');
      qc.invalidateQueries({ queryKey: ['care-sos-live', alertId] });
      qc.invalidateQueries({ queryKey: ['care-sos-history'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not add note.'),
  });

  const resolveMutation = useMutation({
    mutationFn: () => careApi.patch(`/sos/${alertId}/resolve`, {}),
    onSuccess: () => {
      toast.success('Marked as resolved');
      setPhase('resolved');
      qc.invalidateQueries({ queryKey: ['care-sos-history'] });
      qc.invalidateQueries({ queryKey: ['care-sos-active'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not resolve the alert.'),
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const n = [cancelReason, cancelComments.trim()].filter(Boolean).join(' — ');
      if (n) await careApi.patch(`/sos/${alertId}/note`, { note: n }).catch(() => {});
      return careApi.patch(`/sos/${alertId}/false-alarm`, {});
    },
    onSuccess: () => {
      toast.success('Alert cancelled');
      setShowCancel(false);
      setPhase('cancelled');
      qc.invalidateQueries({ queryKey: ['care-sos-history'] });
      qc.invalidateQueries({ queryKey: ['care-sos-active'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not cancel the alert.'),
  });

  const reset = () => {
    setAlertId(null);
    setPhase('form');
    setNote('');
    setCoords(null);
    coordsRef.current = null;
    setLocState('idle');
    setCancelReason(null);
    setCancelComments('');
    qc.invalidateQueries({ queryKey: ['care-sos-active'] });
  };

  // ── derived copy ────────────────────────────────────────────────────────---
  const title =
    phase === 'countdown'
      ? 'Sending alert'
      : phase === 'active'
        ? acknowledged
          ? 'Help is on the way'
          : 'Alert sent'
        : phase === 'resolved'
          ? 'Emergency resolved'
          : phase === 'cancelled'
            ? 'Alert cancelled'
            : 'Emergency alert';

  const subtitle =
    phase === 'countdown'
      ? `Alert will be sent in ${countdown}s — tap cancel to stop.`
      : phase === 'active'
        ? acknowledged
          ? 'A responder has acknowledged your alert.'
          : 'Emergency teams have been notified. Awaiting response…'
        : phase === 'resolved'
          ? 'Your emergency has been marked resolved.'
          : phase === 'cancelled'
            ? 'All responders were notified this was a false alarm.'
            : 'Send an instant alert to security and nearby responders.';

  const beaconTone = phase === 'resolved' ? 'green' : phase === 'cancelled' ? 'gray' : 'red';
  const beaconPulse = phase === 'countdown' || (phase === 'active' && !acknowledged);
  const coordStr = fmtCoords(coords?.lat, coords?.lng);

  const locationNote =
    locState === 'locating' ? (
      <span className="inline-flex items-center gap-1.5 text-[12px] text-gray-500">
        <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Locating you…
      </span>
    ) : coordStr ? (
      <span className="inline-flex items-center gap-1.5 text-[12px] text-gray-500">
        <MapPin className="h-3.5 w-3.5 text-red-500" /> {coordStr}
      </span>
    ) : locState === 'denied' ? (
      <span className="inline-flex items-center gap-1.5 text-[12px] text-gray-500">
        <MapPinOff className="h-3.5 w-3.5" /> Location unavailable — responders will use your
        registered address.
      </span>
    ) : null;

  const showBootstrapLoader = bootstrap.isLoading && phase === 'form' && !alertId;

  return (
    <>
      <CareHeader
        title="Emergency SOS"
        right={
          <Link
            href="/care/sos/history"
            aria-label="SOS history"
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 active:bg-gray-200"
          >
            <History className="h-5 w-5" />
          </Link>
        }
      />

      <CareBody>
        {showBootstrapLoader ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <LoaderCircle className="h-6 w-6 animate-spin" />
            <p className="mt-3 text-[13px]">Checking for active alerts…</p>
          </div>
        ) : (
          <>
            {/* Beacon */}
            <div className="mb-5 mt-2">
              <SosBeacon tone={beaconTone} pulse={beaconPulse}>
                {phase === 'countdown' ? (
                  <span className="text-5xl font-bold tabular-nums">{countdown}</span>
                ) : phase === 'resolved' ? (
                  <CircleCheck className="h-14 w-14" strokeWidth={2.2} />
                ) : phase === 'cancelled' ? (
                  <X className="h-14 w-14" strokeWidth={2.4} />
                ) : (
                  <Siren className="h-12 w-12" strokeWidth={2} />
                )}
              </SosBeacon>
            </div>

            {/* Title + subtitle */}
            <h2 className="text-center text-[22px] font-semibold tracking-tight text-gray-950">
              {title}
            </h2>
            <p className="mx-auto mt-1.5 max-w-xs text-center text-[13px] text-gray-500">
              {subtitle}
            </p>

            {locationNote && <div className="mt-3 flex justify-center">{locationNote}</div>}

            {/* Form: who gets alerted + optional details */}
            {(phase === 'form' || phase === 'countdown') && (
              <>
                <div className="mt-6 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                  <p className="mb-4 text-center text-[12px] font-medium text-gray-500">
                    Alerts will be sent to
                  </p>
                  <div className="flex items-start justify-between">
                    {RESPONDERS.map((r) => (
                      <div key={r.label} className="flex flex-1 flex-col items-center gap-2">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
                          <r.icon className="h-5 w-5" />
                        </div>
                        <span className="text-center text-[11px] leading-tight text-gray-600">
                          {r.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {phase === 'form' && (
                  <div className="mt-4">
                    <label
                      htmlFor="sos-details"
                      className="mb-1.5 block text-[13px] font-semibold text-gray-800"
                    >
                      Additional details{' '}
                      <span className="font-normal text-gray-400">(optional)</span>
                    </label>
                    <Textarea
                      id="sos-details"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Describe your emergency…"
                      maxLength={2000}
                      rows={4}
                    />
                  </div>
                )}
              </>
            )}

            {/* Active: live responder status */}
            {phase === 'active' && (
              <div className="mt-6 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[12px] font-medium text-gray-500">Responder status</p>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 text-[11px] font-medium',
                      acknowledged ? 'text-emerald-600' : 'text-red-600',
                    )}
                  >
                    <span
                      className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        acknowledged ? 'bg-emerald-500' : 'animate-pulse bg-red-500',
                      )}
                    />
                    {acknowledged ? 'Acknowledged' : 'Live'}
                  </span>
                </div>
                <ul className="space-y-3.5">
                  {RESPONDERS.map((r) => (
                    <li key={r.label} className="flex items-center gap-3">
                      <div
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-full',
                          acknowledged ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600',
                        )}
                      >
                        <r.icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-semibold text-gray-900">{r.label}</p>
                        <p
                          className={cn(
                            'text-[12px]',
                            acknowledged ? 'text-emerald-600' : 'text-gray-400',
                          )}
                        >
                          {acknowledged ? `Acknowledged · ${r.ack}` : 'Awaiting response…'}
                        </p>
                      </div>
                      {acknowledged && <Check className="h-4 w-4 text-emerald-500" />}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Info card (name) while an alert is live */}
            {(phase === 'active' || phase === 'countdown') && (
              <div className="mt-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <p className="mb-2 text-[12px] font-medium text-gray-500">Your information</p>
                <div className="flex items-center justify-between py-1">
                  <span className="text-[13px] text-gray-500">Name</span>
                  <span className="text-[13px] font-medium text-gray-900">
                    {user?.name || 'Resident'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-[13px] text-gray-500">Location</span>
                  <span className="text-[13px] font-medium text-gray-900">
                    {coordStr ?? (locState === 'locating' ? 'Locating…' : 'Unavailable')}
                  </span>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="mt-6 space-y-2.5">
              {phase === 'form' && (
                <Button
                  variant="danger"
                  fullWidth
                  onClick={startCountdown}
                  leadingIcon={<Siren className="h-4 w-4" />}
                  className="h-12 rounded-xl text-[15px]"
                >
                  Send SOS alert
                </Button>
              )}

              {phase === 'countdown' && (
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={cancelCountdown}
                  className="h-12 rounded-xl text-[15px]"
                >
                  Cancel ({countdown})
                </Button>
              )}

              {phase === 'active' && (
                <>
                  <Button
                    variant="danger"
                    fullWidth
                    loading={resolveMutation.isPending}
                    onClick={() => resolveMutation.mutate()}
                    className="h-12 rounded-xl text-[15px]"
                  >
                    Mark as resolved
                  </Button>
                  <div className="grid grid-cols-2 gap-2.5">
                    <Button
                      variant="secondary"
                      fullWidth
                      onClick={() => {
                        setNoteDraft('');
                        setShowNote(true);
                      }}
                      leadingIcon={<Plus className="h-4 w-4" />}
                      className="h-11 rounded-xl"
                    >
                      Add note
                    </Button>
                    <Button
                      variant="ghost"
                      fullWidth
                      onClick={() => setShowCancel(true)}
                      className="h-11 rounded-xl text-red-600 hover:bg-red-50"
                    >
                      False alarm
                    </Button>
                  </div>
                </>
              )}

              {(phase === 'resolved' || phase === 'cancelled') && (
                <>
                  <Button
                    variant="primary"
                    fullWidth
                    onClick={reset}
                    className="h-12 rounded-xl text-[15px]"
                  >
                    Done
                  </Button>
                  <Link
                    href="/care/sos/history"
                    className="flex items-center justify-center gap-1 py-2 text-[13px] font-medium text-gray-500 hover:text-gray-700"
                  >
                    View SOS history <ChevronRight className="h-4 w-4" />
                  </Link>
                </>
              )}

              {phase === 'form' && (
                <Link
                  href="/care/sos/history"
                  className="flex items-center justify-center gap-1 py-2 text-[13px] font-medium text-gray-500 hover:text-gray-700"
                >
                  View SOS history <ChevronRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          </>
        )}
      </CareBody>

      {/* Add-note modal */}
      <Modal
        open={showNote}
        onClose={() => setShowNote(false)}
        title="Add a note"
        description="Give responders extra context about your emergency."
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowNote(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={noteMutation.isPending}
              disabled={!noteDraft.trim()}
              onClick={() => noteMutation.mutate(noteDraft.trim())}
            >
              Add note
            </Button>
          </>
        }
      >
        <Textarea
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          placeholder="e.g. I'm on the 3rd floor near the lift lobby."
          maxLength={2000}
          rows={4}
          autoFocus
        />
      </Modal>

      {/* False-alarm modal */}
      <Modal
        open={showCancel}
        onClose={() => setShowCancel(false)}
        title="Cancel SOS alert?"
        description="Let responders know this was a false alarm."
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCancel(false)}>
              Keep active
            </Button>
            <Button
              variant="danger"
              loading={cancelMutation.isPending}
              onClick={() => cancelMutation.mutate()}
            >
              Yes, cancel
            </Button>
          </>
        }
      >
        <p className="mb-2 text-[13px] font-medium text-gray-700">Reason</p>
        <div className="space-y-2">
          {CANCEL_REASONS.map((reason) => {
            const selected = cancelReason === reason;
            return (
              <button
                key={reason}
                type="button"
                onClick={() => setCancelReason(reason)}
                className={cn(
                  'flex w-full items-center justify-between rounded-xl border px-4 py-2.5 text-left text-[14px] transition-colors',
                  selected
                    ? 'border-gray-900 bg-white font-medium text-gray-900'
                    : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300',
                )}
              >
                {reason}
                {selected && <Check className="h-4 w-4 text-gray-900" />}
              </button>
            );
          })}
        </div>
        <label htmlFor="sos-cancel-comments" className="mb-1.5 mt-4 block text-[13px] font-medium text-gray-700">
          Additional comments <span className="font-normal text-gray-400">(optional)</span>
        </label>
        <Textarea
          id="sos-cancel-comments"
          value={cancelComments}
          onChange={(e) => setCancelComments(e.target.value)}
          placeholder="Describe why you're cancelling…"
          maxLength={500}
          rows={3}
        />
      </Modal>

      <BottomNav />
    </>
  );
}
