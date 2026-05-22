import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { shouldSkipEnvelope } from '../interceptors/response-envelope.interceptor';

interface ErrorEnvelope {
  data: null;
  meta: {
    requestId: string | undefined;
    timestamp: string;
  };
  error: {
    code: string;
    message: string;
    details?: unknown;
    field?: string;
    retryAfter?: number;
  };
}

const STATUS_TO_CODE: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  408: 'REQUEST_TIMEOUT',
  409: 'CONFLICT',
  410: 'GONE',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_SERVER_ERROR',
  502: 'BAD_GATEWAY',
  503: 'SERVICE_UNAVAILABLE',
  504: 'GATEWAY_TIMEOUT',
};

// Plain, reassuring messages for senior citizens — no HTTP jargon or error codes.
const FRIENDLY: Record<number, string> = {
  400: 'The information you entered is not quite right. Please check and try again.',
  401: 'Your session has ended for security. Please sign in again.',
  403: 'You do not have permission to do this. Please contact support if you need help.',
  404: 'We could not find what you were looking for. It may have been moved or removed.',
  409: 'This action could not be completed because of a conflict. Please refresh and try again.',
  429: 'You have made too many requests. Please wait a moment and try again.',
  500: 'Something went wrong on our end. Please try again in a moment. If the problem continues, contact support.',
  503: 'Our service is temporarily unavailable. Please try again shortly.',
};

function friendlyMessage(status: number, fallback?: string): string {
  return FRIENDLY[status] ?? fallback ?? FRIENDLY[500];
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const requestId =
      (req as any)?.id ?? (req?.headers?.['x-request-id'] as string | undefined);

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = FRIENDLY[500];
    let details: unknown = undefined;
    let field: string | undefined = undefined;
    let retryAfter: number | undefined = undefined;

    if (exception instanceof ThrottlerException) {
      status = HttpStatus.TOO_MANY_REQUESTS;
      code = 'RATE_LIMITED';
      message = FRIENDLY[429];
      retryAfter = 60;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const r = exception.getResponse();
      code = STATUS_TO_CODE[status] ?? 'HTTP_ERROR';

      if (typeof r === 'string') {
        // Use developer message for 4xx (intentional); friendly fallback for 5xx.
        message = status >= 500 ? friendlyMessage(status) : r;
      } else if (r && typeof r === 'object') {
        const o = r as Record<string, any>;
        const raw = o.message ?? exception.message;
        if (Array.isArray(raw)) {
          // class-validator produces an array of messages
          if (status < 500) {
            details = { errors: raw };
            message = 'The information you entered is not quite right. Please check and try again.';
          } else {
            message = friendlyMessage(status);
          }
          code = 'VALIDATION_ERROR';
        } else {
          message = status >= 500 ? friendlyMessage(status) : (raw ?? friendlyMessage(status));
        }
        if (o.code && typeof o.code === 'string') code = o.code;
        if (o.field && typeof o.field === 'string') field = o.field;
        if (typeof o.retryAfter === 'number') retryAfter = o.retryAfter;
        if (o.details !== undefined && status < 500) details = o.details;
      } else {
        message = status >= 500 ? friendlyMessage(status) : (exception.message ?? friendlyMessage(status));
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      this.logger.error(`Prisma error ${exception.code}: ${exception.message}`, exception.stack);
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        code = 'DUPLICATE';
        message = 'This record already exists. Please check the information and try again.';
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        code = 'NOT_FOUND';
        message = FRIENDLY[404];
      } else if (exception.code === 'P2034') {
        // Transaction deadlock — caller handles retry; we only see it after exhaustion.
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        code = 'TX_DEADLOCK';
        message = FRIENDLY[500];
      } else {
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        code = 'DB_ERROR';
        message = FRIENDLY[500];
      }
    } else if (exception instanceof Error) {
      this.logger.error(`Unhandled error: ${exception.message}`, exception.stack);
      message = FRIENDLY[500];
    }

    // Sentry capture for 5xx
    if (status >= 500) {
      try {
        // Lazy require so test/dev without Sentry installed still work.
        const Sentry = require('@sentry/node');
        if (Sentry?.captureException) {
          Sentry.captureException(exception, {
            tags: { requestId, path: req?.path },
          });
        }
      } catch {
        /* Sentry not initialised */
      }
    }

    this.logger.error(`${req.method} ${req.url} → ${status}`);

    const envelope: ErrorEnvelope = {
      data: null,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
      error: {
        code,
        message: typeof message === 'string' ? message : FRIENDLY[500],
        ...(details !== undefined ? { details } : {}),
        ...(field !== undefined ? { field } : {}),
        ...(retryAfter !== undefined ? { retryAfter } : {}),
      },
    };

    if (retryAfter) {
      res.setHeader('Retry-After', String(retryAfter));
    }

    // Health/Swagger/etc: emit raw error w/o envelope so probes parse correctly.
    if (shouldSkipEnvelope(req?.path)) {
      res.status(status).json({ status: 'error', code, message: envelope.error.message });
      return;
    }

    res.status(status).json(envelope);
  }
}
