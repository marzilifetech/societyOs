'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Plus, ChevronRight } from 'lucide-react';
import { careApi } from '@/lib/care-api';
import { CareHeader, CareBody } from '@/components/care/chrome';
import { Button, cn } from '@/components/primitives';
import {
  VITAL_META,
  VITAL_TYPES,
  MiniChart,
  LoadingRows,
  ErrorRetry,
  cardClass,
  isVitalType,
  type VitalType,
} from '../_components';

interface VitalReading {
  id: string;
  value: string;
  unit: string;
  recordedAt: string;
  notes?: string;
}

interface VitalsData {
  readings: VitalReading[];
  sparkline: number[];
}

function VitalsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const initial = params.get('tab');
  const [activeTab, setActiveTab] = useState<VitalType>(isVitalType(initial) ? initial : 'bp');
  const meta = VITAL_META[activeTab];

  const { data, isLoading, isError, refetch } = useQuery<VitalsData>({
    queryKey: ['vitals', activeTab],
    queryFn: () => careApi.get<VitalsData>(`/health/vitals?type=${activeTab}&days=7`),
  });

  const min = data && data.sparkline.length ? Math.min(...data.sparkline) : undefined;
  const max = data && data.sparkline.length ? Math.max(...data.sparkline) : undefined;

  return (
    <>
      <CareHeader
        title="Vitals"
        back
        right={
          <Button
            size="sm"
            leadingIcon={<Plus className="w-4 h-4" />}
            onClick={() => router.push('/care/health/vitals/log')}
          >
            Log
          </Button>
        }
      />

      <CareBody>
        {/* Type tabs */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {VITAL_TYPES.map((type) => {
            const m = VITAL_META[type];
            const active = activeTab === type;
            return (
              <button
                key={type}
                onClick={() => setActiveTab(type)}
                className={cn(
                  'h-14 rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-colors',
                  active
                    ? 'bg-primary-600 border-primary-600 text-white'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300',
                )}
              >
                <m.Icon className="w-4 h-4" />
                <span className="text-[11px] font-semibold">{m.short}</span>
              </button>
            );
          })}
        </div>

        {isLoading && <LoadingRows />}
        {isError && <ErrorRetry message="Could not load vitals." onRetry={() => refetch()} />}

        {data && (
          <>
            {/* 7-day trend */}
            <div className={cn(cardClass, 'p-4 mb-4')}>
              <p className="text-[13px] text-gray-500 mb-3">Last 7 days · {meta.label}</p>
              <MiniChart values={data.sparkline} />
              {min !== undefined && max !== undefined && (
                <div className="flex justify-between mt-2">
                  <span className="text-[11px] text-gray-400">Low: {min}</span>
                  <span className="text-[11px] text-gray-400">High: {max}</span>
                </div>
              )}
            </div>

            {/* 30-day history link */}
            <Link
              href={`/care/health/vitals/${activeTab}`}
              className={cn(cardClass, 'px-4 py-3.5 mb-4 flex items-center justify-between active:bg-gray-50 transition-colors')}
            >
              <span className="text-[13px] text-gray-900">View 30-day history &amp; statistics</span>
              <ChevronRight className="w-4 h-4 text-primary-600" />
            </Link>

            {/* Readings */}
            {data.readings.length === 0 ? (
              <div className={cn(cardClass, 'p-8 flex flex-col items-center text-center')}>
                <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center mb-3', meta.tile)}>
                  <meta.Icon className="w-7 h-7" />
                </div>
                <p className="text-[14px] font-semibold text-gray-900 mb-1">No readings yet</p>
                <p className="text-[13px] text-gray-500">Tap Log to add your first {meta.label.toLowerCase()} reading.</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {data.readings.map((r) => (
                  <li key={r.id} className={cn(cardClass, 'px-4 py-3.5')}>
                    <div className="flex items-baseline justify-between">
                      <span className="text-[18px] font-bold text-gray-950">
                        {r.value} <span className="text-[12px] font-normal text-gray-400">{r.unit || meta.unit}</span>
                      </span>
                      <span className="text-[12px] text-gray-500">{new Date(r.recordedAt).toLocaleString()}</span>
                    </div>
                    {r.notes && <p className="text-[12px] text-gray-500 mt-1 italic">{r.notes}</p>}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </CareBody>
    </>
  );
}

export default function VitalsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <VitalsInner />
    </Suspense>
  );
}
