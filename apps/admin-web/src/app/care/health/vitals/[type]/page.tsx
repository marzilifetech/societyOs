'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Activity } from 'lucide-react';
import { careApi } from '@/lib/care-api';
import { CareHeader, CareBody } from '@/components/care/chrome';
import { cn } from '@/components/primitives';
import {
  VITAL_META,
  MiniChart,
  LoadingRows,
  ErrorRetry,
  cardClass,
  isVitalType,
  type VitalMeta,
} from '../../_components';

interface VitalReading {
  id: string;
  value: string;
  unit: string;
  recordedAt: string;
  notes?: string;
}

interface VitalHistory {
  readings: VitalReading[];
  chart: number[];
  stats: { min: number; max: number; avg: number };
  unit: string;
}

const FALLBACK_META: VitalMeta = {
  key: 'bp',
  label: 'Vital',
  short: 'Vital',
  unit: '',
  placeholder: '',
  Icon: Activity,
  tile: 'bg-primary-50 text-primary-600',
};

export default function VitalTypePage() {
  const params = useParams<{ type: string }>();
  const type = params.type;
  const meta: VitalMeta = isVitalType(type) ? VITAL_META[type] : { ...FALLBACK_META, label: type };

  const { data, isLoading, isError, refetch } = useQuery<VitalHistory>({
    queryKey: ['vitals-history', type],
    queryFn: () => careApi.get<VitalHistory>(`/health/vitals/${type}?days=30`),
    enabled: !!type,
  });

  return (
    <>
      <CareHeader title={meta.label} subtitle="30-day history" back />

      <CareBody>
        {isLoading && <LoadingRows count={2} />}
        {isError && <ErrorRetry message="Could not load history." onRetry={() => refetch()} />}

        {data && (
          <>
            {/* Trend */}
            <div className={cn(cardClass, 'p-4 mb-4')}>
              <p className="text-[13px] text-gray-500 mb-3">30-day trend</p>
              <MiniChart values={data.chart} recent={7} />
              <div className="flex justify-between mt-2">
                <span className="text-[11px] text-gray-400">30 days ago</span>
                <span className="text-[11px] text-gray-400">Today</span>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { label: 'Minimum', value: data.stats.min },
                { label: 'Average', value: data.stats.avg },
                { label: 'Maximum', value: data.stats.max },
              ].map((s) => (
                <div key={s.label} className={cn(cardClass, 'p-3 flex flex-col items-center text-center')}>
                  <span className="text-[18px] font-bold text-gray-950 leading-none">{s.value}</span>
                  <span className="text-[10px] text-gray-400 mt-1">{data.unit || meta.unit}</span>
                  <span className="text-[11px] text-gray-500 mt-0.5">{s.label}</span>
                </div>
              ))}
            </div>

            <h2 className="text-[15px] font-semibold text-gray-950 mb-3">All readings</h2>

            {data.readings.length === 0 ? (
              <div className={cn(cardClass, 'p-8 flex flex-col items-center text-center')}>
                <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center mb-3', meta.tile)}>
                  <meta.Icon className="w-7 h-7" />
                </div>
                <p className="text-[13px] text-gray-500">No readings recorded yet.</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {data.readings.map((r) => (
                  <li key={r.id} className={cn(cardClass, 'px-4 py-3.5')}>
                    <div className="flex items-baseline justify-between">
                      <span className="text-[18px] font-bold text-gray-950">
                        {r.value}{' '}
                        <span className="text-[12px] font-normal text-gray-400">{r.unit || data.unit || meta.unit}</span>
                      </span>
                      <span className="text-[12px] text-gray-500">
                        {new Date(r.recordedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-[12px] text-gray-500 mt-0.5">
                      {new Date(r.recordedAt).toLocaleTimeString()}
                    </p>
                    {r.notes && <p className="text-[12px] text-gray-500 mt-1 italic">&ldquo;{r.notes}&rdquo;</p>}
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
