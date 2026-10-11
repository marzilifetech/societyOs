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

/**
 * A list endpoint that may answer with a bare array or a paginated
 * `{ data: [...], meta }` page — always resolves to the array.
 */
export async function unwrapList<T>(path: string): Promise<T[]> {
  const value = await getUnwrapped<unknown>(path);
  if (Array.isArray(value)) return value as T[];
  const page = value as { data?: unknown } | null;
  return Array.isArray(page?.data) ? (page!.data as T[]) : [];
}
