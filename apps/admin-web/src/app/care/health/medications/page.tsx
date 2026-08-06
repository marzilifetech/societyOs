'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Plus,
  Check,
  Sunrise,
  Sun,
  Sunset,
  Moon,
  Pill,
  ChevronDown,
  ChevronUp,
  type LucideIcon,
} from 'lucide-react';
import { careApi } from '@/lib/care-api';
import { CareHeader, CareBody } from '@/components/care/chrome';
import { Button, cn } from '@/components/primitives';
import { LoadingRows, ErrorRetry, cardClass } from '../_components';

interface DoseEntry {
  id: string;
  medicationId: string;
  name: string;
  dosage: string;
  time: string;
  taken: boolean;
}

interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  times: string[];
}

type Slot = 'morning' | 'afternoon' | 'evening' | 'night';

interface MedData {
  todayDoses: Record<Slot, DoseEntry[]>;
  allMedications: Medication[];
}

const SLOTS: { key: Slot; label: string; Icon: LucideIcon; tint: string }[] = [
  { key: 'morning', label: 'Morning', Icon: Sunrise, tint: 'text-amber-500' },
  { key: 'afternoon', label: 'Afternoon', Icon: Sun, tint: 'text-orange-500' },
  { key: 'evening', label: 'Evening', Icon: Sunset, tint: 'text-violet-500' },
  { key: 'night', label: 'Night', Icon: Moon, tint: 'text-indigo-600' },
];

export default function MedicationsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [showAll, setShowAll] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery<MedData>({
    queryKey: ['medications'],
    queryFn: () => careApi.get<MedData>('/health/medications/today'),
  });

  const { mutate: toggleDose, isPending: toggling } = useMutation({
    mutationFn: ({ id, taken }: { id: string; taken: boolean }) =>
      careApi.patch(`/health/medications/doses/${id}`, { taken }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['medications'] });
      qc.invalidateQueries({ queryKey: ['health-today'] });
    },
    onError: (err: Error) => toast.error(err.message ?? 'Could not update dose.'),
  });

  const noDoses = data ? SLOTS.every((s) => data.todayDoses[s.key].length === 0) : false;

  return (
    <>
      <CareHeader
        title="Medications"
        back
        right={
          <Button
            size="sm"
            leadingIcon={<Plus className="w-4 h-4" />}
            onClick={() => router.push('/care/health/medications/add')}
          >
            Add
          </Button>
        }
      />

      <CareBody>
        {isLoading && <LoadingRows />}
        {isError && <ErrorRetry message="Could not load medications." onRetry={() => refetch()} />}

        {data && (
          <>
            {noDoses ? (
              <div className={cn(cardClass, 'p-8 flex flex-col items-center text-center mb-4')}>
                <div className="w-14 h-14 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center mb-3">
                  <Pill className="w-7 h-7" />
                </div>
                <p className="text-[14px] font-semibold text-gray-900 mb-1">No medications today</p>
                <p className="text-[13px] text-gray-500">Tap Add to register a medication.</p>
              </div>
            ) : (
              <>
                <h2 className="text-[15px] font-semibold text-gray-950 mb-3">Today&apos;s schedule</h2>
                {SLOTS.map((slot) => {
                  const doses = data.todayDoses[slot.key];
                  if (!doses || doses.length === 0) return null;
                  return (
                    <div key={slot.key} className="mb-5">
                      <div className="flex items-center gap-2 mb-2">
                        <slot.Icon className={cn('w-4 h-4', slot.tint)} />
                        <span className="text-[13px] font-semibold text-gray-500">{slot.label}</span>
                      </div>
                      <ul className="space-y-3">
                        {doses.map((dose) => (
                          <li key={dose.id}>
                            <button
                              onClick={() => toggleDose({ id: dose.id, taken: !dose.taken })}
                              disabled={toggling}
                              className={cn(cardClass, 'w-full px-4 py-3.5 flex items-center gap-3 text-left active:bg-gray-50 transition-colors disabled:opacity-60')}
                            >
                              <span
                                className={cn(
                                  'w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0',
                                  dose.taken ? 'border-primary-500 bg-primary-50' : 'border-gray-300',
                                )}
                              >
                                {dose.taken && <Check className="w-4 h-4 text-primary-600" />}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span
                                  className={cn(
                                    'block text-[14px] font-semibold text-gray-950 truncate',
                                    dose.taken && 'line-through opacity-60',
                                  )}
                                >
                                  {dose.name}
                                </span>
                                <span className="block text-[12px] text-gray-500">
                                  {dose.dosage} · {dose.time}
                                </span>
                              </span>
                              {dose.taken && (
                                <span className="text-[12px] font-medium text-primary-600 shrink-0">Taken</span>
                              )}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </>
            )}

            {/* All medications */}
            <button
              onClick={() => setShowAll((s) => !s)}
              className={cn(cardClass, 'w-full px-4 py-3.5 flex items-center justify-between mb-3')}
            >
              <span className="text-[14px] font-semibold text-gray-950">
                All medications ({data.allMedications.length})
              </span>
              {showAll ? (
                <ChevronUp className="w-4 h-4 text-primary-600" />
              ) : (
                <ChevronDown className="w-4 h-4 text-primary-600" />
              )}
            </button>

            {showAll && (
              <ul className="space-y-3">
                {data.allMedications.length === 0 ? (
                  <li className={cn(cardClass, 'px-4 py-4 text-center text-[13px] text-gray-500')}>
                    No medications registered yet.
                  </li>
                ) : (
                  data.allMedications.map((med) => (
                    <li key={med.id} className={cn(cardClass, 'px-4 py-3.5 flex items-center gap-3')}>
                      <span className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
                        <Pill className="w-5 h-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-semibold text-gray-950 truncate">{med.name}</p>
                        <p className="text-[12px] text-gray-500">
                          {med.dosage} · {med.frequency}
                        </p>
                        {med.times.length > 0 && (
                          <p className="text-[11px] text-gray-400 mt-0.5">Times: {med.times.join(', ')}</p>
                        )}
                      </div>
                    </li>
                  ))
                )}
              </ul>
            )}
          </>
        )}
      </CareBody>
    </>
  );
}
