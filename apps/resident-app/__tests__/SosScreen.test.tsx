/**
 * Behaviour test for the redesigned Medical SOS screen (2026 Figma).
 * Validates the Emergency Alert (form) phase rendering + a11y, that "Send Alert"
 * enters the 5-second countdown, and that the history affordance navigates.
 */

import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';

jest.mock('../src/store/accessibility.store', () => ({
  useAccessibilityStore: (sel: any) =>
    sel({ seniorMode: false, toggleSeniorMode: jest.fn(), setSeniorMode: jest.fn() }),
}));

jest.mock('../src/lib/sentry', () => ({
  Sentry: { captureException: jest.fn(), init: jest.fn(), setUser: jest.fn() },
}));

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockCanGoBack = jest.fn(() => true);
jest.mock('expo-router', () => ({
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

jest.mock('../src/lib/api', () => ({
  api: {
    get: jest.fn().mockResolvedValue(null),
    post: jest.fn().mockResolvedValue({ id: 'sos-test-id' }),
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
    expect(getByText('Send instant alert to nearby responders and medical staff')).toBeTruthy();

    // "Alerts will be sent to" responders
    expect(getByText('Alerts will be sent to')).toBeTruthy();
    expect(getByText('Medical Desk')).toBeTruthy();
    expect(getByText('First Responder')).toBeTruthy();
    expect(getByText('Security Gate')).toBeTruthy();

    // Optional details + send action
    expect(getByText('Additional Details (optional)')).toBeTruthy();
    expect(getByLabelText('Send Alert')).toBeTruthy();

    // Active-phase-only action is absent in the form phase
    expect(queryByText('Mark As Resolved')).toBeNull();
  });

  it('Send Alert enters the 5-second sending countdown', () => {
    jest.useFakeTimers();
    try {
      const { getByLabelText, getByText } = render(<SosScreen />);
      fireEvent.press(getByLabelText('Send Alert'));
      expect(getByText('Sending Alert')).toBeTruthy();
      expect(getByLabelText('Cancel SOS Alert')).toBeTruthy();
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
