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
