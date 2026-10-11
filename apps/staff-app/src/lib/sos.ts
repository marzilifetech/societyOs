import { getUnwrappedArray } from './unwrapped-get';

/** One open SOS alert, as `GET /sos/active` returns it to responders. */
export type SosAlertRow = {
  id: string;
  status: 'ACTIVE' | 'ACKNOWLEDGED';
  lat: number | null;
  lng: number | null;
  note: string | null;
  createdAt: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  resident: {
    id: string;
    name: string | null;
    phone: string | null;
    role: string;
    resident: { flat: { block: string | null; number: string } | null } | null;
    staffMember: { designation: string } | null;
  } | null;
};

/** Shared by the alerts screen and Home's banner so both stay in step. */
export const SOS_ACTIVE_KEY = ['sos', 'active'] as const;

export function fetchActiveSos(): Promise<SosAlertRow[]> {
  return getUnwrappedArray<SosAlertRow>('/sos/active');
}

/** "B-204", or null when the person has no flat (e.g. staff). */
export function flatLabel(alert: SosAlertRow): string | null {
  const flat = alert.resident?.resident?.flat;
  if (!flat) return null;
  return [flat.block, flat.number].filter(Boolean).join('-');
}
