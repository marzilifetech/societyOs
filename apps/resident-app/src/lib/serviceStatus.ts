export const STATUS_STEPS = ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED'];

export const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: 'Pending', color: 'text-blue-700', bg: 'bg-blue-100' },
  ASSIGNED: { label: 'Assigned', color: 'text-purple-700', bg: 'bg-purple-100' },
  IN_PROGRESS: { label: 'In Progress', color: 'text-amber-700', bg: 'bg-amber-100' },
  COMPLETED: { label: 'Completed', color: 'text-green-700', bg: 'bg-green-100' },
  REJECTED: { label: 'Rejected', color: 'text-red-700', bg: 'bg-red-100' },
  CLOSED: { label: 'Closed', color: 'text-gray-600', bg: 'bg-gray-100' },
};

export function canRate(status: string, hasRating: boolean) {
  return status === 'COMPLETED' && !hasRating;
}

export function canConfirmOrDispute(status: string, hasConfirmed: boolean) {
  return status === 'COMPLETED' && !hasConfirmed;
}
