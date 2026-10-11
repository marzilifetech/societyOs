/**
 * Visitor approval helpers.
 *
 * Visitor.status: EXPECTED | CHECKED_IN | CHECKED_OUT | DENIED | EXPIRED.
 * Visitor.approvalStatus: PENDING | APPROVED | REJECTED | LEFT_AT_SECURITY.
 * POST /visitors/:id/decision returns { decision, applied, visitor } —
 * applied=false means an earlier decision (yours, another family member's or
 * the guard's) already won and `decision` is that earlier one.
 */

export type VisitorLike = { status?: string | null; approvalStatus?: string | null };
export type Message = { title: string; body: string };

const up = (s: string | null | undefined) => String(s ?? '').toUpperCase();

/** A decision is only meaningful while the request is pending and the visitor isn't in/out. */
export function canDecideVisitor(v: VisitorLike): boolean {
  const approval = v.approvalStatus == null ? 'PENDING' : up(v.approvalStatus);
  const status = up(v.status);
  return approval === 'PENDING' && !['CHECKED_IN', 'CHECKED_OUT', 'DENIED', 'EXPIRED'].includes(status);
}

/** What has already happened to a visitor that can no longer be decided on. */
export function visitorSettledMessage(v: VisitorLike): Message {
  switch (up(v.status)) {
    case 'CHECKED_IN':
      return { title: 'Already inside', body: 'This visitor has already been checked in at the gate.' };
    case 'CHECKED_OUT':
      return { title: 'Visit ended', body: 'This visitor has already checked out.' };
    case 'EXPIRED':
      return { title: 'Request expired', body: 'This visitor request has expired.' };
    case 'DENIED':
      return { title: 'Entry denied', body: 'Entry was denied for this visitor.' };
  }
  return decisionMessage(up(v.approvalStatus), true);
}

/** Message for a decision result (or an existing decision). */
export function decisionMessage(decision: string | null | undefined, applied: boolean): Message {
  const d = up(decision);
  const done: Message =
    d === 'APPROVED'
      ? { title: 'Entry Approved', body: 'Security has been notified to let them in.' }
      : d === 'LEFT_AT_SECURITY'
      ? { title: 'Leave at Security', body: 'Security will keep the package at the desk.' }
      : d === 'REJECTED'
      ? { title: 'Entry Denied', body: 'Security has been notified to deny entry.' }
      : { title: 'Decision recorded', body: 'Security has been notified.' };
  if (applied) return done;
  const what =
    d === 'APPROVED' ? 'approved' : d === 'LEFT_AT_SECURITY' ? 'left at security' : d === 'REJECTED' ? 'denied' : 'decided';
  return {
    title: 'Already decided',
    body: `This visitor was already ${what}, so your choice wasn't applied.`,
  };
}

/**
 * Whether a visitor's gate pass can still be used: the visit hasn't started
 * or ended, it wasn't rejected (or turned into a leave-at-security drop) and
 * its validUntil, if any, is still ahead.
 */
export function isGatePassUsable(
  v: VisitorLike & { validUntil?: string | null },
  now: number = Date.now(),
): boolean {
  if (up(v.status) !== 'EXPECTED') return false;
  if (['REJECTED', 'LEFT_AT_SECURITY'].includes(up(v.approvalStatus))) return false;
  if (v.validUntil) {
    const until = new Date(v.validUntil).getTime();
    if (!isNaN(until) && until <= now) return false;
  }
  return true;
}
