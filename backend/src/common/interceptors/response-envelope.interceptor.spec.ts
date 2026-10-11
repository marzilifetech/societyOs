import { StreamableFile } from '@nestjs/common';
import { of, lastValueFrom } from 'rxjs';
import { ResponseEnvelopeInterceptor } from './response-envelope.interceptor';

/** Minimal ExecutionContext/CallHandler doubles for the interceptor. */
function ctx(path = '/v1/admin/residents/export') {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ path, headers: {} }),
      getResponse: () => ({}),
    }),
  } as any;
}
const handlerOf = (payload: unknown) => ({ handle: () => of(payload) } as any);

describe('ResponseEnvelopeInterceptor', () => {
  const interceptor = new ResponseEnvelopeInterceptor();

  it('streams a StreamableFile through untouched (CSV export/template)', async () => {
    const file = new StreamableFile(Buffer.from('name,phone\nAda,123\n', 'utf8'));
    const out = await lastValueFrom(interceptor.intercept(ctx(), handlerOf(file)));
    // Must be the exact same StreamableFile — NOT a { data, meta, error } wrapper.
    expect(out).toBe(file);
    expect(out).toBeInstanceOf(StreamableFile);
  });

  it('wraps a normal object payload in the envelope', async () => {
    const out: any = await lastValueFrom(
      interceptor.intercept(ctx('/v1/admin/residents'), handlerOf({ id: '1' })),
    );
    expect(out).toMatchObject({ data: { id: '1' }, error: null });
    expect(out.meta).toBeDefined();
  });

  it('strips secrets from every response, wrapped or already enveloped', async () => {
    const leaky = { id: 'sr-1', resident: { user: { name: 'Asha', totpSecret: 'x', fcmToken: 'y' } } };
    const wrapped: any = await lastValueFrom(
      interceptor.intercept(ctx('/v1/service-requests/sr-1'), handlerOf(leaky)),
    );
    expect(wrapped.data.resident.user).toEqual({ name: 'Asha' });

    const preEnveloped: any = await lastValueFrom(
      interceptor.intercept(
        ctx('/v1/admin/staff'),
        handlerOf({ data: [{ user: { id: 'u', deviceToken: 'z' } }], meta: { page: 1 } }),
      ),
    );
    expect(preEnveloped.data[0].user).toEqual({ id: 'u' });
  });

  it('skips the envelope for health/probe paths', async () => {
    const out = await lastValueFrom(
      interceptor.intercept(ctx('/health'), handlerOf({ ok: true })),
    );
    expect(out).toEqual({ ok: true });
  });
});
