/**
 * Tests for apps/resident-app/src/components/NetworkBanner.tsx
 *
 * NetworkBanner subscribes to NetInfo and shows a banner when offline.
 */

import React from 'react';
import { StyleSheet } from 'react-native';
import { render, act } from '@testing-library/react-native';

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(),
  },
}));
import NetInfo from '@react-native-community/netinfo';
const mockAddEventListener = NetInfo.addEventListener as jest.Mock;

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

  it('is fully visible the moment it mounts — never faded in from transparent', () => {
    // Regression: it faded in from opacity 0 with Animated, which never
    // reaches a view mounted after its screen's first render on this RN
    // setup. On device residents saw an empty band, not the message.
    const { getByTestId } = render(<NetworkBanner />);
    act(() => {
      capturedCallback!({ isConnected: false });
    });
    const style = StyleSheet.flatten(getByTestId('network-banner').props.style);
    expect(style.opacity ?? 1).toBe(1);
    expect(getByTestId('network-banner').props.accessibilityRole).toBe('alert');
  });

  it('clears the status bar: padded by the top safe-area inset', () => {
    const { SafeAreaProvider } = require('react-native-safe-area-context');
    const metrics = {
      frame: { x: 0, y: 0, width: 390, height: 844 },
      insets: { top: 47, left: 0, right: 0, bottom: 34 },
    };
    const { getByTestId } = render(
      <SafeAreaProvider initialMetrics={metrics}>
        <NetworkBanner />
      </SafeAreaProvider>,
    );
    act(() => {
      capturedCallback!({ isConnected: false });
    });
    expect(StyleSheet.flatten(getByTestId('network-banner').props.style).paddingTop).toBe(47 + 12);
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
