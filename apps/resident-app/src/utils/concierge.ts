/**
 * Concierge / help-request status helpers.
 *
 * Backend ConciergeStatus: PENDING | ASSIGNED | ACCEPTED | IN_PROGRESS |
 * COMPLETED | CANCELLED. Everything that hasn't finished is "active" — the
 * screens used to treat a brand-new (PENDING) or ACCEPTED request as neither
 * active nor past.
 */

export type ConciergeTone = 'pending' | 'active' | 'resolved' | 'cancelled' | 'neutral';

const norm = (status: string | null | undefined) => String(status ?? '').toUpperCase();

export function isConciergeCompleted(status: string | null | undefined): boolean {
  return norm(status) === 'COMPLETED';
}

export function isConciergeCancelled(status: string | null | undefined): boolean {
  const s = norm(status);
  return s === 'CANCELLED' || s === 'CANCELED';
}

export function isConciergeActive(status: string | null | undefined): boolean {
  return !isConciergeCompleted(status) && !isConciergeCancelled(status);
}

export function conciergeStatus(status: string | null | undefined): { tone: ConciergeTone; label: string } {
  switch (norm(status)) {
    case 'PENDING':
      return { tone: 'pending', label: 'Requested' };
    case 'ASSIGNED':
      return { tone: 'active', label: 'Assigned' };
    case 'ACCEPTED':
      return { tone: 'active', label: 'Accepted' };
    case 'IN_PROGRESS':
      return { tone: 'active', label: 'In Progress' };
    case 'COMPLETED':
      return { tone: 'resolved', label: 'Completed' };
    case 'CANCELLED':
    case 'CANCELED':
      return { tone: 'cancelled', label: 'Cancelled' };
    default:
      return { tone: 'neutral', label: status ? String(status) : 'Unknown' };
  }
}

/**
 * Tracker step for a status: 0 Requested (PENDING), 1 Assigned (ASSIGNED /
 * ACCEPTED), 2 On the way (IN_PROGRESS), 3 Completed.
 */
export function conciergeStepIndex(status: string | null | undefined): number {
  switch (norm(status)) {
    case 'COMPLETED':
      return 3;
    case 'IN_PROGRESS':
      return 2;
    case 'ASSIGNED':
    case 'ACCEPTED':
      return 1;
    default:
      return 0;
  }
}

const TYPE_LABELS: Record<string, string> = {
  TAXI: 'Cab Booking',
  COURIER: 'Package Pickup',
  PHARMACY: 'Pharmacy',
  FORM_HELP: 'Document Help',
  OTHER: 'Other Help',
};

/** Human label for a ConciergeRequestType (falls back to the raw value). */
export function conciergeTypeLabel(type: string | null | undefined): string {
  if (!type) return 'Request';
  return TYPE_LABELS[norm(type)] ?? String(type);
}
