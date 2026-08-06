'use client';

import type { ComponentType } from 'react';
import { Activity, Droplet, Scale, Gauge } from 'lucide-react';
import { Button, cn } from '@/components/primitives';
import { careApi } from '@/lib/care-api';

/* ─────────────────────────── Vital metadata ─────────────────────────── */

export type VitalType = 'bp' | 'sugar' | 'weight' | 'spo2';

export interface VitalMeta {
  key: VitalType;
  /** Full name, e.g. "Blood Pressure". */
  label: string;
  /** Short tab label, e.g. "BP". */
  short: string;
  unit: string;
  placeholder: string;
  Icon: ComponentType<{ className?: string }>;
  /** Tailwind classes for the small icon tile (bg + text). */
  tile: string;
}

export const VITAL_META: Record<VitalType, VitalMeta> = {
  bp: {
    key: 'bp',
    label: 'Blood Pressure',
    short: 'BP',
    unit: 'mmHg',
    placeholder: '120/80',
    Icon: Activity,
    tile: 'bg-red-50 text-red-600',
  },
  sugar: {
    key: 'sugar',
    label: 'Blood Sugar',
    short: 'Sugar',
    unit: 'mg/dL',
    placeholder: '95',
    Icon: Droplet,
    tile: 'bg-sky-50 text-sky-600',
  },
  weight: {
    key: 'weight',
    label: 'Weight',
    short: 'Weight',
    unit: 'kg',
    placeholder: '70.5',
    Icon: Scale,
    tile: 'bg-green-50 text-green-600',
  },
  spo2: {
    key: 'spo2',
    label: 'SpO2',
    short: 'SpO2',
    unit: '%',
    placeholder: '98',
    Icon: Gauge,
    tile: 'bg-violet-50 text-violet-600',
  },
};

export const VITAL_TYPES: VitalType[] = ['bp', 'sugar', 'weight', 'spo2'];

export function isVitalType(v: string | null | undefined): v is VitalType {
  return v === 'bp' || v === 'sugar' || v === 'weight' || v === 'spo2';
}

/** Shared card surface, matching the `/care` home tiles. */
export const cardClass = 'rounded-2xl bg-white border border-gray-100 shadow-sm';

/* ─────────────────────────── Mini trend chart ───────────────────────── */

/**
 * A dependency-free bar chart drawn with plain divs. `recent` highlights the
 * last N bars in the brand colour (older bars are muted) — used to distinguish
 * this-week readings inside a 30-day window.
 */
export function MiniChart({
  values,
  recent,
  height = 80,
  className,
}: {
  values: number[];
  recent?: number;
  height?: number;
  className?: string;
}) {
  if (!values || values.length < 2) {
    return (
      <p className={cn('text-[12px] text-gray-400 py-4 text-center', className)}>
        Not enough readings to chart a trend yet.
      </p>
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const recentFrom = typeof recent === 'number' ? values.length - recent : -1;

  return (
    <div className={cn('flex items-end gap-1', className)} style={{ height }}>
      {values.map((v, i) => {
        const barH = Math.max(6, ((v - min) / range) * (height - 8));
        const highlighted = typeof recent === 'number' ? i >= recentFrom : true;
        return (
          <div
            key={i}
            className={cn('flex-1 rounded-t-sm', highlighted ? 'bg-primary-500' : 'bg-primary-200')}
            style={{ height: `${barH}px` }}
          />
        );
      })}
    </div>
  );
}

/* ─────────────────────────── Load / error UI ────────────────────────── */

export function LoadingRows({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-20 rounded-2xl bg-gray-100 animate-pulse" />
      ))}
    </div>
  );
}

export function ErrorRetry({ message, onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <div className={cn(cardClass, 'p-6 text-center')}>
      <p className="text-[13px] text-gray-600 mb-3">
        {message ?? "We couldn't load this right now. Please try again — your data is safe."}
      </p>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

/* ─────────────────────── Marzi media upload (web) ───────────────────── */

interface CreateMediaResponse {
  asset_id: string;
  s3_key: string;
  public_url: string | null;
  upload: { method: string; url: string; fields: Record<string, string> };
}

export interface MediaUploadResult {
  assetId: string;
  publicUrl: string | null;
  s3Key: string;
}

/**
 * Web mirror of the resident app's `uploadViaMedia` (see
 * apps/resident-app/src/lib/photo-upload.ts). Three steps, all through the
 * Marzi media service:
 *   1. POST /media            → asset + presigned S3 POST descriptor
 *   2. POST to S3 (multipart) → the file bytes (signed fields first, file last)
 *   3. POST /media/:id/confirm → flip the asset PENDING → ACTIVE
 * Returns the S3 key to persist against the health record (`fileKey`).
 */
export async function uploadViaCareMedia(
  file: File,
  visibility: 'public' | 'private' = 'private',
): Promise<MediaUploadResult> {
  const created = await careApi.post<CreateMediaResponse>('/media', {
    filename: file.name,
    content_type: file.type || 'application/octet-stream',
    visibility,
  });

  const form = new FormData();
  for (const [k, v] of Object.entries(created.upload.fields)) form.append(k, v);
  form.append('file', file);

  const res = await fetch(created.upload.url, { method: 'POST', body: form });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Upload failed (${res.status})`);
  }

  await careApi.post(`/media/${created.asset_id}/confirm`, {});

  return {
    assetId: created.asset_id,
    publicUrl: created.public_url,
    s3Key: created.s3_key,
  };
}
