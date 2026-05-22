import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { shutdownState } from '../health/health.controller';

/**
 * During the SIGTERM grace window, every non-health request returns 503 so the
 * load balancer marks the pod unhealthy and stops sending new traffic.
 * Health endpoint responds 503 too (via shutdownState in health.controller).
 */
@Injectable()
export class ShutdownGuardMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    if (!shutdownState.draining) return next();

    if (req.path === '/health' || req.path === '/readyz') {
      res.status(503).json({ status: 'draining' });
      return;
    }
    res.setHeader('Retry-After', '5');
    res.status(503).json({
      data: null,
      meta: { requestId: (req as any).id, timestamp: new Date().toISOString() },
      error: { code: 'SHUTTING_DOWN', message: 'Service is shutting down', retryAfter: 5 },
    });
  }
}
