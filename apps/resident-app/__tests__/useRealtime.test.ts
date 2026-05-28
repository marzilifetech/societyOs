/**
 * Tests for apps/resident-app/src/hooks/useRealtime.ts
 *
 * Verifies socket connection, all event handlers, notification scheduling,
 * and cleanup on unmount.
 */

import { renderHook, act } from '@testing-library/react-native';

// socket mock — use delegation closures so the mock-prefixed vars are read
// at call time (after module init) rather than at factory call time
const mockSocket = {
  on: jest.fn(),
  off: jest.fn(),
};

const mockConnectSocket = jest.fn();
const mockDisconnectSocket = jest.fn();
const mockGetSocket: jest.Mock<any, any[]> = jest.fn(() => mockSocket);

jest.mock('../src/lib/socket', () => ({
  connectSocket: (...args: any[]) => mockConnectSocket(...args),
  disconnectSocket: (...args: any[]) => mockDisconnectSocket(...args),
  getSocket: (...args: any[]) => mockGetSocket(...args),
}));

// expo-notifications — inline jest.fn() avoids the hoisting undefined issue;
// references are obtained via import after mock is established
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  scheduleNotificationAsync: jest.fn().mockResolvedValue(undefined),
}));

import * as Notifications from 'expo-notifications';
import { Alert, Vibration } from 'react-native';
import { useRealtime } from '../src/hooks/useRealtime';

// The notification handler is registered lazily on first hook mount (Expo Go
// SDK 52 New Architecture cannot tolerate setNotificationHandler at module
// scope — see comment in src/hooks/useRealtime.ts). Tests below mount the
// hook before asserting; this captures the registered config on first call.
const mockSetNotificationHandler = Notifications.setNotificationHandler as jest.Mock;
const mockScheduleNotification = Notifications.scheduleNotificationAsync as jest.Mock;

const mockAlert = jest.fn();
const mockVibrate = jest.fn();

// Captured once on first hook mount — the hook lazy-registers
// setNotificationHandler exactly once per module load (guarded by an internal
// flag in useRealtime.ts), so we snapshot it here before any beforeEach
// clearAllMocks wipes the call history.
let capturedHandlerConfig: { handleNotification: () => Promise<any> } | null = null;

