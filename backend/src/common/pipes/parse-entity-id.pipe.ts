import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

/**
 * Validates a path-parameter entity id.
 *
 * WHY THIS EXISTS INSTEAD OF `ParseUUIDPipe`:
 * this schema mixes two id strategies — older models use `@default(uuid())`,
 * newer ones use `@default(cuid())`. Several controllers were guarding cuid
 * routes with `ParseUUIDPipe`, which rejects every real id with
 * `400 Validation failed (uuid is expected)`. That is what made Pest Control
 * "Mark Complete"/"Cancel", vendor edit/delete, package collection and
 * subscription pause/cancel look silently broken in the dashboard.
 *
 * Accepts either shape (and cuid2, which drops the `c` prefix) while still
 * rejecting the traversal/injection-shaped garbage the pipe was there to stop.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// cuid v1 (`c` + base36) and cuid2 (bare lowercase alphanumeric, 7-32 chars).
const CUID_RE = /^[a-z][a-z0-9]{6,31}$/;

export function isEntityId(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  return UUID_RE.test(value) || CUID_RE.test(value);
}

@Injectable()
export class ParseEntityIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!isEntityId(value)) {
      throw new BadRequestException({
        code: 'INVALID_ID',
        message: 'Invalid id format',
      });
    }
    return value;
  }
}
