/**
 * Skeleton and useReducedMotion — the motion primitives behind the
 * launch-screen polish. The rule they share: decorative motion stops when the
 * resident has asked the OS to reduce motion.
 */

import React from 'react';
import { AccessibilityInfo, Animated, Text } from 'react-native';
import { render, renderHook, screen, act, waitFor } from '@testing-library/react-native';
import { Skeleton } from '../src/components/ui/Skeleton';
import {
  useReducedMotion,
  primeReducedMotion,
  __resetReducedMotionForTests,
} from '../src/hooks/useReducedMotion';

type Listener = (enabled: boolean) => void;

function mockReduceMotion(enabled: boolean) {
  const listeners: Listener[] = [];
  const remove = jest.fn();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(enabled);
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((
    _event: string,
    cb: Listener,
  ) => {
    listeners.push(cb);
    return { remove } as any;
  }) as any);
  return {
    remove,
    emit: (value: boolean) => listeners.forEach((cb) => cb(value)),
  };
}

/** What the root layout does at launch: ask the OS before any screen renders. */
async function launchWithReducedMotion(enabled: boolean) {
  const os = mockReduceMotion(enabled);
  primeReducedMotion();
  await act(async () => {});
  return os;
}

afterEach(() => {
  jest.restoreAllMocks();
  __resetReducedMotionForTests();
});

describe('useReducedMotion', () => {
  it('reports the OS setting', async () => {
    mockReduceMotion(true);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false); // until the OS answers
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('follows changes made while the app is open', async () => {
    const os = mockReduceMotion(false);
    const { result } = renderHook(() => useReducedMotion());
    await waitFor(() => expect(AccessibilityInfo.isReduceMotionEnabled).toHaveBeenCalled());
    act(() => os.emit(true));
    expect(result.current).toBe(true);
  });

  it('knows on the first render once primed at launch', async () => {
    await launchWithReducedMotion(true);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });

  it('unsubscribes on unmount', () => {
    const os = mockReduceMotion(false);
    const { unmount } = renderHook(() => useReducedMotion());
    unmount();
    expect(os.remove).toHaveBeenCalledTimes(1);
  });
});

describe('Skeleton', () => {
  it('is hidden from screen readers', () => {
    mockReduceMotion(false);
    render(<Skeleton />);
    const block = screen.getByTestId('skeleton', { includeHiddenElements: true });
    expect(block.props.accessibilityElementsHidden).toBe(true);
    expect(block.props.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('takes the requested shape', () => {
    mockReduceMotion(false);
    render(<Skeleton width={96} height={12} radius={6} />);
    expect(screen.getByTestId('skeleton', { includeHiddenElements: true })).toHaveStyle({
      width: 96,
      height: 12,
      borderRadius: 6,
    });
  });

  it('pulses normally', async () => {
    const loop = jest.spyOn(Animated, 'loop');
    await launchWithReducedMotion(false);
    render(<Skeleton />);
    expect(loop).toHaveBeenCalledTimes(1);
  });

  it('never starts pulsing under reduced motion', async () => {
    const loop = jest.spyOn(Animated, 'loop');
    await launchWithReducedMotion(true);
    render(<Skeleton />);
    await act(async () => {});
    expect(loop).not.toHaveBeenCalled();
    expect(screen.getByTestId('skeleton', { includeHiddenElements: true })).toHaveStyle({
      opacity: 1,
    });
  });
});
