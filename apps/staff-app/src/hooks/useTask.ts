import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ServiceRequest } from '@societyos/api-client';
import { getUnwrapped } from '../lib/unwrapped-get';

export const taskKey = (id: string | undefined) => ['task', id] as const;

/** One task, typed. Shared by the task detail, start, complete and dispute screens. */
export function useTask(id: string | undefined) {
  return useQuery({
    queryKey: taskKey(id),
    queryFn: () => getUnwrapped<ServiceRequest>(`/service-requests/${encodeURIComponent(id!)}`),
    enabled: !!id,
  });
}

/** Refresh a task and the task lists after it changed. */
export function useRefreshTask(id: string | undefined) {
  const qc = useQueryClient();
  return useCallback(() => {
    void qc.invalidateQueries({ queryKey: taskKey(id) });
    void qc.invalidateQueries({ queryKey: ['my-tasks'] });
  }, [qc, id]);
}
