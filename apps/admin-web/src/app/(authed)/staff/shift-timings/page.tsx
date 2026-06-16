'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button, Input, Field, Card } from '@/components/primitives';

/**
 * Society-wide shift-timing templates.
 *
 * Stored at `society.config.shiftTemplates` so we avoid a Prisma migration
 * and reuse the existing PATCH /admin/society endpoint (it already shallow-
 * merges any `config` object passed in). Other features (attendance, late-
 * mark logic, staff app's shift screen) can read these via GET /admin/society
 * → config.shiftTemplates once we wire them up — for v1 this page is the
 * single source of truth and nothing else reads it yet.
 *
 * Kept deliberately simple per the user's ask:
 *   - Flat list of cards. Add / remove / edit inline. One Save button.
 *   - Three preset buttons (Morning / Evening / Night) that pre-fill sensible
 *     times so a first-time admin can ship a complete config in three taps.
 *   - Native time inputs (HTML <input type="time">) — no library, no popup,
 *     keyboard-friendly, works on every browser admins will use.
 *   - 24-hour format is what the backend's existing Shift.startTime stores
 *     ("HH:MM" strings — see backend/prisma/schema.prisma).
 */

type ShiftTemplate = {
  id: string;
  name: string;
  startTime: string; // "HH:MM" 24h
  endTime: string;
};

type SocietyConfig = {
  shiftTemplates?: ShiftTemplate[];
  [k: string]: unknown;
};

type Society = {
  id: string;
  name: string;
  config?: SocietyConfig | null;
};

const PRESETS: Array<Omit<ShiftTemplate, 'id'>> = [
  { name: 'Morning', startTime: '06:00', endTime: '14:00' },
  { name: 'Evening', startTime: '14:00', endTime: '22:00' },
  { name: 'Night',   startTime: '22:00', endTime: '06:00' },
];

const MAX_TEMPLATES = 6;

function uid(): string {
  // Plenty unique within a settings list; we don't need crypto-grade entropy.
  return `sh_${Math.random().toString(36).slice(2, 9)}`;
}

function isValidHHMM(v: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}

