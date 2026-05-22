import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request, Response } from 'express';

const SKIP_ENVELOPE_PATHS = ['/health', '/readyz', '/api/docs', '/metrics'];

export function shouldSkipEnvelope(path: string | undefined): boolean {
  if (!path) return false;
  return SKIP_ENVELOPE_PATHS.some(
    (p) => path === p || path.startsWith(`${p}/`) || path.startsWith(p + '?'),
  );
}

@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    if (shouldSkipEnvelope(req.path)) {
      return next.handle();
    }

    const requestId =
      (req as any).id ?? (req.headers['x-request-id'] as string | undefined);

    return next.handle().pipe(
      map((payload: any) => {
        // If handler already returned an envelope shape, pass-through.
        if (
          payload &&
          typeof payload === 'object' &&
          'data' in payload &&
          'meta' in payload &&
          'error' in payload
        ) {
          return payload;
        }

        // Pagination handlers may return { data, meta } already; preserve meta.
        if (
          payload &&
          typeof payload === 'object' &&
          'data' in payload &&
          'meta' in payload &&
          !('error' in payload)
        ) {
          return {
            data: payload.data,
            meta: { ...payload.meta, requestId, timestamp: new Date().toISOString() },
            error: null,
          };
        }

        return {
          data: payload ?? null,
          meta: { requestId, timestamp: new Date().toISOString() },
          error: null,
        };
      }),
    );
  }
}
