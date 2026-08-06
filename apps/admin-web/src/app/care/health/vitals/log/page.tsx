'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { careApi } from '@/lib/care-api';
import { CareHeader, CareBody } from '@/components/care/chrome';
import { Button, Field, Textarea, cn } from '@/components/primitives';
import { VITAL_META, VITAL_TYPES, isVitalType, type VitalType } from '../../_components';

function LogVitalInner() {
  const router = useRouter();
  const qc = useQueryClient();
  const params = useSearchParams();
  const initial = params.get('type');

  const [type, setType] = useState<VitalType>(isVitalType(initial) ? initial : 'bp');
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');
  const meta = VITAL_META[type];

  const { mutate, isPending } = useMutation({
    mutationFn: () => careApi.post('/health/vitals', { type, value: value.trim(), notes: notes.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vitals'] });
      qc.invalidateQueries({ queryKey: ['vitals-history'] });
      qc.invalidateQueries({ queryKey: ['health-today'] });
      toast.success('Reading saved');
      router.back();
    },
    onError: (err: Error) => toast.error(err.message ?? 'Could not save reading.'),
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) {
      toast.error('Please enter a value.');
      return;
    }
    mutate();
  };

  return (
    <>
      <CareHeader title="Log reading" back />

      <CareBody>
        <form onSubmit={onSubmit} className="space-y-6">
          {/* Vital type */}
          <div>
            <p className="text-[13px] font-medium text-gray-800 mb-2">Vital type</p>
            <div className="grid grid-cols-2 gap-2">
              {VITAL_TYPES.map((t) => {
                const m = VITAL_META[t];
                const active = type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setType(t);
                      setValue('');
                    }}
                    className={cn(
                      'h-11 rounded-xl border flex items-center justify-center gap-2 transition-colors',
                      active
                        ? 'bg-primary-600 border-primary-600 text-white'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300',
                    )}
                  >
                    <m.Icon className="w-4 h-4" />
                    <span className="text-[13px] font-semibold">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Value */}
          <Field
            label="Reading"
            required
            hint={type === 'bp' ? 'Enter as systolic/diastolic, e.g. 120/80' : undefined}
          >
            <div className="flex h-12 rounded-xl border border-gray-300 bg-white focus-within:border-primary-500 focus-within:ring-4 focus-within:ring-primary-100 overflow-hidden">
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={meta.placeholder}
                inputMode={type === 'bp' ? 'text' : 'decimal'}
                className="flex-1 px-4 text-[18px] font-bold text-gray-900 outline-none"
                autoFocus
              />
              <span className="px-4 flex items-center text-[13px] text-gray-500 bg-gray-50 border-l border-gray-200">
                {meta.unit}
              </span>
            </div>
          </Field>

          {/* Notes */}
          <Field label="Notes" hint="Optional">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any context or notes…"
              rows={3}
            />
          </Field>

          <Button type="submit" fullWidth loading={isPending} className="h-12 rounded-xl">
            {isPending ? 'Saving…' : 'Save reading'}
          </Button>
        </form>
      </CareBody>
    </>
  );
}

export default function LogVitalPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <LogVitalInner />
    </Suspense>
  );
}
