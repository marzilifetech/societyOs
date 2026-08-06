'use client';

import type { ReactNode } from 'react';
import { StatusPill, cn } from '@/components/primitives';

/**
 * Shared types + presentational bits for the resident SOS module.
 *
 * Backend contract (see backend/src/modules/sos): the alert row returned by
 * POST /sos/trigger, PATCH /sos/:id/{note,resolve,false-alarm} and listed by
 * GET /sos/active is the raw SosAlert. GET /sos/history returns a slimmer,
 * per-resident projection with a derived `durationSec`. There is no
 * GET /sos/:id, and /sos/active only ever contains ACTIVE rows — an alert drops
 * off it the moment a responder ACKNOWLEDGES — so live status polling reads
 * /sos/history (which carries every status) and matches on the alert id.
 */

export type SosStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED' | 'FALSE_ALARM';

/** Raw alert row from /sos/trigger, /sos/active and the action endpoints. */
export interface SosAlert {
  id: string;
  residentId?: string;
  societyId?: string;
  lat?: number | null;
  lng?: number | null;
  status: SosStatus;
  note?: string | null;
  createdAt: string;
  acknowledgedBy?: string | null;
  acknowledgedAt?: string | null;
  responseTimeSecs?: number | null;
  resolvedAt?: string | null;
}

/** Projection returned by GET /sos/history. */
export interface SosHistoryItem {
  id: string;
  status: SosStatus;
  note: string | null;
  createdAt: string;
  durationSec: number | null;
}

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export function statusMeta(status?: string): { label: string; tone: Tone } {
  switch ((status ?? '').toUpperCase()) {
    case 'ACTIVE':
      return { label: 'Active', tone: 'danger' };
    case 'ACKNOWLEDGED':
      return { label: 'Acknowledged', tone: 'warning' };
    case 'RESOLVED':
      return { label: 'Resolved', tone: 'success' };
    case 'FALSE_ALARM':
      return { label: 'False alarm', tone: 'neutral' };
    default:
      return { label: status ?? 'Unknown', tone: 'neutral' };
  }
}

/** A resident SOS is "open" while ACTIVE or ACKNOWLEDGED; terminal otherwise. */
export function isTerminal(status?: string): boolean {
  const s = (status ?? '').toUpperCase();
  return s === 'RESOLVED' || s === 'FALSE_ALARM';
}

export function SosStatusPill({ status }: { status?: string }) {
  const m = statusMeta(status);
  return (
    <StatusPill tone={m.tone} dot={m.tone === 'danger' || m.tone === 'warning'}>
      {m.label}
    </StatusPill>
  );
}

export function fmtDateTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function fmtDuration(sec?: number | null): string {
  if (sec == null) return '—';
  const safe = Math.max(0, Math.round(sec));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, '0')} min ${String(s).padStart(2, '0')} sec`;
}

export function fmtCoords(lat?: number | null, lng?: number | null): string | null {
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}° ${ns}, ${Math.abs(lng).toFixed(4)}° ${ew}`;
}

/**
 * Emergency beacon — concentric pulsing rings around a gradient core.
 * `pulse` animates the outer ring (used while sending / awaiting response).
 */
export function SosBeacon({
  tone,
  pulse,
  children,
}: {
  tone: 'red' | 'green' | 'gray';
  pulse?: boolean;
  children: ReactNode;
}) {
  const core =
    tone === 'green'
      ? 'from-emerald-400 to-emerald-600 shadow-emerald-500/40'
      : tone === 'gray'
        ? 'from-gray-400 to-gray-500 shadow-gray-500/30'
        : 'from-red-500 to-red-700 shadow-red-600/40';
  const ring = tone === 'green' ? 'bg-emerald-500' : tone === 'gray' ? 'bg-gray-400' : 'bg-red-500';

  return (
    <div className="relative mx-auto flex h-44 w-44 items-center justify-center">
      {pulse && (
        <span className={cn('absolute h-44 w-44 rounded-full opacity-20 animate-ping', ring)} />
      )}
      <span className={cn('absolute h-40 w-40 rounded-full opacity-[0.08]', ring)} />
      <span className={cn('absolute h-32 w-32 rounded-full opacity-[0.14]', ring)} />
      <div
        className={cn(
          'relative flex h-28 w-28 items-center justify-center rounded-full',
          'bg-gradient-to-br text-white shadow-xl',
          core,
        )}
      >
        {children}
      </div>
    </div>
  );
}
