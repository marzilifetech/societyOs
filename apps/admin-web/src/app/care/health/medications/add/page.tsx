'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { careApi } from '@/lib/care-api';
import { CareHeader, CareBody } from '@/components/care/chrome';
import { Button, Field, Input, cn } from '@/components/primitives';

type Frequency = 'once' | 'twice' | 'thrice' | 'custom';

const FREQ_OPTIONS: { key: Frequency; label: string; slots: number }[] = [
  { key: 'once', label: 'Once daily', slots: 1 },
  { key: 'twice', label: 'Twice daily', slots: 2 },
  { key: 'thrice', label: 'Thrice daily', slots: 3 },
  { key: 'custom', label: 'Custom', slots: 4 },
];

const SLOT_NAMES = ['Morning', 'Afternoon', 'Evening', 'Night'];

export default function AddMedicationPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('once');
  const [times, setTimes] = useState<string[]>(['08:00', '', '', '']);

  const selectedFreq = FREQ_OPTIONS.find((f) => f.key === frequency)!;

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      careApi.post('/health/medications', {
        name: name.trim(),
        dosage: dosage.trim(),
        frequency,
        times: times.slice(0, selectedFreq.slots).filter(Boolean),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['medications'] });
      qc.invalidateQueries({ queryKey: ['health-today'] });
      toast.success('Medication added');
      router.back();
    },
    onError: (err: Error) => toast.error(err.message ?? 'Could not add medication.'),
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Please enter a medication name.');
      return;
    }
    if (!dosage.trim()) {
      toast.error('Please enter a dosage.');
      return;
    }
    mutate();
  };

  return (
    <>
      <CareHeader title="Add medication" back />

      <CareBody>
        <form onSubmit={onSubmit} className="space-y-5">
          <Field label="Medication name" required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Metformin"
              className="h-12 rounded-xl"
              autoFocus
            />
          </Field>

          <Field label="Dosage" required>
            <Input
              value={dosage}
              onChange={(e) => setDosage(e.target.value)}
              placeholder="e.g. 500mg"
              className="h-12 rounded-xl"
            />
          </Field>

          <div>
            <p className="text-[13px] font-medium text-gray-800 mb-2">Frequency</p>
            <div className="grid grid-cols-2 gap-2">
              {FREQ_OPTIONS.map((f) => {
                const active = frequency === f.key;
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFrequency(f.key)}
                    className={cn(
                      'h-11 rounded-xl border text-[13px] font-semibold transition-colors',
                      active
                        ? 'bg-primary-600 border-primary-600 text-white'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300',
                    )}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-[13px] font-medium text-gray-800 mb-2">Dose times</p>
            <div className="space-y-3">
              {Array.from({ length: selectedFreq.slots }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-24 text-[13px] text-gray-500">{SLOT_NAMES[i]}</span>
                  <input
                    type="time"
                    value={times[i] ?? ''}
                    onChange={(e) => {
                      const next = [...times];
                      next[i] = e.target.value;
                      setTimes(next);
                    }}
                    className="flex-1 h-12 px-3 rounded-xl border border-gray-300 bg-white text-[14px] text-gray-900 outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-100"
                  />
                </div>
              ))}
            </div>
          </div>

          <Button type="submit" fullWidth loading={isPending} className="h-12 rounded-xl">
            {isPending ? 'Saving…' : 'Save medication'}
          </Button>
        </form>
      </CareBody>
    </>
  );
}
