type GuardQueryState = {
  isError: boolean;
  isFetching: boolean;
  error: unknown;
};

/**
 * Whether the tabs guard should send the resident back to pending approval:
 * only when the LATEST check found no Resident row (a 404).
 *
 * `!isFetching` matters. React Query keeps a failed result in its cache, and
 * re-entering the tabs shows that cached error while the refetch is still in
 * flight. A resident who had just finished profile setup was bounced on the
 * old 404 straight back to pending approval, which sent them to the tabs
 * again — the first screen visibly loading over and over until the refetch
 * finally won. Acting only on a settled result breaks that loop.
 *
 * Any other failure (offline, 5xx, a 401 that the API layer is already
 * handling) must not bounce either; see the guard's own comment.
 */
export function isResidentProfileMissing({ isError, isFetching, error }: GuardQueryState): boolean {
  if (!isError || isFetching) return false;
  return (error as { status?: number } | null)?.status === 404;
}
