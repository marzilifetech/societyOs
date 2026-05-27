/**
 * Bounded-concurrency async pool — runs at most `concurrency` tasks at a
 * time over `items`, never failing the whole batch when one item rejects.
 *
 * Returns parallel arrays of fulfilled / rejected results plus aggregate
 * counts so callers can return `{ sent, failed }` without recomputing.
 *
 * Compared to `Promise.allSettled(items.map(...))` this is bounded — the
 * latter would fan out to N concurrent calls instantly, which for push
 * delivery (FCM API rate limits, per-token retries) is a foot-gun on a
 * thousand-resident society.
 */
export interface AsyncPoolResult<R> {
  results: PromiseSettledResult<R>[];
  sent: number;
  failed: number;
}

export async function asyncPool<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<AsyncPoolResult<R>> {
  if (concurrency <= 0) throw new Error('concurrency must be > 0');
  const out: PromiseSettledResult<R>[] = new Array(items.length);
  let cursor = 0;
  let sent = 0;
  let failed = 0;

  async function run() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      try {
        const value = await worker(items[i], i);
        out[i] = { status: 'fulfilled', value };
        sent++;
      } catch (reason) {
        out[i] = { status: 'rejected', reason };
        failed++;
      }
    }
  }

  const slots = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: slots }, () => run()));
  return { results: out, sent, failed };
}
