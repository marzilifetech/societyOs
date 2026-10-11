/**
 * The check-in gate judges the fix taken AT check-in, not the one captured
 * when the Duty tab first mounted (which can be minutes old and metres away).
 */
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  // The hook refreshes its fix on focus; in a test, "focus" is the mount.
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(() => cb(), [cb]);
  },
}));
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn().mockResolvedValue(false),
  isEnrolledAsync: jest.fn().mockResolvedValue(false),
  authenticateAsync: jest.fn(),
}));
jest.mock('../src/lib/permissions', () => ({
  checkPermission: jest.fn().mockResolvedValue({ granted: true, outcome: 'granted' }),
  ensurePermission: jest.fn().mockResolvedValue({ granted: true, outcome: 'granted' }),
}));
jest.mock('../src/lib/api', () => ({ api: { post: jest.fn() } }));
jest.mock('../src/lib/unwrapped-get', () => ({
  getUnwrapped: jest.fn(async (path: string) =>
    path === '/staff/society'
      ? { geofenceCenter: { lat: 19.076, lng: 72.8777 }, geofenceRadius: 100 }
      : {},
  ),
  getUnwrappedArray: jest.fn().mockResolvedValue([]),
}));
jest.mock('../src/store/auth.store', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ user: { id: 'staff-1' } }),
}));

import React from 'react';
import { Alert } from 'react-native';
import * as Location from 'expo-location';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAttendance } from '../src/hooks/useAttendance';
import { api } from '../src/lib/api';

const INSIDE = { coords: { latitude: 19.076, longitude: 72.8777, accuracy: 5 }, mocked: false };
// ~1.1 km north of the centre; the fence is 100 m.
const OUTSIDE = { coords: { latitude: 19.086, longitude: 72.8777, accuracy: 5 }, mocked: false };

const getPos = Location.getCurrentPositionAsync as jest.Mock;
const post = api.post as jest.Mock;

function renderAttendance() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return renderHook(() => useAttendance(1, 2026, false), { wrapper });
}

beforeAll(() => {
  (Location as unknown as { hasServicesEnabledAsync: jest.Mock }).hasServicesEnabledAsync = jest
    .fn()
    .mockResolvedValue(true);
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  post.mockResolvedValue({});
});

it('checks in when the fresh fix is inside, though the tab mounted outside', async () => {
  getPos.mockResolvedValueOnce(OUTSIDE).mockResolvedValue(INSIDE);
  const { result } = renderAttendance();
  await waitFor(() => expect(result.current.distance).toBeGreaterThan(0));
  expect(result.current.insideGeofence).toBe(false);

  await act(async () => {
    await result.current.checkIn();
  });

  expect(Alert.alert).not.toHaveBeenCalledWith('duty.outsideSocietyTitle', expect.anything());
  expect(post).toHaveBeenCalledWith(
    '/staff/check-in',
    expect.objectContaining({ lat: 19.076, lng: 72.8777 }),
  );
  // The chip follows the fresh fix too.
  expect(result.current.insideGeofence).toBe(true);
});

it('refuses when the fresh fix is outside, though the tab mounted inside', async () => {
  getPos.mockResolvedValueOnce(INSIDE).mockResolvedValue(OUTSIDE);
  const { result } = renderAttendance();
  await waitFor(() => expect(result.current.distance).toBe(0));

  await act(async () => {
    await result.current.checkIn();
  });

  expect(Alert.alert).toHaveBeenCalledWith('duty.outsideSocietyTitle', 'duty.outsideSocietyBody');
  expect(post).not.toHaveBeenCalled();
});

it("leaves the final word to the server's OUTSIDE_GEOFENCE", async () => {
  getPos.mockResolvedValue(INSIDE);
  post.mockRejectedValueOnce(Object.assign(new Error('outside'), { code: 'OUTSIDE_GEOFENCE' }));
  const { result } = renderAttendance();
  await waitFor(() => expect(result.current.distance).toBe(0));

  await act(async () => {
    await result.current.checkIn();
  });

  expect(post).toHaveBeenCalledTimes(1);
  expect(Alert.alert).toHaveBeenCalledWith(
    'duty.couldNotCheckIn',
    expect.stringMatching(/outside the society/),
  );
});
