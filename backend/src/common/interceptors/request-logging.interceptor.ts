import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(RequestLoggingInterceptor.name);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const start = process.hrtime.bigint();

    const path = req.path;
    if (path === '/health' || path === '/readyz' || path?.startsWith('/api/docs')) {
      return next.handle();
    }

    const requestId =
      (req as any).id ?? (req.headers['x-request-id'] as string | undefined);

    return next.handle().pipe(
      tap({
        next: () => {
          const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
          this.logger.info(
            {
              requestId,
              method: req.method,
              path,
              status: res.statusCode,
              durationMs: Number(durationMs.toFixed(2)),
            },
            'request',
          );
        },
        error: (err) => {
          const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
          this.logger.warn(
            {
              requestId,
              method: req.method,
              path,
              status: err?.status ?? 500,
              durationMs: Number(durationMs.toFixed(2)),
              err: err?.message,
            },
            'request_error',
          );
        },
      }),
    );
  }
}
