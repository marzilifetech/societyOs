import { settleWithin } from '../src/lib/timeout';

describe('settleWithin', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('resolves with the value when the promise wins', async () => {
    const result = settleWithin(Promise.resolve('value'), 1000, 'fallback');
    await expect(result).resolves.toBe('value');
    expect(jest.getTimerCount()).toBe(0);
  });

  it('resolves with the fallback when the time runs out', async () => {
    const result = settleWithin(new Promise(() => {}), 1000, 'fallback');
    await jest.advanceTimersByTimeAsync(1000);
    await expect(result).resolves.toBe('fallback');
  });

  it('resolves with the fallback instead of rejecting', async () => {
    const result = settleWithin(Promise.reject(new Error('boom')), 1000, null);
    await expect(result).resolves.toBeNull();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('ignores a value that arrives after the deadline', async () => {
    let resolveLate!: (v: string) => void;
    const late = new Promise<string>((r) => {
      resolveLate = r;
    });
    const result = settleWithin(late, 1000, 'fallback');
    await jest.advanceTimersByTimeAsync(1000);
    resolveLate('too late');
    await expect(result).resolves.toBe('fallback');
  });
});
