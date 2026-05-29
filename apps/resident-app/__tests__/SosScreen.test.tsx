/**
 * Behaviour test for the redesigned Medical SOS screen.
 * Validates the confirm-phase rendering + a11y contract and the cancel path.
 *
 * Async send-SOS / socket-ack flow is left for an integration suite — these
 * tests focus on what regressed during the redesign: layout, labels, navigation.
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
const mockCanGoBack = jest.fn(() => true);
jest.mock('expo-router', () => ({
  router: {
    back: () => mockBack(),
    canGoBack: () => mockCanGoBack(),
    push: jest.fn(),
    replace: jest.fn(),
  },
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: () => mockBack() }),
  useLocalSearchParams: () => ({}),
  Link: ({ children }: any) => children,
}));

jest.mock('../src/lib/api', () => ({
  api: {
    post: jest.fn().mockResolvedValue({ id: 'sos-test-id' }),
    patch: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock('socket.io-client', () => ({
  io: () => ({
    auth: {},
    connect: jest.fn(),
    disconnect: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
  }),
}));

jest.mock('../src/store/auth.store', () => ({
  useAuthStore: Object.assign(() => null, {
    getState: () => ({ token: 'test-token' }),
  }),
}));

import SosScreen from '../app/medical/sos';

describe('SosScreen (redesigned)', () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockCanGoBack.mockReset();
    mockCanGoBack.mockReturnValue(true);
  });

  it('renders the confirm phase with title, status chip, SOS button, and bottom actions', () => {
    const { getByText, getByLabelText, queryByLabelText } = render(<SosScreen />);

    // ScreenHeader title + subtitle
    expect(getByText('Medical SOS')).toBeTruthy();
    expect(getByText('Tap to alert security & medical staff')).toBeTruthy();

    // Status chip (idle phase → "Emergency")
    expect(getByLabelText('Status: Emergency')).toBeTruthy();

    // Big SOS circle
    expect(
      getByLabelText('Emergency SOS. Sends alert immediately with your location.'),
    ).toBeTruthy();

    // BottomActionBar — primary (send) + secondary (cancel)
    expect(getByLabelText('Emergency SOS. Sends alert and location now.')).toBeTruthy();
    expect(getByLabelText('Cancel - go back without sending SOS')).toBeTruthy();

    // The "I'm OK" cancel action only exists in the active phase
    expect(queryByLabelText("I'm OK - Cancel alert, I am safe")).toBeNull();
  });

  it('Cancel routes back via router.back()', () => {
    const { getByLabelText } = render(<SosScreen />);
    fireEvent.press(getByLabelText('Cancel - go back without sending SOS'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
