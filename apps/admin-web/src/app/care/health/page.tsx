'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Activity, Pill, FolderOpen, Plus, ChevronRight, CheckCircle2, Check } from 'lucide-react';
import { careApi } from '@/lib/care-api';
import { CareHeader, CareBody, BottomNav } from '@/components/care/chrome';
import { cn } from '@/components/primitives';
import {
  VITAL_META,
  VITAL_TYPES,
  cardClass,
  LoadingRows,
  ErrorRetry,
  type VitalType,
} from './_components';

interface VitalsSummary {
  bp?: { systolic: number; diastolic: number; recordedAt: string };
  sugar?: { value: number; recordedAt: string };
  weight?: { value: number; recordedAt: string };
  spo2?: { value: number; recordedAt: string };
}

interface MedReminder {
  id: string;
  name: string;
  dosage: string;
  time: string;
  taken: boolean;
}

interface TodaySummary {
  vitals: VitalsSummary;
  medications: MedReminder[];
}

const QUICK_LINKS = [
  { href: '/care/health/vitals', label: 'Vitals', desc: 'Track & log', Icon: Activity, tile: 'bg-red-50 text-red-600' },
  { href: '/care/health/medications', label: 'Medications', desc: "Today's reminders", Icon: Pill, tile: 'bg-amber-50 text-amber-700' },
  { href: '/care/health/records', label: 'Records', desc: 'Reports & documents', Icon: FolderOpen, tile: 'bg-sky-50 text-sky-700' },
] as const;

function vitalDisplay(type: VitalType, v: VitalsSummary): string {
  if (type === 'bp') return v.bp ? `${v.bp.systolic}/${v.bp.diastolic}` : '—';
  if (type === 'sugar') return v.sugar ? String(v.sugar.value) : '—';
  if (type === 'weight') return v.weight ? String(v.weight.value) : '—';
  return v.spo2 ? String(v.spo2.value) : '—';
}

export default function HealthHubPage() {
  const { data, isLoading, isError, refetch } = useQuery<TodaySummary>({
    queryKey: ['health-today'],
    queryFn: () => careApi.get<TodaySummary>('/health/today'),
  });

  return (
    <>
      <CareHeader title="Health" subtitle="Your wellness at a glance" />

      <CareBody>
        {/* Quick links */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {QUICK_LINKS.map((q) => (
            <Link
              key={q.href}
              href={q.href}
              className={cn(cardClass, 'p-3 flex flex-col items-center text-center active:bg-gray-50 transition-colors')}
            >
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', q.tile)}>
                <q.Icon className="w-5 h-5" />
              </div>
              <p className="text-[12px] font-semibold text-gray-900 mt-2 leading-tight">{q.label}</p>
            </Link>
          ))}
        </div>

        {/* Today's vitals */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-semibold text-gray-950">Today&apos;s vitals</h2>
          <Link
            href="/care/health/vitals/log"
            className="inline-flex items-center gap-1 text-[13px] font-medium text-primary-600"
          >
            <Plus className="w-3.5 h-3.5" /> Log
          </Link>
        </div>

        {isLoading && <LoadingRows count={2} className="mb-6" />}
        {isError && <ErrorRetry onRetry={() => refetch()} />}

        {data && (
          <>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {VITAL_TYPES.map((type) => {
                const meta = VITAL_META[type];
                return (
                  <Link
                    key={type}
                    href={`/care/health/vitals?tab=${type}`}
                    className={cn(cardClass, 'p-4 active:bg-gray-50 transition-colors')}
                  >
                    <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', meta.tile)}>
                      <meta.Icon className="w-5 h-5" />
                    </div>
                    <p className="text-[20px] font-bold text-gray-950 mt-2 leading-none">
                      {vitalDisplay(type, data.vitals)}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-1">{meta.unit}</p>
                    <p className="text-[12px] text-gray-500 mt-0.5">{meta.label}</p>
                  </Link>
                );
              })}
            </div>

            {/* Medications today */}
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[15px] font-semibold text-gray-950">Medications today</h2>
              <Link href="/care/health/medications" className="text-[13px] font-medium text-primary-600">
                See all
              </Link>
            </div>

            {data.medications.length === 0 ? (
              <div className={cn(cardClass, 'p-6 flex flex-col items-center text-center')}>
                <div className="w-12 h-12 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center mb-3">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <p className="text-[13px] text-gray-500">No medications scheduled</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {data.medications.map((med) => (
                  <li key={med.id} className={cn(cardClass, 'px-4 py-3.5 flex items-center gap-3')}>
                    <span
                      className={cn(
                        'w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0',
                        med.taken ? 'border-primary-500 bg-primary-50' : 'border-gray-300',
                      )}
                    >
                      {med.taken && <Check className="w-3.5 h-3.5 text-primary-600" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-semibold text-gray-950 truncate">{med.name}</p>
                      <p className="text-[12px] text-gray-500">
                        {med.dosage} · {med.time}
                      </p>
                    </div>
                    {med.taken && <span className="text-[12px] font-medium text-primary-600">Taken</span>}
                    {!med.taken && <ChevronRight className="w-4 h-4 text-gray-300" />}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </CareBody>

      <BottomNav />
    </>
  );
}
