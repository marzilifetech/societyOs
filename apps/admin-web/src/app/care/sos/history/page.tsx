'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Siren, CalendarDays, Clock, TriangleAlert } from 'lucide-react';
import { careApi } from '@/lib/care-api';
import { CareHeader, CareBody } from '@/components/care/chrome';
import { Button, EmptyState, cn } from '@/components/primitives';
import {
  SosStatusPill,
  fmtDateTime,
  fmtDuration,
  type SosHistoryItem,
} from '../_components';

type Tab = 'all' | 'active' | 'past';
const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'past', label: 'Past' },
];

function isOpen(status: string): boolean {
  const s = status.toUpperCase();
  return s === 'ACTIVE' || s === 'ACKNOWLEDGED';
}

function titleFor(item: SosHistoryItem): string {
  const firstLine = (item.note ?? '').split('\n')[0]?.trim();
  return firstLine || 'Emergency alert';
}

export default function CareSosHistoryPage() {
  const [tab, setTab] = useState<Tab>('all');

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['care-sos-history'],
    queryFn: () => careApi.get<SosHistoryItem[]>('/sos/history'),
  });

  const items = Array.isArray(data) ? data : [];
  const filtered = items.filter((i) =>
    tab === 'all' ? true : tab === 'active' ? isOpen(i.status) : !isOpen(i.status),
  );

  return (
    <>
      <CareHeader title="SOS history" back />

      <CareBody>
        {/* Segmented filter */}
        <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                'rounded-lg py-1.5 text-[13px] font-medium transition-colors',
                tab === t.key
                  ? 'bg-white text-gray-950 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-[76px] animate-pulse rounded-2xl border border-gray-100 bg-white"
              />
            ))}
          </div>
        ) : isError ? (
          <EmptyState
            icon={<TriangleAlert className="h-5 w-5" />}
            title="Couldn't load history"
            description={error instanceof Error ? error.message : 'Please try again in a moment.'}
            action={
              <Button variant="secondary" loading={isFetching} onClick={() => refetch()}>
                Retry
              </Button>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Siren className="h-5 w-5" />}
            title={
              tab === 'active'
                ? 'No active alerts'
                : tab === 'past'
                  ? 'No past alerts'
                  : 'No alerts yet'
            }
            description="SOS alerts you send will appear here."
          />
        ) : (
          <ul className="space-y-3">
            {filtered.map((item) => (
              <li
                key={item.id}
                className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-gray-950">
                      {titleFor(item)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-gray-500">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {fmtDateTime(item.createdAt)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {fmtDuration(item.durationSec)}
                      </span>
                    </div>
                  </div>
                  <SosStatusPill status={item.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CareBody>
    </>
  );
}
