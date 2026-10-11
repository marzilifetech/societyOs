/**
 * Fields that must never leave the API, whatever a handler returns.
 *
 * Many endpoints returned Prisma rows with `include: { user: true }`, which
 * carries the user's TOTP secret, push tokens and (for residents) the raw
 * Aadhaar bytes — to staff phones, and in one case (`GET /sos/active`) to any
 * signed-in user. Targeted `select`s fix individual endpoints; this is the
 * backstop that makes the whole class of leak impossible.
 *
 * None of these is read by any client: TOTP is verified server-side, push
 * tokens are written by the apps and only read by the push service, and the
 * Aadhaar number is stored encrypted for compliance, never displayed.
 */
export const SECRET_RESPONSE_FIELDS: ReadonlySet<string> = new Set([
  'totpSecret',
  'fcmToken',
  'deviceToken',
  'aadhaar',
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * A copy of `value` without {@link SECRET_RESPONSE_FIELDS}, at any depth.
 *
 * Copy-on-write: objects with nothing to remove are returned as-is, so
 * in-memory caches are never mutated and clean responses cost no allocation.
 * Only plain objects and arrays are walked; Dates, Decimals, Buffers and class
 * instances pass through untouched (they serialise themselves).
 */
export function stripSecrets<T>(value: T, depth = 0): T {
  if (depth > 32) return value;
  if (Array.isArray(value)) {
    let changed = false;
    const out = value.map((item) => {
      const next = stripSecrets(item, depth + 1);
      if (next !== item) changed = true;
      return next;
    });
    return (changed ? out : value) as T;
  }
  if (!isPlainObject(value)) return value;

  let out: Record<string, unknown> | null = null;
  for (const key of Object.keys(value)) {
    const original = value[key];
    if (SECRET_RESPONSE_FIELDS.has(key)) {
      out ??= { ...value };
      delete out[key];
      continue;
    }
    const next = stripSecrets(original, depth + 1);
    if (next !== original) {
      out ??= { ...value };
      out[key] = next;
    }
  }
  return (out ?? value) as T;
}
