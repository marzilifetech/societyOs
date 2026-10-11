import { useEffect } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { subscribe } from '../lib/socket';

/**
 * Server events → the cached screens they make stale.
 *
 * Realtime only keeps open screens current; it never interrupts. Several of
 * these arrive on the SOCIETY room (an emergency broadcast, a complaint or a
 * visitor at another flat — see RealtimeGateway.emitToSociety), and they used
 * to pop an Alert over whatever the resident was doing, for events that
 * weren't theirs. Anything the resident must act on reaches them as a push,
 * which the in-app banner already shows.
 */
const STALE_ON: Record<string, QueryKey[]> = {
  'visitor:arrived': [['my-visitors'], ['visitor']],
  'package:arrived': [['packages']],
  'complaint:updated': [['my-complaints'], ['complaint']],
  'service-request:updated': [['my-service-requests'], ['service-request']],
  'help:completed': [['help-request']],
  'maintenance:due': [['maintenance-bills'], ['bill']],
  'emergency:broadcast': [['notices'], ['notices-summary'], ['notices-pinned'], ['notice']],
};

/** Keeps cached data in step with server events while signed in. */
export function useRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribes = Object.entries(STALE_ON).map(([event, keys]) =>
      subscribe(event, () => {
        for (const queryKey of keys) void queryClient.invalidateQueries({ queryKey });
      }),
    );
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [queryClient]);
}
