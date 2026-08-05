/**
 * Single source of truth for status → capsule-chip colour pairs.
 *
 * Every entry carries a light+dark tailwind class pair so chips render
 * correctly in both themes. This absorbs the previously divergent maps in
 * app/(tabs)/index.tsx, app/(tabs)/tasks.tsx, app/tasks/[id]/index.tsx,
 * app/attendance/shifts.tsx, app/welfare/index.tsx and the visitor status
 * badges in RecentGateActivitySheet.
 *
 * Screens with i18n pass their own label to <StatusChip>; the `label` here
 * is the English fallback for screens that never had translated labels.
 */

export type StatusTone = {
  /** Capsule background — light + dark pair. */
  bg: string;
  /** Label colour — light + dark pair. */
  text: string;
  /** Default English label (used when the call site has no i18n label). */
  label?: string;
};

export type TaskStatus =
  | 'PENDING'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'REJECTED'
  | 'DISPUTED';

export const TASK_STATUS_TONES: Record<TaskStatus, StatusTone> = {
  PENDING: {
    bg: 'bg-blue-100 dark:bg-blue-950/60',
    text: 'text-blue-700 dark:text-blue-300',
    label: 'Pending',
  },
  ASSIGNED: {
    bg: 'bg-purple-100 dark:bg-purple-950/60',
    text: 'text-purple-700 dark:text-purple-300',
    label: 'Assigned',
  },
  IN_PROGRESS: {
    bg: 'bg-amber-100 dark:bg-amber-950/60',
    text: 'text-amber-700 dark:text-amber-300',
    label: 'In Progress',
  },
  COMPLETED: {
    bg: 'bg-green-100 dark:bg-green-950/60',
    text: 'text-green-700 dark:text-green-300',
    label: 'Completed',
  },
  REJECTED: {
    bg: 'bg-red-100 dark:bg-red-950/60',
    text: 'text-red-700 dark:text-red-300',
    label: 'Rejected',
  },
  DISPUTED: {
    bg: 'bg-red-100 dark:bg-red-950/60',
    text: 'text-red-700 dark:text-red-300',
    label: 'Disputed',
  },
};

export type VisitorApprovalStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'CHECKED_IN'
  | 'LEFT_AT_SECURITY'
  | 'REJECTED'
  | 'DENIED'
  | 'CHECKED_OUT';

export const VISITOR_STATUS_TONES: Record<VisitorApprovalStatus, StatusTone> = {
  PENDING: {
    bg: 'bg-amber-100 dark:bg-amber-950/60',
    text: 'text-amber-800 dark:text-amber-300',
    label: 'Awaiting',
  },
  APPROVED: {
    bg: 'bg-green-100 dark:bg-green-950/60',
    text: 'text-green-700 dark:text-green-300',
    label: 'Approved',
  },
  CHECKED_IN: {
    bg: 'bg-green-100 dark:bg-green-950/60',
    text: 'text-green-700 dark:text-green-300',
    label: 'Approved',
  },
  LEFT_AT_SECURITY: {
    bg: 'bg-orange-100 dark:bg-orange-950/60',
    text: 'text-orange-800 dark:text-orange-300',
    label: 'At security',
  },
  REJECTED: {
    bg: 'bg-red-100 dark:bg-red-950/60',
    text: 'text-red-700 dark:text-red-300',
    label: 'Rejected',
  },
  DENIED: {
    bg: 'bg-red-100 dark:bg-red-950/60',
    text: 'text-red-700 dark:text-red-300',
    label: 'Rejected',
  },
  CHECKED_OUT: {
    bg: 'bg-gray-100 dark:bg-gray-800',
    text: 'text-gray-600 dark:text-gray-300',
    label: 'Left',
  },
};

export type ShiftStatus = 'SCHEDULED' | 'COMPLETED' | 'MISSED';

export const SHIFT_STATUS_TONES: Record<ShiftStatus, StatusTone> = {
  SCHEDULED: {
    bg: 'bg-blue-100 dark:bg-blue-950/60',
    text: 'text-blue-700 dark:text-blue-300',
    label: 'Scheduled',
  },
  COMPLETED: {
    bg: 'bg-green-100 dark:bg-green-950/60',
    text: 'text-green-700 dark:text-green-300',
    label: 'Completed',
  },
  MISSED: {
    bg: 'bg-red-100 dark:bg-red-950/60',
    text: 'text-red-700 dark:text-red-300',
    label: 'Missed',
  },
};

export type NoticeCategory = 'WELFARE' | 'POLICY' | 'SAFETY' | 'SCHEDULE';

export const NOTICE_CATEGORY_TONES: Record<NoticeCategory, StatusTone> = {
  WELFARE: {
    bg: 'bg-green-100 dark:bg-green-950/60',
    text: 'text-green-700 dark:text-green-300',
    label: 'Welfare',
  },
  POLICY: {
    bg: 'bg-primary-50 dark:bg-primary-900/50',
    text: 'text-primary-500 dark:text-primary-200',
    label: 'Policy',
  },
  SAFETY: {
    bg: 'bg-red-100 dark:bg-red-950/60',
    text: 'text-red-700 dark:text-red-300',
    label: 'Safety',
  },
  SCHEDULE: {
    bg: 'bg-amber-100 dark:bg-amber-950/60',
    text: 'text-amber-700 dark:text-amber-300',
    label: 'Schedule',
  },
};

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export const PRIORITY_TONES: Record<Priority, StatusTone> = {
  LOW: {
    bg: 'bg-gray-100 dark:bg-gray-800',
    text: 'text-gray-600 dark:text-gray-300',
    label: 'Low',
  },
  MEDIUM: {
    bg: 'bg-blue-100 dark:bg-blue-950/60',
    text: 'text-blue-700 dark:text-blue-300',
    label: 'Medium',
  },
  HIGH: {
    bg: 'bg-amber-100 dark:bg-amber-950/60',
    text: 'text-amber-800 dark:text-amber-300',
    label: 'High',
  },
  URGENT: {
    bg: 'bg-red-100 dark:bg-red-950/60',
    text: 'text-red-700 dark:text-red-300',
    label: 'Urgent',
  },
};

/** Look up a tone with a safe fallback so unknown backend values never crash a chip. */
export function toneFor<K extends string>(
  map: Record<K, StatusTone>,
  key: string | null | undefined,
  fallback: K,
): StatusTone {
  return (map as Record<string, StatusTone>)[key ?? ''] ?? map[fallback];
}
