'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Car, X, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ErrorState } from '@/components/ui/ErrorState';

type SlotType = 'CAR' | 'BIKE' | 'EV' | 'VISITOR' | 'HANDICAPPED';
type SlotStatus = 'AVAILABLE' | 'OCCUPIED';

interface ParkingSlot {
  id: string;
  slotNumber: string;
  type: SlotType;
  isOccupied: boolean;
  vehicleNo?: string;
  resident?: {
    id: string;
    name: string;
    unit?: { flatNumber: string };
  };
}

interface ParkingAvailability {
  total: number;
  occupied: number;
  available: number;
}

const TYPE_COLORS: Record<string, string> = {
  CAR: 'bg-blue-100 text-blue-700',
  BIKE: 'bg-green-100 text-green-700',
  EV: 'bg-emerald-100 text-emerald-700',
  VISITOR: 'bg-purple-100 text-purple-700',
  HANDICAPPED: 'bg-amber-100 text-amber-700',
};

/**
 * Guest vehicles currently on site.
 *
 * Logging a guest previously wrote nothing anyone could see: the button posted
 * to a resident-only endpoint and there was no list. Occupancy now has a
 * lifecycle, so the gate can also mark a vehicle as departed and free the bay.
 */
function GuestParkingLog() {
  const qc = useQueryClient();
  const { data: guests = [], isLoading } = useQuery({
    queryKey: ['parking-guest-log'],
    queryFn: () =>
      api.get<
        Array<{
          id: string;
          vehiclePlate: string;
          visitorName: string | null;
          flatLabel: string | null;
          slot: { slotNumber: string } | null;
          entryAt: string;
          durationMinutes: number;
        }>
      >('/parking/admin/guest?active=true'),
    refetchInterval: 60_000,
  });

  const exitMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/parking/admin/guest/${id}/exit`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parking-guest-log'] });
      qc.invalidateQueries({ queryKey: ['parking-slots'] });
      qc.invalidateQueries({ queryKey: ['parking-availability'] });
      toast.success('Marked as departed. The bay is free again.');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Could not update the entry.'),
  });

  if (isLoading || guests.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-6 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">Guest vehicles on site</h2>
        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
          {guests.length}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['Vehicle', 'Visitor', 'Visiting', 'Bay', 'Parked for', ''].map((h, i) => (
                <th key={i} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {guests.map((g) => (
              <tr key={g.id} className="hover:bg-gray-50">
                <td className="px-5 py-3 font-medium text-gray-900">{g.vehiclePlate}</td>
                <td className="px-5 py-3 text-gray-600">{g.visitorName ?? '—'}</td>
                <td className="px-5 py-3 text-gray-600">{g.flatLabel ?? '—'}</td>
                <td className="px-5 py-3 text-gray-600">{g.slot?.slotNumber ?? 'Unassigned'}</td>
                <td className="px-5 py-3 text-gray-500">
                  {g.durationMinutes >= 60
                    ? `${Math.floor(g.durationMinutes / 60)}h ${g.durationMinutes % 60}m`
                    : `${g.durationMinutes}m`}
                </td>
                <td className="px-5 py-3">
                  <button
                    onClick={() => exitMutation.mutate(g.id)}
                    disabled={exitMutation.isPending}
                    className="text-xs border border-gray-200 hover:border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Mark departed
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GuestParkingModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ vehiclePlate: '', visitorName: '', flatLabel: '', notes: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const mutation = useMutation({
    // POST /parking/guest is @Roles(RESIDENT) and resolves a Resident profile
    // from the caller, so it 403'd for every admin — the "Log guest parking is
    // not functional" report. `/parking/admin/guest` is the gate-side endpoint.
    mutationFn: (data: typeof form) =>
      api.post<{ slotAssigned: boolean; slot: { slotNumber: string } | null }>('/parking/admin/guest', {
        vehiclePlate: data.vehiclePlate.trim(),
        visitorName: data.visitorName.trim() || undefined,
        flatLabel: data.flatLabel.trim() || undefined,
        notes: data.notes.trim() || undefined,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['parking-slots'] });
      qc.invalidateQueries({ queryKey: ['parking-availability'] });
      qc.invalidateQueries({ queryKey: ['parking-guest-log'] });
      toast.success(
        res?.slot?.slotNumber
          ? `Guest parking logged — bay ${res.slot.slotNumber}.`
          : 'Guest parking logged. No visitor bay was free, so none was assigned.',
      );
      onClose();
    },
    onError: (err: Error) => {
      setError(err.message ?? 'Failed to log guest parking');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.vehiclePlate.trim()) {
      setError('Vehicle plate is required');
      return;
    }
    setError('');
    mutation.mutate(form);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Log Guest Parking</h2>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Vehicle Plate *</label>
            <input
              type="text"
              placeholder="e.g. MH01AB1234"
              value={form.vehiclePlate}
              onChange={(e) => setForm((f) => ({ ...f, vehiclePlate: e.target.value.toUpperCase() }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Visitor Name</label>
            <input
              type="text"
              placeholder="Optional"
              value={form.visitorName}
              onChange={(e) => setForm((f) => ({ ...f, visitorName: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Visiting flat</label>
            <input
              type="text"
              placeholder="e.g. A-402 (optional)"
              value={form.flatLabel}
              onChange={(e) => setForm((f) => ({ ...f, flatLabel: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
            <input
              type="text"
              placeholder="Optional"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary-400"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 bg-primary-500 text-white text-sm font-medium py-2.5 rounded-xl hover:bg-primary-600 transition-colors disabled:opacity-50"
            >
              {mutation.isPending ? 'Submitting…' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ParkingPage() {
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'ALL' | SlotType>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | SlotStatus>('ALL');

  const { data: slots, isLoading, isError, refetch } = useQuery({
    queryKey: ['parking-slots'],
    queryFn: () => api.get<ParkingSlot[]>('/parking/slots'),
  });

  const { data: availability } = useQuery({
    queryKey: ['parking-availability'],
    queryFn: () => api.get<ParkingAvailability>('/parking/availability'),
  });

  const slotTypes: SlotType[] = ['CAR', 'BIKE', 'EV', 'VISITOR', 'HANDICAPPED'];

  const filtered = (slots ?? []).filter((s) => {
    if (typeFilter !== 'ALL' && s.type !== typeFilter) return false;
    if (statusFilter === 'AVAILABLE' && s.isOccupied) return false;
    if (statusFilter === 'OCCUPIED' && !s.isOccupied) return false;
    return true;
  });

  return (
    <div className="p-6 lg:p-8">
      {showGuestModal && <GuestParkingModal onClose={() => setShowGuestModal(false)} />}
      <GuestParkingLog />

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Parking</h1>
          <p className="text-gray-500 text-sm mt-1">{slots?.length ?? 0} total slots</p>
        </div>
        <button
          onClick={() => setShowGuestModal(true)}
          className="bg-primary-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary-600 transition-colors inline-flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Log Guest Parking
        </button>
      </div>

      {/* Availability summary */}
      {availability && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Total Visitor Slots', value: availability.total, color: 'text-gray-900' },
            { label: 'Occupied', value: availability.occupied, color: 'text-red-600' },
            { label: 'Available', value: availability.available, color: 'text-green-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
              <p className={cn('text-2xl font-bold mt-1', color)}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap items-center">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setTypeFilter('ALL')}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
              typeFilter === 'ALL'
                ? 'bg-primary-500 border-primary-500 text-white'
                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300',
            )}
          >
            All Types
          </button>
          {slotTypes.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                typeFilter === t
                  ? 'bg-primary-500 border-primary-500 text-white'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300',
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap ml-auto">
          {(['ALL', 'AVAILABLE', 'OCCUPIED'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                statusFilter === s
                  ? 'bg-primary-500 border-primary-500 text-white'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300',
              )}
            >
              {s === 'ALL' ? 'All Status' : s === 'AVAILABLE' ? 'Available' : 'Occupied'}
            </button>
          ))}
        </div>
      </div>

      {/* Slots table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden overflow-x-auto">
        {isLoading ? (
          <div className="py-16 text-center text-gray-400">Loading…</div>
        ) : isError ? (
          <ErrorState onRetry={refetch} message="Parking data couldn't be loaded. Your data is safe — please try again." />
        ) : !filtered.length ? (
          <div className="py-16 flex flex-col items-center justify-center text-center">
            <Car className="w-10 h-10 text-gray-300 mb-3" />
            <p className="font-medium text-gray-700">No parking slots</p>
            <p className="text-sm text-gray-400 mt-1">Slots matching the current filters will appear here.</p>
            <button
              onClick={() => { setTypeFilter('ALL'); setStatusFilter('ALL'); }}
              className="mt-4 text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {['Slot', 'Type', 'Status', 'Vehicle', 'Assigned Resident', 'Flat', 'Action'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((slot) => (
                <tr key={slot.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">{slot.slotNumber}</td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', TYPE_COLORS[slot.type] ?? 'bg-gray-100 text-gray-600')}>
                      {slot.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'text-xs font-medium px-2.5 py-1 rounded-full',
                      slot.isOccupied ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700',
                    )}>
                      {slot.isOccupied ? 'Occupied' : 'Available'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{slot.vehicleNo ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{slot.resident?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{slot.resident?.unit?.flatNumber ?? '—'}</td>
                  <td className="px-4 py-3">
                    {!slot.isOccupied && (
                      <button
                        onClick={() => setShowGuestModal(true)}
                        className="text-xs bg-purple-100 hover:bg-purple-200 text-purple-700 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Guest Park
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
