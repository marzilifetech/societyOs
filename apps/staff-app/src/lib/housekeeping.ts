import type { ResidentBrief } from '@societyos/api-client';
import { getUnwrapped, unwrapList } from './unwrapped-get';

/** A housekeeping job assigned to this staff member. */
export interface HousekeepingJob {
  id: string;
  type: string;
  status: 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | string;
  scheduledAt: string;
  notes?: string | null;
  resident?: (ResidentBrief & { name?: string | null; unit?: { flatNumber: string | null } }) | null;
}

export const HOUSEKEEPING_KEY = ['housekeeping', 'mine'] as const;

/** GET /housekeeping returns only the caller's assignments for staff. */
export const fetchMyHousekeeping = () => unwrapList<HousekeepingJob>('/housekeeping?limit=50');

export const fetchHousekeepingJob = (id: string) =>
  getUnwrapped<HousekeepingJob>(`/housekeeping/${encodeURIComponent(id)}`);

export function housekeepingTypeLabel(type: string): string {
  return type.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}
