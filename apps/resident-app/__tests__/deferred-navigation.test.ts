const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));

import {
  navigateWhenAppReady,
  markAppShellReady,
  __resetDeferredNavigationForTests,
} from '../src/lib/deferred-navigation';

describe('deferred navigation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockPush.mockReset();
    __resetDeferredNavigationForTests();
  });
  afterEach(() => jest.useRealTimers());

  it('holds a cold-start tap until the app shell mounts, then runs it once', () => {
    navigateWhenAppReady('/visitor/review/v1');
    expect(mockPush).not.toHaveBeenCalled();

    markAppShellReady();
    expect(mockPush).not.toHaveBeenCalled(); // after the mount commits
    jest.runOnlyPendingTimers();
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/visitor/review/v1');

    jest.runOnlyPendingTimers();
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it('keeps only the latest request made before the shell is ready', () => {
    navigateWhenAppReady('/notifications');
    navigateWhenAppReady('/visitor/review/v2');
    markAppShellReady();
    jest.runOnlyPendingTimers();
    expect(mockPush.mock.calls).toEqual([['/visitor/review/v2']]);
  });

  it('navigates immediately once the shell is up', () => {
    markAppShellReady();
    navigateWhenAppReady('/complaints/c1');
    expect(mockPush).toHaveBeenCalledWith('/complaints/c1');
  });

  it('mounting with nothing pending schedules nothing', () => {
    markAppShellReady();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('after the shell unmounts (signed out), requests wait again', () => {
    const unmount = markAppShellReady();
    unmount();
    navigateWhenAppReady('/packages');
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('drops a held route if the shell unmounts before it runs', () => {
    navigateWhenAppReady('/medical/sos');
    const unmount = markAppShellReady();
    unmount();
    jest.runOnlyPendingTimers();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('a throwing navigator never escapes', () => {
    mockPush.mockImplementation(() => {
      throw new Error('Attempted to navigate before mounting the Root Layout component.');
    });
    markAppShellReady();
    expect(() => navigateWhenAppReady('/notifications')).not.toThrow();
  });

  it('stress: 1,000 random taps, mounts and unmounts — every push is the latest request, made while mounted', () => {
    let seed = 42;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };

    let mounted = false;
    let unmount: (() => void) | null = null;
    let latestUnserved: string | null = null;
    let expectedPushes = 0;

    for (let i = 0; i < 1000; i += 1) {
      const roll = random();
      if (roll < 0.6) {
        const href = `/visitor/review/${i}`;
        navigateWhenAppReady(href);
        if (mounted) {
          expectedPushes += 1;
          expect(mockPush).toHaveBeenLastCalledWith(href);
        } else {
          latestUnserved = href;
        }
      } else if (roll < 0.8 && !mounted) {
        unmount = markAppShellReady();
        mounted = true;
        jest.runOnlyPendingTimers();
        if (latestUnserved) {
          expectedPushes += 1;
          expect(mockPush).toHaveBeenLastCalledWith(latestUnserved);
          latestUnserved = null;
        }
      } else if (mounted && unmount) {
        unmount();
        mounted = false;
      }
      expect(mockPush).toHaveBeenCalledTimes(expectedPushes);
    }
  });
});
