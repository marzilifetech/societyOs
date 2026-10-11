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
  appNavigator: { navigateWhenReady: (...a: unknown[]) => mockNavigate(...a) },
}));
jest.mock('../src/lib/api', () => ({ api: { post: jest.fn().mockResolvedValue(undefined) } }));
// Taps only route into a signed-in app; the store's token is set per test.
const mockAuth = { token: 'tok' as string | null, hydrate: jest.fn().mockResolvedValue(undefined) };
jest.mock('../src/store/auth.store', () => ({ useAuthStore: { getState: () => mockAuth } }));

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

/** A push tap: the router is given the payload's own `data.type`. */
const tap = (data: PushData) => hrefForNotification(data.type as string | undefined, data);

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
    [
      'deliveries category for a parcel (packageId) is not a visit',
      { type: 'deliveries', entityId: 'p1', packageId: 'p1' },
      '/packages',
    ],
    ['complaint with id', { type: 'complaints', entityId: 'c1' }, '/complaints/c1'],
    ['complaint without id', { type: 'complaints' }, '/complaints'],
    [
      'complaints category for a service request',
      { type: 'complaints', entityId: 'x', serviceRequestId: 'sr1' },
      '/services/sr1',
    ],
    ['notice', { type: 'notices' }, '/(tabs)/notices'],
    ['urgent notice', { type: 'notices_urgent' }, '/(tabs)/notices'],
    ['community', { type: 'community' }, '/(tabs)/notices'],
    ['emergency', { type: 'emergency_sos' }, '/medical/sos'],
    ['payments category', { type: 'payments_dues' }, '/maintenance'],
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
    ['visitor checked in', { type: 'VISITOR_ARRIVAL', visitId: 'v5' }, '/visitor/v5'],
    ['visitor checked in, no id', { type: 'VISITOR_ARRIVAL' }, '/(tabs)/visitors'],
    [
      'visitor decision result',
      { type: 'VISITOR_DECISION_RESULT', entityId: 'v6', visitId: 'v6' },
      '/visitor/v6',
    ],
    ['legacy complaint update', { type: 'COMPLAINT_UPDATED', entityId: 'c2' }, '/complaints/c2'],
    ['package arrived (packageId only)', { type: 'PACKAGE_ARRIVED', packageId: 'p2' }, '/packages'],
    ['package collected', { type: 'PACKAGE_COLLECTED', entityId: 'p3' }, '/packages'],
    ['bill', { type: 'BILL_GENERATED', period: '2026-10' }, '/maintenance'],
    ['payment received', { type: 'PAYMENT_RECEIVED' }, '/maintenance'],
    ['payment failed', { type: 'PAYMENT_FAILED' }, '/maintenance'],
    [
      'service request created',
      { type: 'SERVICE_REQUEST_CREATED', entityId: 'sr2', serviceRequestId: 'sr2' },
      '/services/sr2',
    ],
    ['service request, entityId only', { type: 'SERVICE_REQUEST_COMPLETED', entityId: 'sr3' }, '/services/sr3'],
    ['service request without id', { type: 'SERVICE_REQUEST_RATE' }, '/(tabs)/services'],
    ['amenity booking', { type: 'AMENITY_BOOKING_CONFIRMED', entityId: 'b1' }, '/amenities/bookings'],
    ['amenity cancelled', { type: 'AMENITY_BOOKING_CANCELLED' }, '/amenities/bookings'],
    ['housekeeping', { type: 'HOUSEKEEPING_SCHEDULED', entityId: 'h1' }, '/housekeeping'],
    ['event', { type: 'EVENT_CREATED', entityId: 'e1' }, '/(tabs)/events'],
    ['event waitlist', { type: 'EVENT_WAITLIST_PROMOTED' }, '/(tabs)/events'],
    ['AGM meeting', { type: 'AGM_MEETING_CREATED', entityId: 'm1', meetingId: 'm1' }, '/agm/m1'],
    ['AGM meeting without id', { type: 'AGM_MEETING_CREATED' }, '/agm'],
    ['legacy notice', { type: 'NOTICE_PUBLISHED' }, '/(tabs)/notices'],
    ['emergency broadcast', { type: 'EMERGENCY_BROADCAST' }, '/(tabs)/notices'],
    ['admin push', { type: 'ADMIN_PUSH' }, '/notifications'],
    ['legacy SOS', { type: 'SOS_TRIGGERED' }, '/medical/sos'],
    ['SOS (alertId only)', { type: 'SOS', alertId: 'a1' }, '/medical/sos'],
    ['unknown type', { type: 'something_new' }, '/notifications'],
    ['no type', {}, '/notifications'],
  ])('%s', (_label, data, expected) => {
    expect(tap(data)).toBe(expected);
  });

  describe('inbox rows (stored category + the push data)', () => {
    it('prefers the event name in data over the category', () => {
      const data = { type: 'SERVICE_REQUEST_COMPLETED', entityId: 'sr4', serviceRequestId: 'sr4' };
      expect(hrefForNotification('complaints', data)).toBe('/services/sr4');
    });

    it('a check-in filed under visitors_gate opens the visit, not the review screen', () => {
      const data = { type: 'VISITOR_ARRIVAL', visitId: 'v7' };
      expect(hrefForNotification('visitors_gate', data)).toBe('/visitor/v7');
    });

    it('falls back to the category when data has no type', () => {
      expect(hrefForNotification('payments_dues', {})).toBe('/maintenance');
      expect(hrefForNotification('deliveries', { packageId: 'p4' })).toBe('/packages');
    });

    it('unknown category and data type open the inbox', () => {
      expect(hrefForNotification('uncategorized', { type: 'MARKETING' })).toBe('/notifications');
      expect(hrefForNotification(null, {})).toBe('/notifications');
    });
  });
});

describe('setupTapRouting', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockAuth.token = 'tok';
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
    await flush();
    expect(mockNavigate).toHaveBeenCalledWith('/complaints/c7');
  });

  it('a tap that arrives signed out goes nowhere', async () => {
    mockAuth.token = null;
    mockGetLastResponse.mockResolvedValue(
      response('n5', { type: 'visitor_approvals', entityId: 'v8' }),
    );
    setupTapRouting();
    await flush();
    const onResponse = mockAddResponseListener.mock.calls[0][0];
    onResponse(response('n6', { type: 'complaints', entityId: 'c8' }));
    await flush();
    expect(mockNavigate).not.toHaveBeenCalled();
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
