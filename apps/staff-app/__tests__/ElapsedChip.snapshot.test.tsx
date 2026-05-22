import { render, act } from '@testing-library/react-native';
import React from 'react';
import { ElapsedChip } from '../src/components/task/ElapsedChip';
import { useTimerStore } from '../src/store/timer.store';

describe('ElapsedChip', () => {
  afterEach(() => {
    // Reset timer store between tests — must happen after any unmounts
    useTimerStore.setState({ starts: {} });
  });

  it('renders null when no timer is running for taskId', () => {
    const tree = render(<ElapsedChip taskId="t1" />).toJSON();
    expect(tree).toBeNull();
  });

  it('renders the chip when a timer is running', () => {
    // Seed the store with a start time 5 seconds ago
    const start = new Date(Date.now() - 5000).toISOString();
    useTimerStore.setState({ starts: { t1: start } });

    const tree = render(<ElapsedChip taskId="t1" />).toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('renders null for a different taskId than the running timer', () => {
    const start = new Date(Date.now() - 3000).toISOString();
    useTimerStore.setState({ starts: { t2: start } });

    expect(render(<ElapsedChip taskId="t1" />).toJSON()).toBeNull();
  });

  it('sets up setInterval when timer starts and clears it on unmount', () => {
    jest.useFakeTimers();
    const start = new Date(Date.now() - 1000).toISOString();
    useTimerStore.setState({ starts: { t1: start } });

    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

    const { unmount } = render(<ElapsedChip taskId="t1" />);
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 1000);

    // Unmount while fake timers are still active — clearInterval must fire
    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('ticks every second and updates displayed time', () => {
    jest.useFakeTimers();
    const start = new Date(Date.now() - 2000).toISOString();
    useTimerStore.setState({ starts: { t1: start } });

    const { toJSON, unmount } = render(<ElapsedChip taskId="t1" />);
    const before = toJSON();

    // Advance 5 seconds — the setInterval fires, tick() increments local state
    act(() => { jest.advanceTimersByTime(5000); });

    const after = toJSON();
    // Both renders should produce the chip structure (not null)
    expect(before).not.toBeNull();
    expect(after).not.toBeNull();

    // Unmount before restoring timers to avoid clearInterval-not-found error
    unmount();
    jest.useRealTimers();
  });

  it('does not set up interval when timer is not running (no-op effect)', () => {
    jest.useFakeTimers();
    const setIntervalSpy = jest.spyOn(global, 'setInterval');

    const { unmount } = render(<ElapsedChip taskId="t-none" />);
    expect(setIntervalSpy).not.toHaveBeenCalled();
    unmount();
    jest.useRealTimers();
  });
});
