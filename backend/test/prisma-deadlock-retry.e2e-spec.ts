/**
 * Integration: N4 — Prisma deadlock retry. Simulated via mock that throws
 * P2034 once, then succeeds.
 */
describe('Prisma deadlock retry (N4)', () => {
  const withRetry = async <T>(fn: () => Promise<T>, max = 3): Promise<T> => {
    let last: any;
    for (let i = 0; i < max; i++) {
      try { return await fn(); } catch (e: any) {
        if (e.code === 'P2034') { last = e; continue; }
        throw e;
      }
    }
    throw last;
  };

  it('retries on P2034 and succeeds on second attempt', async () => {
    const attempt = jest.fn()
      .mockRejectedValueOnce(Object.assign(new Error('deadlock'), { code: 'P2034' }))
      .mockResolvedValueOnce('ok');
    const r = await withRetry(attempt);
    expect(r).toBe('ok');
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it('gives up after max attempts', async () => {
    const attempt = jest.fn().mockRejectedValue(Object.assign(new Error('deadlock'), { code: 'P2034' }));
    await expect(withRetry(attempt, 3)).rejects.toMatchObject({ code: 'P2034' });
    expect(attempt).toHaveBeenCalledTimes(3);
  });
});