export default function ShiftTimingsPage() {
  const qc = useQueryClient();

  const { data: society, isLoading } = useQuery<Society>({
    queryKey: ['admin-society-shift-templates'],
    queryFn: () => api.get<Society>('/admin/society'),
  });

  const [rows, setRows] = useState<ShiftTemplate[]>([]);
  const [dirty, setDirty] = useState(false);

  // Hydrate local state once when the society payload arrives. We keep an
  // editable working-copy so the admin can experiment freely without us
  // PATCHing on every keystroke.
  useEffect(() => {
    if (!society) return;
    const templates = society.config?.shiftTemplates ?? [];
    setRows(templates);
    setDirty(false);
  }, [society]);

  const presetsAvailable = useMemo(
    () => PRESETS.filter((p) => !rows.some((r) => r.name.toLowerCase() === p.name.toLowerCase())),
    [rows],
  );

  const updateRow = (id: string, patch: Partial<ShiftTemplate>) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setDirty(true);
  };

  const removeRow = (id: string) => {
    setRows((rs) => rs.filter((r) => r.id !== id));
    setDirty(true);
  };

  const addEmpty = () => {
    if (rows.length >= MAX_TEMPLATES) return;
    setRows((rs) => [...rs, { id: uid(), name: '', startTime: '09:00', endTime: '17:00' }]);
    setDirty(true);
  };

  const addPreset = (p: Omit<ShiftTemplate, 'id'>) => {
    if (rows.length >= MAX_TEMPLATES) return;
    setRows((rs) => [...rs, { id: uid(), ...p }]);
    setDirty(true);
  };

  const save = useMutation({
    mutationFn: async (templates: ShiftTemplate[]) => {
      return api.patch('/admin/society', {
        config: { shiftTemplates: templates },
      });
    },
    onSuccess: () => {
      toast.success('Shift timings saved');
      setDirty(false);
      qc.invalidateQueries({ queryKey: ['admin-society-shift-templates'] });
      qc.invalidateQueries({ queryKey: ['admin-society-context'] });
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Could not save shift timings');
    },
  });

  const handleSave = () => {
    // Drop empty/half-filled rows BEFORE validation rather than block on them —
    // the admin may have clicked "Add" by accident and just wants to save what's
    // valid. Anything with a name and two well-formed times survives.
    const cleaned = rows.filter(
      (r) =>
        r.name.trim().length > 0 &&
        isValidHHMM(r.startTime) &&
        isValidHHMM(r.endTime),
    );
    const duplicateNames =
      new Set(cleaned.map((r) => r.name.trim().toLowerCase())).size !== cleaned.length;
    if (duplicateNames) {
      toast.error('Two shifts share the same name — rename one to save.');
      return;
    }
    save.mutate(cleaned);
  };

  return (
    <div className="px-6 py-6 max-w-3xl">
      <div className="flex items-center gap-2 mb-1">
        <Clock className="w-5 h-5 text-primary-600" />
        <h1 className="text-xl font-bold text-gray-900">Shift Timings</h1>
      </div>
      <p className="text-sm text-gray-600 mb-6">
        Define the shift windows used across staff attendance and rostering.
        Times are in 24-hour format.
      </p>

      {isLoading ? (
        <Card className="p-6 text-sm text-gray-500">Loading shift timings…</Card>
      ) : (
        <>
          {rows.length === 0 ? (
            <Card className="p-6 text-sm text-gray-600 mb-3">
              No shift timings yet. Pick a preset below or add a custom one.
            </Card>
          ) : (
            <div className="space-y-3 mb-3">
              {rows.map((row) => (
                <ShiftRow
                  key={row.id}
                  row={row}
                  onChange={(patch) => updateRow(row.id, patch)}
                  onRemove={() => removeRow(row.id)}
                />
              ))}
            </div>
          )}

          {/* Preset chips — one-tap add for the common shift names. Hidden
              once the admin has all three presets in the list. */}
          {presetsAvailable.length > 0 && rows.length < MAX_TEMPLATES && (
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-[12px] text-gray-500 font-medium mr-1">
                Quick add:
              </span>
              {presetsAvailable.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => addPreset(p)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium bg-primary-50 text-primary-700 border border-primary-100 hover:bg-primary-100"
                >
                  <Plus className="w-3 h-3" />
                  {p.name} ({p.startTime}–{p.endTime})
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={addEmpty}
              disabled={rows.length >= MAX_TEMPLATES}
              leadingIcon={<Plus className="w-4 h-4" />}
            >
              Add custom shift
            </Button>
            {rows.length >= MAX_TEMPLATES && (
              <span className="text-[11px] text-gray-500">
                Maximum {MAX_TEMPLATES} shifts.
              </span>
            )}
          </div>

          <div className="border-t border-gray-200 mt-6 pt-4 flex items-center justify-between">
            <span className="text-[12px] text-gray-500">
              {dirty ? 'You have unsaved changes.' : 'All changes saved.'}
            </span>
            <Button
              variant="primary"
              onClick={handleSave}
              loading={save.isPending}
              disabled={!dirty || save.isPending}
            >
              Save shift timings
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function ShiftRow({
  row,
  onChange,
  onRemove,
}: {
  row: ShiftTemplate;
  onChange: (patch: Partial<ShiftTemplate>) => void;
  onRemove: () => void;
}) {
  return (
    <Card className="p-4">
      <div className="grid grid-cols-12 gap-3 items-end">
        <div className="col-span-12 md:col-span-5">
          <Field label="Shift name">
            <Input
              value={row.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="e.g. Morning"
              maxLength={40}
            />
          </Field>
        </div>
        <div className="col-span-5 md:col-span-3">
          <Field label="Start time">
            <Input
              type="time"
              value={row.startTime}
              onChange={(e) => onChange({ startTime: e.target.value })}
            />
          </Field>
        </div>
        <div className="col-span-5 md:col-span-3">
          <Field label="End time">
            <Input
              type="time"
              value={row.endTime}
              onChange={(e) => onChange({ endTime: e.target.value })}
            />
          </Field>
        </div>
        <div className="col-span-2 md:col-span-1 flex md:justify-end">
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove shift"
            className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </Card>
  );
}
