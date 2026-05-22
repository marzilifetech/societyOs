import { create } from 'zustand';

type TimerState = {
  // taskId -> ISO start timestamp
  starts: Record<string, string>;
  start: (taskId: string) => void;
  stop: (taskId: string) => number; // returns elapsed seconds
  reset: (taskId: string) => void;
  elapsedSeconds: (taskId: string, now?: number) => number;
};

export const useTimerStore = create<TimerState>((set, get) => ({
  starts: {},
  start: (taskId) => {
    if (get().starts[taskId]) return; // already running
    set((s) => ({ starts: { ...s.starts, [taskId]: new Date().toISOString() } }));
  },
  stop: (taskId) => {
    const startedAt = get().starts[taskId];
    if (!startedAt) return 0;
    const ms = Date.now() - new Date(startedAt).getTime();
    set((s) => {
      const next = { ...s.starts };
      delete next[taskId];
      return { starts: next };
    });
    return Math.max(0, Math.floor(ms / 1000));
  },
  reset: (taskId) =>
    set((s) => {
      const next = { ...s.starts };
      delete next[taskId];
      return { starts: next };
    }),
  elapsedSeconds: (taskId, now = Date.now()) => {
    const startedAt = get().starts[taskId];
    if (!startedAt) return 0;
    return Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  },
}));

export function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
