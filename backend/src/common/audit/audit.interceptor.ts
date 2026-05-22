import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { AuditService } from './audit.service';
import { AUDIT_SKIP, AUDITED_UPDATE, AuditedUpdateMeta } from './audit.decorator';
import { getTenantContext } from '../tenancy/tenant.context';

const AUDITED_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const SKIP_PATH_PREFIXES = ['/v1/auth', '/auth', '/health', '/readyz', '/metrics', '/api/docs'];

/**
 * AuditInterceptor — auto-writes an `AuditLog` row for every mutating
 * admin/staff request. Resident-app traffic is skipped (only ADMIN,
 * SUPER_ADMIN, STAFF roles are audited).
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly audit: AuditService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const skip = this.reflector.getAllAndOverride<boolean>(AUDIT_SKIP, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return next.handle();

    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest();
    const method = req.method as string;
    if (!AUDITED_METHODS.has(method)) return next.handle();

    const path = (req.originalUrl || req.url || '').split('?')[0];
    if (SKIP_PATH_PREFIXES.some((p) => path.startsWith(p))) return next.handle();

    const ctx = getTenantContext();
    const role = ctx?.role ?? req.user?.role ?? null;
    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN' && role !== 'STAFF') {
      return next.handle();
    }

    const meta = this.reflector.get<AuditedUpdateMeta>(AUDITED_UPDATE, context.getHandler());
    const entityType = meta?.entityType ?? context.getClass().name.replace('Controller', '');
    const idParam = meta?.idParam ?? 'id';
    const entityId = req.params?.[idParam] ?? req.body?.id ?? 'n/a';

    return next.handle().pipe(
      tap(async (response) => {
        await this.audit.write({
          entityType,
          entityId: String(entityId),
          action: `${method} ${path}`,
          module: context.getClass().name,
          routePath: path,
          method,
          ipAddress: req.ip ?? req.socket?.remoteAddress ?? null,
          userAgent: req.headers?.['user-agent'] ?? null,
          actorId: ctx?.userId ?? req.user?.sub ?? null,
          actorRole: role,
          before: null,
          after: scrub(response),
          societyId: ctx?.societyId ?? null,
        });
      }),
    );
  }
}

const PII_KEYS = new Set([
  'phone',
  'email',
  'aadhaar',
  'panNumber',
  'password',
  'totpSecret',
  'emergencyContact',
]);

function scrub(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[deep]';
  if (value == null) return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => scrub(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (PII_KEYS.has(k)) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = scrub(v, depth + 1);
      }
    }
    return out;
  }
  return value;
}
