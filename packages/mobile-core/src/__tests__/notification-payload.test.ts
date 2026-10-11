import {
  notificationEntityId,
  readNotificationData,
  toBannerPayload,
} from '../notification-payload';

describe('readNotificationData', () => {
  it('returns {} for missing, primitive or array data', () => {
    expect(readNotificationData(undefined)).toEqual({});
    expect(readNotificationData('x')).toEqual({});
    expect(readNotificationData([1])).toEqual({});
  });
});

describe('notificationEntityId', () => {
  it('prefers entityId, then id, visitId, alertId', () => {
    expect(notificationEntityId({ entityId: 'e', id: 'i' })).toBe('e');
    expect(notificationEntityId({ id: 'i', visitId: 'v' })).toBe('i');
    expect(notificationEntityId({ visitId: 'v' })).toBe('v');
    // SOS pushes carry only alertId — this used to resolve to nothing.
    expect(notificationEntityId({ type: 'SOS_TRIGGERED', alertId: 'a' })).toBe('a');
  });

  it('ignores empty and non-string values', () => {
    expect(notificationEntityId({ entityId: '', id: 42, alertId: 'a' })).toBe('a');
    expect(notificationEntityId({})).toBeUndefined();
  });
});

describe('toBannerPayload', () => {
  it('normalises a notification for the banner', () => {
    expect(
      toBannerPayload({
        identifier: 'n1',
        title: null,
        body: undefined,
        data: { type: 'TASK_ASSIGNED', entityId: 't1', actionGroup: 'task_assignment' },
        attachments: [{ url: 'https://img' }],
      }),
    ).toEqual({
      id: 'n1',
      title: 'Notification',
      body: '',
      imageUrl: 'https://img',
      type: 'TASK_ASSIGNED',
      entityId: 't1',
      actionGroup: 'task_assignment',
      data: { type: 'TASK_ASSIGNED', entityId: 't1', actionGroup: 'task_assignment' },
    });
  });
});
