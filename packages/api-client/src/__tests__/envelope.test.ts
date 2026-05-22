import { unwrapApiEnvelope } from '../envelope';

describe('unwrapApiEnvelope', () => {
  // ─── Full envelope ────────────────────────────────────────────────────────────

  it('returns data when full { data, meta, error: null } envelope is present', () => {
    const payload = { id: 1, name: 'Alice' };
    const envelope = { data: payload, meta: { requestId: 'r1', timestamp: 't' }, error: null };
    expect(unwrapApiEnvelope(envelope)).toEqual(payload);
  });

  it('returns array data correctly', () => {
    const items = [1, 2, 3];
    const envelope = { data: items, meta: {}, error: null };
    expect(unwrapApiEnvelope(envelope)).toEqual(items);
  });

  it('returns null when data is null (null is !== undefined)', () => {
    const envelope = { data: null, meta: {}, error: null };
    expect(unwrapApiEnvelope(envelope)).toBeNull();
  });

  it('returns false when data is false', () => {
    const envelope = { data: false, meta: {}, error: null };
    expect(unwrapApiEnvelope(envelope)).toBe(false);
  });

  it('returns 0 when data is 0', () => {
    const envelope = { data: 0, meta: {}, error: null };
    expect(unwrapApiEnvelope(envelope)).toBe(0);
  });

  // ─── Non-envelope passthrough ─────────────────────────────────────────────────

  it('returns body as-is when it has no data field', () => {
    const body = { result: 'ok', count: 3 };
    expect(unwrapApiEnvelope(body)).toEqual(body);
  });

  it('returns body as-is when error is not null (error response)', () => {
    const body = { data: null, meta: {}, error: { message: 'Unauthorized' } };
    expect(unwrapApiEnvelope(body)).toEqual(body);
  });

  it('returns body as-is when meta is missing', () => {
    const body = { data: { x: 1 }, error: null };
    expect(unwrapApiEnvelope(body)).toEqual(body);
  });

  it('returns body as-is when error field is missing', () => {
    const body = { data: { x: 1 }, meta: {} };
    expect(unwrapApiEnvelope(body)).toEqual(body);
  });

  it('returns body as-is when data field is missing', () => {
    const body = { meta: {}, error: null };
    expect(unwrapApiEnvelope(body)).toEqual(body);
  });

  it('returns body as-is when all envelope fields missing', () => {
    const body = { foo: 'bar' };
    expect(unwrapApiEnvelope(body)).toEqual(body);
  });
});
