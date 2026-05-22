/**
 * Tests for apps/resident-app/src/components/NetworkBanner.tsx
 *
 * NetworkBanner subscribes to NetInfo and shows a banner when offline.
 */

import React from 'react';
import { render, act } from '@testing-library/react-native';

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(),
  },
}));
import NetInfo from '@react-native-community/netinfo';
const mockAddEventListener = NetInfo.addEventListener as jest.Mock;

// Stub Animated.timing to be synchronous
jest.mock('react-native/Libraries/Animated/Animated', () => {
  const actual = jest.requireActual('react-native/Libraries/Animated/Animated');
  return {
    ...actual,
    timing: (_value: any, config: any) => ({
      start: (cb?: () => void) => {
        _value.setValue(config.toValue);
        cb?.();
      },
    }),
  };
});

import { NetworkBanner } from '../src/components/NetworkBanner';

describe('NetworkBanner', () => {
  let capturedCallback: ((state: any) => void) | undefined;
  let unsubscribe: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    unsubscribe = jest.fn();
    mockAddEventListener.mockImplementation((cb: (state: any) => void) => {
      capturedCallback = cb;
      return unsubscribe;
    });
  });

  it('renders null when online', () => {
    const { toJSON } = render(<NetworkBanner />);
    // Before any NetInfo event, isOffline=false → returns null
    expect(toJSON()).toBeNull();
  });

  it('renders banner when offline event fires', () => {
    const { getByText } = render(<NetworkBanner />);
    act(() => {
      capturedCallback!({ isConnected: false });
    });
    expect(getByText(/No internet connection/)).toBeTruthy();
  });

  it('hides banner when back online', () => {
    const { toJSON } = render(<NetworkBanner />);
    act(() => { capturedCallback!({ isConnected: false }); });
    act(() => { capturedCallback!({ isConnected: true }); });
    expect(toJSON()).toBeNull();
  });

  it('calls NetInfo.addEventListener on mount', () => {
    render(<NetworkBanner />);
    expect(mockAddEventListener).toHaveBeenCalledTimes(1);
  });

  it('calls unsubscribe on unmount', () => {
    const { unmount } = render(<NetworkBanner />);
    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
