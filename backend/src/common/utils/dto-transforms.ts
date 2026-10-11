import { Transform } from 'class-transformer';

/**
 * "Deep Clean" → "DEEP_CLEAN". The resident app sends display labels where
 * the API declares enums, and the strict validation pipe answered 400 to
 * every request — housekeeping bookings, domestic help, documents. Normalising
 * on the server makes the app already on phones work without an update.
 */
export function toEnumKey(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Accept a label or an enum key. `aliases` maps a normalised label that has no
 * enum value of its own (e.g. SECURITY) to the one it belongs under (OTHER).
 */
export function EnumLabel(aliases: Record<string, string> = {}) {
  return Transform(({ value }) => {
    const key = toEnumKey(value);
    return typeof key === 'string' ? aliases[key] ?? key : key;
  });
}
