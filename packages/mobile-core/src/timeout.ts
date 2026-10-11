/**
 * Resolves with `promise`'s value, or with `fallback` if it has not settled
 * within `ms`. A rejection also resolves to `fallback`, so the result can be
 * awaited on boot paths that must never throw or hang.
 *
 * The timer is cleared as soon as either side wins, so nothing is left
 * scheduled once the caller has its answer.
 */
export function settleWithin<T, F>(promise: Promise<T>, ms: number, fallback: F): Promise<T | F> {
  return new Promise<T | F>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

/**
 * Runs `fn` and resolves to its result, or to `undefined` if it throws —
 * synchronously or asynchronously. For best-effort cleanup (deleting a
 * Keychain/Keystore item, removing a cache) that must never abort the caller:
 * native calls can throw synchronously, where a bare `.catch()` is too late.
 */
export function swallow<T>(fn: () => T | Promise<T>): Promise<T | undefined> {
  return Promise.resolve()
    .then(fn)
    .catch(() => undefined);
}
