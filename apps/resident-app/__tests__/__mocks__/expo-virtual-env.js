/**
 * Stub for `expo/virtual/env`.
 *
 * The real module is `export const env = process.env`, but under this preset it
 * is evaluated in a scope where `process` is not defined, so every suite that
 * transitively imported it (anything reaching src/lib/socket.ts) died with
 * `ReferenceError: process is not defined`.
 *
 * Resolved lazily and defensively so this stub can never reintroduce the same
 * crash: tests that set EXPO_PUBLIC_* on process.env still see their values.
 */
const env = new Proxy(
  {},
  {
    get(_target, prop) {
      try {
        return typeof process !== 'undefined' && process.env
          ? process.env[prop]
          : undefined;
      } catch {
        return undefined;
      }
    },
  },
);

module.exports = { env };
