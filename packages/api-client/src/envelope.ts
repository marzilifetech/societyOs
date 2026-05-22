/**
 * Backend wraps most JSON bodies as `{ data, meta, error }` (ResponseEnvelopeInterceptor).
 * `ApiClient` returns parsed JSON as a plain object; this extracts `data` when present.
 */
export interface ApiSuccessEnvelope<T> {
  data: T;
  meta: {
    requestId?: string;
    timestamp?: string;
  };
  error: null;
}

function isApiSuccessEnvelope<T>(body: object): body is ApiSuccessEnvelope<T> {
  if (!('data' in body && 'meta' in body && 'error' in body)) {
    return false;
  }
  const o = body as ApiSuccessEnvelope<T>;
  return o.error === null;
}

export function unwrapApiEnvelope<T>(body: object): T {
  if (isApiSuccessEnvelope<T>(body)) {
    return body.data;
  }
  return body as T;
}