describe('useRealtime', () => {
  beforeAll(() => {
    renderHook(() => useRealtime());
    capturedHandlerConfig = (mockSetNotificationHandler.mock.calls[0]?.[0] ?? null) as
      | { handleNotification: () => Promise<any> }
      | null;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Spy on Alert/Vibration from react-native (already mocked by jest-expo preset).
    // This avoids jest.requireActual which would trigger TurboModule loading.
    jest.spyOn(Alert, 'alert').mockImplementation(mockAlert);
    jest.spyOn(Vibration, 'vibrate').mockImplementation(mockVibrate);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('calls connectSocket and getSocket on mount', () => {
    renderHook(() => useRealtime());
    expect(mockConnectSocket).toHaveBeenCalledTimes(1);
    expect(mockGetSocket).toHaveBeenCalledTimes(1);
  });

  it('registers 4 socket event listeners', () => {
    renderHook(() => useRealtime());
    expect(mockSocket.on).toHaveBeenCalledTimes(4);
    const events = mockSocket.on.mock.calls.map((c: any) => c[0]);
    expect(events).toContain('visitor:arrived');
    expect(events).toContain('complaint:updated');
    expect(events).toContain('package:arrived');
    expect(events).toContain('emergency:broadcast');
  });

  it('registers a notification handler lazily on first hook mount', () => {
    expect(capturedHandlerConfig).not.toBeNull();
  });

  it('setNotificationHandler handleNotification returns correct foreground display options', async () => {
    expect(capturedHandlerConfig).not.toBeNull();
    const result = await capturedHandlerConfig!.handleNotification();
    expect(result).toMatchObject({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    });
  });

  it('cleanup: calls socket.off for all events and disconnectSocket', () => {
    const { unmount } = renderHook(() => useRealtime());
    unmount();
    expect(mockSocket.off).toHaveBeenCalledTimes(4);
    expect(mockDisconnectSocket).toHaveBeenCalledTimes(1);
  });

  it('visitor:arrived schedules a local notification', async () => {
    renderHook(() => useRealtime());
    const visitorHandler = mockSocket.on.mock.calls.find((c: any) => c[0] === 'visitor:arrived')[1];
    await act(async () => { visitorHandler({ visitorName: 'John' }); });
    expect(mockScheduleNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({ title: 'Visitor Arrived', body: 'John is at the gate' }),
      }),
    );
  });

  it('visitor:arrived uses "Someone" fallback when visitorName is absent', async () => {
    renderHook(() => useRealtime());
    const handler = mockSocket.on.mock.calls.find((c: any) => c[0] === 'visitor:arrived')[1];
    await act(async () => { handler({}); });
    expect(mockScheduleNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({ body: 'Someone is at the gate' }),
      }),
    );
  });

  it('visitor:arrived falls back to Alert when scheduleNotificationAsync throws', async () => {
    mockScheduleNotification.mockRejectedValueOnce(new Error('No permission'));
    renderHook(() => useRealtime());
    const handler = mockSocket.on.mock.calls.find((c: any) => c[0] === 'visitor:arrived')[1];
    await act(async () => { handler({ visitorName: 'Jane' }); });
    expect(mockAlert).toHaveBeenCalledWith('Visitor Arrived', 'Jane is at the gate');
  });

  it('complaint:updated shows Alert with status', () => {
    renderHook(() => useRealtime());
    const handler = mockSocket.on.mock.calls.find((c: any) => c[0] === 'complaint:updated')[1];
    act(() => { handler({ status: 'RESOLVED' }); });
    expect(mockAlert).toHaveBeenCalledWith('Complaint Update', 'Status changed to RESOLVED');
  });

  it('complaint:updated uses "unknown" fallback when status is absent', () => {
    renderHook(() => useRealtime());
    const handler = mockSocket.on.mock.calls.find((c: any) => c[0] === 'complaint:updated')[1];
    act(() => { handler({}); });
    expect(mockAlert).toHaveBeenCalledWith('Complaint Update', 'Status changed to unknown');
  });

  it('package:arrived shows Alert with courier name', () => {
    renderHook(() => useRealtime());
    const handler = mockSocket.on.mock.calls.find((c: any) => c[0] === 'package:arrived')[1];
    act(() => { handler({ courierName: 'DHL' }); });
    expect(mockAlert).toHaveBeenCalledWith('Package Arrived', 'DHL parcel is at reception');
  });

  it('package:arrived uses "A courier" fallback', () => {
    renderHook(() => useRealtime());
    const handler = mockSocket.on.mock.calls.find((c: any) => c[0] === 'package:arrived')[1];
    act(() => { handler({}); });
    expect(mockAlert).toHaveBeenCalledWith('Package Arrived', 'A courier parcel is at reception');
  });

  it('emergency:broadcast vibrates when severity is EMERGENCY', () => {
    renderHook(() => useRealtime());
    const handler = mockSocket.on.mock.calls.find((c: any) => c[0] === 'emergency:broadcast')[1];
    act(() => { handler({ severity: 'EMERGENCY', message: 'Fire!' }); });
    expect(mockVibrate).toHaveBeenCalledWith([0, 500, 200, 500]);
    expect(mockAlert).toHaveBeenCalledWith('⚠️ Emergency Alert', 'Fire!');
  });

  it('emergency:broadcast does NOT vibrate for non-EMERGENCY severity', () => {
    renderHook(() => useRealtime());
    const handler = mockSocket.on.mock.calls.find((c: any) => c[0] === 'emergency:broadcast')[1];
    act(() => { handler({ severity: 'WARNING', message: 'Water leak' }); });
    expect(mockVibrate).not.toHaveBeenCalled();
    expect(mockAlert).toHaveBeenCalledWith('⚠️ Emergency Alert', 'Water leak');
  });

  it('emergency:broadcast uses title fallback when message is absent', () => {
    renderHook(() => useRealtime());
    const handler = mockSocket.on.mock.calls.find((c: any) => c[0] === 'emergency:broadcast')[1];
    act(() => { handler({ title: 'Drill' }); });
    expect(mockAlert).toHaveBeenCalledWith('⚠️ Emergency Alert', 'Drill');
  });

  it('emergency:broadcast uses generic fallback when both message and title are absent', () => {
    renderHook(() => useRealtime());
    const handler = mockSocket.on.mock.calls.find((c: any) => c[0] === 'emergency:broadcast')[1];
    act(() => { handler({}); });
    expect(mockAlert).toHaveBeenCalledWith('⚠️ Emergency Alert', 'Emergency notice from management');
  });
});
