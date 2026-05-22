import { unwrapApiEnvelope } from '@societyos/api-client';
import { api } from './api';

/**
 * GET JSON and strip `{ data, meta, error }` when the backend uses ResponseEnvelopeInterceptor.
 */
export async function getUnwrapped<T>(path: string): Promise<T> {
  const raw = await api.get<object>(path);
  return unwrapApiEnvelope<T>(raw);
}

/** Same as {@link getUnwrapped}, but coerces non-arrays to `[]` so `.filter` is always safe. */
export async function getUnwrappedArray<T>(path: string): Promise<T[]> {
  const raw = await api.get<object>(path);
  const value = unwrapApiEnvelope<T[]>(raw);
  return Array.isArray(value) ? value : [];
}
