import type { Ionicons } from '@expo/vector-icons';
import type { ResidentBrief } from '@societyos/api-client';
import { getUnwrapped, getUnwrappedArray } from './unwrapped-get';

/**
 * A resident's help request (a concierge request) as staff see it. The
 * screens used to expect `resident.flat` as a string and rendered the object
 * the API sends straight into <Text>, which crashes React Native.
 */
export interface HelpRequestRow {
  id: string;
  type: 'TAXI' | 'COURIER' | 'PHARMACY' | 'FORM_HELP' | 'OTHER' | string;
  status: 'PENDING' | 'ASSIGNED' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | string;
  description: string;
  /** Set when a staff member has it. The list only ever contains mine or unassigned ones. */
  assignedStaffId: string | null;
  scheduledTime?: string | null;
  completionNotes?: string | null;
  createdAt: string;
  resident?: ResidentBrief | null;
}

export const HELP_REQUESTS_KEY = ['help-requests'] as const;
export const helpRequestKey = (id: string | undefined) => ['help-request', id] as const;

export const fetchHelpRequests = () => getUnwrappedArray<HelpRequestRow>('/staff/help-requests');
export const fetchHelpRequest = (id: string) =>
  getUnwrapped<HelpRequestRow>(`/staff/help-requests/${encodeURIComponent(id)}`);

export const HELP_TYPE_LABELS: Record<string, string> = {
  TAXI: 'Taxi / cab',
  COURIER: 'Parcel or courier',
  PHARMACY: 'Pharmacy run',
  FORM_HELP: 'Forms & documents',
  OTHER: 'Other help',
};

export const HELP_TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  TAXI: 'car-outline',
  COURIER: 'cube-outline',
  PHARMACY: 'medkit-outline',
  FORM_HELP: 'document-text-outline',
  OTHER: 'help-buoy-outline',
};

export function helpTypeLabel(type: string): string {
  return HELP_TYPE_LABELS[type] ?? type;
}

/** Open and waiting for someone to take it. */
export const isUnclaimed = (r: HelpRequestRow) => r.status === 'PENDING' && !r.assignedStaffId;
/** Taken by me and not finished. */
export const isMineActive = (r: HelpRequestRow) =>
  !!r.assignedStaffId && ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'].includes(r.status);
