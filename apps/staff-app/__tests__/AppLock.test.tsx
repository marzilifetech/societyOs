/**
 * The PIN lock as an overlay. The old route-based lock could be walked past
 * with Android Back and stacked a new Home on every unlock.
 */
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn().mockResolvedValue(false),
  isEnrolledAsync: jest.fn().mockResolvedValue(false),
  authenticateAsync: jest.fn(),
}));
jest.mock('../src/lib/pin', () => ({
  PIN_LENGTH: 4,
  MAX_PIN_ATTEMPTS: 5,
  verifyPin: jest.fn(async (pin: string) => pin === '2580'),
  getPinAttempts: jest.fn().mockResolvedValue(0),
  recordFailedPinAttempt: jest.fn(),
  resetPinAttempts: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../src/store/auth.store', () => {
  const clearAuth = jest.fn().mockResolvedValue(undefined);
  return { useAuthStore: { getState: () => ({ clearAuth }) } };
});

import React from 'react';
import { BackHandler } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { AppLock } from '../src/components/AppLock';
import { useLockStore } from '../src/store/lock.store';
import { useAuthStore } from '../src/store/auth.store';
import { getPinAttempts, recordFailedPinAttempt, verifyPin } from '../src/lib/pin';

const metrics = {
  frame: { x: 0, y: 0, width: 360, height: 800 },
  insets: { top: 24, left: 0, right: 0, bottom: 0 },
};

function renderLock() {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <AppLock />
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  useLockStore.setState({ locked: true, hasPin: true });
});

it('swallows Android Back while locked', async () => {
  const add = jest.spyOn(BackHandler, 'addEventListener');
  renderLock();
  await waitFor(() => expect(add).toHaveBeenCalledWith('hardwareBackPress', expect.any(Function)));
  const handler = add.mock.calls[0][1] as () => boolean;
  expect(handler()).toBe(true);
});

it('unlocks in place on the right PIN — no navigation', async () => {
  const { getByLabelText } = renderLock();
  await act(async () => {
    fireEvent.changeText(getByLabelText('Enter your 4-digit PIN'), '2580');
  });
  await waitFor(() => expect(useLockStore.getState().locked).toBe(false));
  expect(router.replace).not.toHaveBeenCalled();
  expect(router.push).not.toHaveBeenCalled();
});

it('stays locked and counts a wrong PIN', async () => {
  (recordFailedPinAttempt as jest.Mock).mockResolvedValueOnce(1);
  const { getByLabelText, findByText } = renderLock();
  await act(async () => {
    fireEvent.changeText(getByLabelText('Enter your 4-digit PIN'), '1111');
  });
  expect(await findByText(/4 tries left/)).toBeTruthy();
  expect(useLockStore.getState().locked).toBe(true);
});

it('signs out after the last allowed attempt', async () => {
  (recordFailedPinAttempt as jest.Mock).mockResolvedValueOnce(5);
  const { getByLabelText } = renderLock();
  await act(async () => {
    fireEvent.changeText(getByLabelText('Enter your 4-digit PIN'), '1111');
  });
  await waitFor(() => expect(useAuthStore.getState().clearAuth).toHaveBeenCalled());
  expect(router.replace).toHaveBeenCalledWith('/(auth)/society-select');
});

describe('a lockout that survived an app kill', () => {
  afterEach(() => {
    (getPinAttempts as jest.Mock).mockResolvedValue(0);
  });

  it('signs out on mount when the counter is already at the limit', async () => {
    (getPinAttempts as jest.Mock).mockResolvedValue(5);
    renderLock();
    await waitFor(() => expect(useAuthStore.getState().clearAuth).toHaveBeenCalledTimes(1));
    expect(router.replace).toHaveBeenCalledWith('/(auth)/society-select');
  });

  it('never checks another PIN — not even the right one — past the limit', async () => {
    (getPinAttempts as jest.Mock).mockResolvedValue(5);
    const { getByLabelText } = renderLock();
    await act(async () => {
      fireEvent.changeText(getByLabelText('Enter your 4-digit PIN'), '2580');
    });
    expect(verifyPin).not.toHaveBeenCalled();
    expect(useLockStore.getState().locked).toBe(true);
    // One sign-out, however many paths asked for it.
    await waitFor(() => expect(useAuthStore.getState().clearAuth).toHaveBeenCalledTimes(1));
  });

  it('never shows a negative number of tries', async () => {
    (getPinAttempts as jest.Mock).mockResolvedValue(7);
    const { queryByText, findByText } = renderLock();
    expect(await findByText(/0 tries left/)).toBeTruthy();
    expect(queryByText(/-\d+ tr/)).toBeNull();
  });
});
