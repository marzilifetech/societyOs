/**
 * One routing table for lockscreen taps, the in-app banner and the inbox.
 * Each used to carry its own copy; they drifted, and SOS opened an empty
 * help-request list from all three.
 */
jest.mock('../src/lib/api', () => ({ api: { post: jest.fn().mockResolvedValue({}) } }));

import { api } from '../src/lib/api';
import {
  actionsForGroup,
  categoryOf,
  hrefForNotification,
  isEmergencyNotification,
  performNotificationAction,
  visualForNotification,
} from '../src/lib/notification-routes';
import { entryRoute } from '../src/lib/navigation';

describe('hrefForNotification', () => {
  it.each([
    ['staff_tasks', { entityId: 't1' }, '/tasks/t1'],
    ['TASK_ASSIGNED', { entityId: 't1' }, '/tasks/t1'],
    ['staff_tasks', {}, '/(tabs)/tasks'],
    ['staff_help_requests', { id: 'h1' }, '/help-requests/h1'],
    ['visitors_gate', { visitId: 'v1' }, '/visitors'],
    ['VISITOR_DECISION_RESULT', { entityId: 'v1' }, '/visitors'],
    ['notices_urgent', {}, '/community/notices'],
    ['LEAVE_APPROVED', { entityId: 'l1' }, '/leave/history'],
    ['LEAVE_REJECTED', {}, '/leave/history'],
    ['review', {}, '/reviews'],
    ['payments', {}, '/salary'],
    ['ADMIN_PUSH', {}, '/notifications'],
    [undefined, {}, '/notifications'],
  ])('%s → %s', (type, data, href) => {
    expect(hrefForNotification(type as string | undefined, data)).toBe(href);
  });

  it('opens the active-SOS screen for an SOS push that carries only alertId', () => {
    expect(hrefForNotification('SOS_TRIGGERED', { alertId: 'a 1' })).toBe('/sos/alerts?focus=a%201');
    expect(hrefForNotification('emergency_sos', {})).toBe('/sos/alerts');
  });
});

describe('categoryOf / visuals', () => {
  it('maps legacy names onto categories and passes unknown types through', () => {
    expect(categoryOf('SOS_TRIGGERED')).toBe('emergency_sos');
    expect(categoryOf('custom')).toBe('custom');
    expect(categoryOf(undefined)).toBe('');
  });

  it('has a visual for every type, with a default', () => {
    expect(visualForNotification('emergency_sos').icon).toBe('alert');
    expect(visualForNotification('nonsense').icon).toBe('notifications');
  });

  it('flags emergencies', () => {
    expect(isEmergencyNotification('sos')).toBe(true);
    expect(isEmergencyNotification('staff_tasks')).toBe(false);
  });
});

describe('actions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('offers buttons only for groups the staff app handles', () => {
    expect(actionsForGroup('task_assignment')?.map((a) => a.id)).toEqual(['REJECT', 'ACCEPT']);
    expect(actionsForGroup('help_request')?.map((a) => a.id)).toEqual(['DECLINE', 'ACCEPT']);
    expect(actionsForGroup('visitor_approval')).toBeNull();
    expect(actionsForGroup(undefined)).toBeNull();
  });

  it.each([
    ['task_assignment', 'ACCEPT', '/service-requests/x/accept'],
    ['task_assignment', 'REJECT', '/service-requests/x/reject'],
    ['help_request', 'ACCEPT', '/staff/help-requests/x/accept'],
    ['help_request', 'DECLINE', '/staff/help-requests/x/decline'],
  ])('%s/%s posts to %s', async (group, action, path) => {
    await expect(performNotificationAction(group, action, 'x')).resolves.toBe(true);
    expect(api.post).toHaveBeenCalledWith(path, {});
  });

  it('does nothing for an unknown pair', async () => {
    await expect(performNotificationAction('visitor_approval', 'APPROVE', 'x')).resolves.toBe(false);
    expect(api.post).not.toHaveBeenCalled();
  });

  it('propagates failures so the caller can show them', async () => {
    (api.post as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    await expect(performNotificationAction('task_assignment', 'ACCEPT', 'x')).rejects.toThrow('offline');
  });

  it('encodes the id into the path', async () => {
    await performNotificationAction('task_assignment', 'ACCEPT', '../admin');
    expect(api.post).toHaveBeenCalledWith('/service-requests/..%2Fadmin/accept', {});
  });
});

describe('entryRoute', () => {
  it('decides the launch destination once', () => {
    expect(entryRoute(null, false)).toBe('/(auth)/society-select');
    expect(entryRoute(null, true)).toBe('/(auth)/society-select');
    expect(entryRoute('tok', false)).toBe('/(auth)/pin-setup');
    expect(entryRoute('tok', true)).toBe('/(tabs)');
  });
});
