/**
 * Minimal class-name joiner. Drop falsy values, join with spaces.
 * Intentionally not pulling in clsx/cn libs — keeps the bundle small
 * and the primitives self-contained.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
