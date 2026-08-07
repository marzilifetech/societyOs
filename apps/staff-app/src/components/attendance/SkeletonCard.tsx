/**
 * Attendance skeletons.
 *
 * These previously used `className="animate-pulse"`, which crashed every
 * screen that rendered them — see src/components/ui/Skeleton.tsx for the full
 * explanation. They are re-exported from the shared implementation so the two
 * cannot drift apart again.
 */
export { SkeletonCard, SkeletonRow } from '../ui/Skeleton';
