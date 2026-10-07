/**
 * Notification tap routing in src/lib/push.ts.
 *
 * The cold-start case is the important one: a resident taps "visitor at the
 * gate" while the app is closed. The tap must survive the launch and open the
 * visitor screen once Home is up, instead of being thrown away because no
 * navigator existed yet.
 */

const mockNavigate = jest.fn();
jest.mock('../src/lib/deferred-navigation', () => ({
  navigateWhenAppReady: (...a: unknown[]) => mockNavigate(...a),
}));
jest.mock('../src/lib/api', () => ({ api: { post: jest.fn().mockResolvedValue(undefined) } }));

const mockGetLastResponse = jest.fn();
const mockAddResponseListener = jest.fn();
jest.mock('expo-notifications', () => ({
  AndroidImportance: { MIN: 1, LOW: 2, DEFAULT: 3, HIGH: 4, MAX: 5 },
  AndroidNotificationVisibility: { UNKNOWN: 0, PUBLIC: 1, PRIVATE: 2, SECRET: 3 },
  DEFAULT_ACTION_IDENTIFIER: 'default',
  getLastNotificationResponseAsync: (...a: unknown[]) => mockGetLastResponse(...a),
  addNotificationResponseReceivedListener: (cb: unknown) => {
    mockAddResponseListener(cb);
    return { remove: jest.fn() };
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { hrefForNotification, setupTapRouting, type PushData } from '../src/lib/push';
import { api } from '../src/lib/api';

function response(id: string, data: PushData, actionIdentifier = 'default') {
  return { actionIdentifier, notification: { request: { identifier: id, content: { data } } } };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('hrefForNotification', () => {
  it.each<[string, PushData, string | null]>([
    ['visitor approval', { type: 'visitor_approvals', entityId: 'v1' }, '/visitor/review/v1'],
    [
      'gate visitor (legacy visitId)',
      { type: 'visitors_gate', visitId: 'v2' },
      '/visitor/review/v2',
    ],
    ['visitor approval without id', { type: 'visitor_approvals' }, null],
    ['delivery with id', { type: 'deliveries', entityId: 'd1' }, '/visitor/review/d1'],
    ['delivery without id', { type: 'deliveries' }, '/packages'],
    ['complaint with id', { type: 'complaints', entityId: 'c1' }, '/complaints/c1'],
    ['complaint without id', { type: 'complaints' }, '/complaints'],
    ['notice', { type: 'notices' }, '/(tabs)/notices'],
    ['urgent notice', { type: 'notices_urgent' }, '/(tabs)/notices'],
    ['community', { type: 'community' }, '/(tabs)/notices'],
    ['emergency', { type: 'emergency_sos' }, '/medical/sos'],
    [
      'legacy visitor request',
      { type: 'VISITOR_APPROVAL_REQUEST', visitId: 'v3' },
      '/visitor/review/v3',
    ],
    [
      'legacy delivery request',
      { type: 'DELIVERY_APPROVAL_REQUEST', entityId: 'd2' },
      '/visitor/review/d2',
    ],
    ['legacy arrival without id', { type: 'VISITOR_ARRIVAL' }, null],
    ['legacy complaint update', { type: 'COMPLAINT_UPDATED', entityId: 'c2' }, '/complaints/c2'],
    ['legacy complaint update, visitId only', { type: 'COMPLAINT_UPDATED', visitId: 'x' }, null],
    ['legacy package', { type: 'PACKAGE_ARRIVED' }, '/packages'],
    ['legacy notice', { type: 'NOTICE_PUBLISHED' }, '/(tabs)/notices'],
    ['legacy SOS', { type: 'SOS_TRIGGERED' }, '/medical/sos'],
    ['legacy SOS short', { type: 'SOS' }, '/medical/sos'],
    ['unknown type', { type: 'something_new' }, '/notifications'],
    ['no type', {}, '/notifications'],
  ])('%s', (_label, data, expected) => {
    expect(hrefForNotification(data)).toBe(expected);
  });

  it('null data goes nowhere', () => {
    expect(hrefForNotification(null)).toBeNull();
  });
});

describe('setupTapRouting', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('cold start: a new tap is routed through the deferred navigator', async () => {
    mockGetLastResponse.mockResolvedValue(
      response('n1', { type: 'visitor_approvals', entityId: 'v9' }),
    );
    setupTapRouting();
    await flush();
    expect(mockNavigate).toHaveBeenCalledWith('/visitor/review/v9');
  });

  it('cold start: an old tap replayed by the OS is ignored', async () => {
    await AsyncStorage.setItem('last_handled_notification_response', 'n1');
    mockGetLastResponse.mockResolvedValue(response('n1', { type: 'notices' }));
    setupTapRouting();
    await flush();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('cold start: an Approve tapped on the lock screen is sent AND routed', async () => {
    mockGetLastResponse.mockResolvedValue(
      response('n2', { type: 'visitor_approvals', entityId: 'v4' }, 'APPROVE'),
    );
    setupTapRouting();
    await flush();
    expect(api.post).toHaveBeenCalledWith('/visitors/v4/decision', { action: 'APPROVE' });
    expect(mockNavigate).toHaveBeenCalledWith('/visitor/review/v4');
  });

  it('warm tap: routed through the deferred navigator too', async () => {
    mockGetLastResponse.mockResolvedValue(null);
    setupTapRouting();
    const onResponse = mockAddResponseListener.mock.calls[0][0];
    onResponse(response('n3', { type: 'complaints', entityId: 'c7' }));
    expect(mockNavigate).toHaveBeenCalledWith('/complaints/c7');
  });

  it('warm action tap decides without navigating', async () => {
    mockGetLastResponse.mockResolvedValue(null);
    setupTapRouting();
    const onResponse = mockAddResponseListener.mock.calls[0][0];
    onResponse(response('n4', { type: 'deliveries', entityId: 'd5' }, 'LEAVE_AT_SECURITY'));
    await flush();
    expect(api.post).toHaveBeenCalledWith('/visitors/d5/decision', { action: 'LEAVE_AT_SECURITY' });
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
