import { useTimerStore, formatElapsed } from '../src/store/timer.store';

function resetStore() {
  useTimerStore.setState({ starts: {} });
}

describe('useTimerStore', () => {
  beforeEach(resetStore);

  // ─── start ────────────────────────────────────────────────────────────────

  it('start creates an entry for the given taskId', () => {
    useTimerStore.getState().start('task-1');
    const { starts } = useTimerStore.getState();
    expect(starts['task-1']).toBeDefined();
    expect(new Date(starts['task-1']).getTime()).toBeCloseTo(Date.now(), -2);
  });

  it('start is a no-op when the timer is already running', () => {
    useTimerStore.getState().start('task-1');
    const firstStart = useTimerStore.getState().starts['task-1'];
    useTimerStore.getState().start('task-1');
    expect(useTimerStore.getState().starts['task-1']).toBe(firstStart);
  });

  it('start tracks multiple tasks independently', () => {
    useTimerStore.getState().start('a');
    useTimerStore.getState().start('b');
    expect(useTimerStore.getState().starts['a']).toBeDefined();
    expect(useTimerStore.getState().starts['b']).toBeDefined();
  });

  // ─── stop ─────────────────────────────────────────────────────────────────

  it('stop returns elapsed seconds and removes the entry', () => {
    const past = new Date(Date.now() - 5000).toISOString();
    useTimerStore.setState({ starts: { 'task-1': past } });
    const elapsed = useTimerStore.getState().stop('task-1');
    expect(elapsed).toBeGreaterThanOrEqual(4);
    expect(elapsed).toBeLessThanOrEqual(6);
    expect(useTimerStore.getState().starts['task-1']).toBeUndefined();
  });

  it('stop returns 0 when timer was never started', () => {
    expect(useTimerStore.getState().stop('unknown')).toBe(0);
  });

  it('stop returns at least 0 (never negative)', () => {
    // Future start time (clock skew edge case)
    const future = new Date(Date.now() + 10000).toISOString();
    useTimerStore.setState({ starts: { skewed: future } });
    const elapsed = useTimerStore.getState().stop('skewed');
    expect(elapsed).toBeGreaterThanOrEqual(0);
  });

  it('stop does not affect other running timers', () => {
    useTimerStore.getState().start('a');
    useTimerStore.getState().start('b');
    useTimerStore.getState().stop('a');
    expect(useTimerStore.getState().starts['b']).toBeDefined();
    expect(useTimerStore.getState().starts['a']).toBeUndefined();
  });

  // ─── reset ────────────────────────────────────────────────────────────────

  it('reset removes the entry without returning elapsed', () => {
    useTimerStore.getState().start('task-1');
    useTimerStore.getState().reset('task-1');
    expect(useTimerStore.getState().starts['task-1']).toBeUndefined();
  });

  it('reset on non-existent taskId is safe (no error)', () => {
    expect(() => useTimerStore.getState().reset('ghost')).not.toThrow();
  });

  // ─── elapsedSeconds ───────────────────────────────────────────────────────

  it('elapsedSeconds returns 0 for a task that is not running', () => {
    expect(useTimerStore.getState().elapsedSeconds('ghost')).toBe(0);
  });

  it('elapsedSeconds returns correct elapsed using custom now', () => {
    const startMs = Date.now() - 10000;
    const startISO = new Date(startMs).toISOString();
    useTimerStore.setState({ starts: { t: startISO } });
    const elapsed = useTimerStore.getState().elapsedSeconds('t', startMs + 10000);
    expect(elapsed).toBe(10);
  });

  it('elapsedSeconds clamps to 0 for future start (clock skew)', () => {
    const futureISO = new Date(Date.now() + 5000).toISOString();
    useTimerStore.setState({ starts: { t: futureISO } });
    expect(useTimerStore.getState().elapsedSeconds('t')).toBe(0);
  });
});

// ─── formatElapsed ──────────────────────────────────────────────────────────

describe('formatElapsed', () => {
  it('shows only seconds when under 1 minute', () => {
    expect(formatElapsed(0)).toBe('0s');
    expect(formatElapsed(1)).toBe('1s');
    expect(formatElapsed(59)).toBe('59s');
  });

  it('shows minutes and seconds when >= 1 minute and < 1 hour', () => {
    expect(formatElapsed(60)).toBe('1m 0s');
    expect(formatElapsed(90)).toBe('1m 30s');
    expect(formatElapsed(3599)).toBe('59m 59s');
  });

  it('shows hours and minutes when >= 1 hour', () => {
    expect(formatElapsed(3600)).toBe('1h 0m');
    expect(formatElapsed(3660)).toBe('1h 1m');
    expect(formatElapsed(7261)).toBe('2h 1m');
  });

  it('does not show seconds for hours display', () => {
    // 1h 0m 45s → should show "1h 0m" not "1h 0m 45s"
    expect(formatElapsed(3645)).toBe('1h 0m');
  });
});
