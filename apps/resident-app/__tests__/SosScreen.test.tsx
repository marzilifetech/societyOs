/**
 * Behaviour test for the redesigned Medical SOS screen (2026 Figma).
 * Validates the Emergency Alert (form) phase rendering + a11y, that "Send Alert"
 * enters the 5-second countdown, and that the history affordance navigates.
 */

import { render, fireEvent, act } from '@testing-library/react-native';
import React from 'react';

jest.mock('../src/store/accessibility.store', () => ({
  useAccessibilityStore: (sel: any) =>
    sel({ seniorMode: false, toggleSeniorMode: jest.fn(), setSeniorMode: jest.fn() }),
}));

// The shared setup's haptics mock lacks selectionAsync and returns no promises.
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium', Heavy: 'Heavy' },
  NotificationFeedbackType: { Success: 'Success', Warning: 'Warning', Error: 'Error' },
}));

jest.mock('../src/lib/sentry', () => ({
  Sentry: { captureException: jest.fn(), init: jest.fn(), setUser: jest.fn() },
}));

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockCanGoBack = jest.fn(() => true);
jest.mock('expo-router', () => ({
  useSegments: () => [],
  router: {
    back: () => mockBack(),
    push: (...a: any[]) => mockPush(...a),
    replace: (...a: any[]) => mockReplace(...a),
    canGoBack: () => mockCanGoBack(),
  },
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack }),
  useLocalSearchParams: () => ({}),
  Link: ({ children }: any) => children,
}));

const mockPost = jest.fn().mockResolvedValue({ id: 'sos-test-id' });
jest.mock('../src/lib/api', () => ({
  api: {
    get: jest.fn().mockResolvedValue(null),
    post: (...a: any[]) => mockPost(...a),
    patch: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock('socket.io-client', () => ({
  io: () => ({ auth: {}, connect: jest.fn(), disconnect: jest.fn(), on: jest.fn(), off: jest.fn() }),
}));

jest.mock('../src/store/auth.store', () => ({
  useAuthStore: Object.assign(() => null, {
    getState: () => ({ token: 'test-token', user: { name: 'Rajesh Kumar' } }),
  }),
}));

import SosScreen from '../app/medical/sos';

describe('SosScreen (2026 redesign)', () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockPush.mockClear();
    mockReplace.mockClear();
  });

  it('renders the Emergency Alert form phase', () => {
    const { getByText, getByLabelText, queryByText } = render(<SosScreen />);

    // Header + serif title + subtitle
    expect(getByText('Emergency SOS')).toBeTruthy();
    expect(getByText('Emergency Alert')).toBeTruthy();
    expect(getByText('Send instant alert to security and nearby responders')).toBeTruthy();

    // "Alerts will be sent to" responders
    expect(getByText('Alerts will be sent to')).toBeTruthy();
    expect(getByText('Help Desk')).toBeTruthy();
    expect(getByText('First Responder')).toBeTruthy();
    expect(getByText('Security Gate')).toBeTruthy();

    // Optional details + send action
    expect(getByText('Additional Details (optional)')).toBeTruthy();
    expect(getByLabelText('Send Alert')).toBeTruthy();

    // Active-phase-only action is absent in the form phase
    expect(queryByText('Mark As Resolved')).toBeNull();
  });

  // Faking microtasks/nextTick as well hangs React's scheduler, so only the
  // timer functions are faked.
  const fakeTimers = () =>
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });

  it('Send Alert enters the 5-second sending countdown', () => {
    fakeTimers();
    try {
      const { getByLabelText, getByText } = render(<SosScreen />);
      fireEvent.press(getByLabelText('Send Alert'));
      expect(getByText('Sending Alert')).toBeTruthy();
      expect(getByLabelText('Cancel SOS Alert')).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  const runCountdown = async () => {
    for (let i = 0; i < 8; i++) {
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
    }
  };

  it('sends after the countdown, without waiting for a GPS fix', async () => {
    fakeTimers();
    try {
      mockPost.mockClear();
      // Permission granted, but the GPS fix never arrives.
      const Location = jest.requireMock('expo-location');
      Location.getForegroundPermissionsAsync = jest.fn().mockResolvedValue({ status: 'granted' });
      Location.getLastKnownPositionAsync = jest.fn().mockResolvedValue(null);
      Location.getCurrentPositionAsync = jest.fn(() => new Promise(() => {}));
      const { getByLabelText } = render(<SosScreen />);
      fireEvent.press(getByLabelText('Send Alert'));
      await runCountdown();
      expect(mockPost).toHaveBeenCalledTimes(1);
      expect(mockPost).toHaveBeenCalledWith('/sos/trigger', {});
    } finally {
      jest.useRealTimers();
    }
  });

  it('cancelling during the countdown sends nothing', async () => {
    fakeTimers();
    try {
      mockPost.mockClear();
      const { getByLabelText, getByText } = render(<SosScreen />);
      fireEvent.press(getByLabelText('Send Alert'));
      fireEvent.press(getByLabelText('Cancel SOS Alert'));
      await runCountdown();
      expect(getByText('Emergency Alert')).toBeTruthy();
      expect(mockPost).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('history affordance navigates to SOS history', () => {
    const { getByLabelText } = render(<SosScreen />);
    fireEvent.press(getByLabelText('View SOS alert history'));
    expect(mockPush).toHaveBeenCalledWith('/medical/sos-history');
  });
});
