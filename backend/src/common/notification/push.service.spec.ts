import { PushService, PushNotification } from './push.service';

// --- firebase-admin mock --------------------------------------------------
// admin.apps.length truthy => PushService marks itself initialized in the ctor.
const mockSendEachForMulticast = jest.fn();
const mockSend = jest.fn();

jest.mock('firebase-admin', () => ({
  apps: [{}], // truthy length => initialized = true, no real init attempted
  credential: { cert: jest.fn() },
  initializeApp: jest.fn(),
  messaging: () => ({
    sendEachForMulticast: mockSendEachForMulticast,
    send: mockSend,
  }),
}));

// --- helpers --------------------------------------------------------------
function makePrisma() {
  return {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    device: {
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    notificationPreference: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    notificationLog: {
      create: jest.fn().mockResolvedValue({ id: 'log-1' }),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      update: jest.fn().mockResolvedValue({ id: 'log-1' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      delete: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(0),
      groupBy: jest.fn().mockResolvedValue([]),
    },
  };
}

function makeConfig(): any {
  return { get: jest.fn().mockReturnValue(undefined) };
}

const okResponse = (count: number) => ({
  successCount: count,
  failureCount: 0,
  responses: Array.from({ length: count }, () => ({ success: true })),
});

function makeService(prisma: any) {
  const svc = new PushService(makeConfig(), prisma as any);
  return svc;
}

const baseNotification: PushNotification = {
  title: 'Hello',
  body: 'World',
  category: 'complaints', // mutable category
};

describe('PushService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSendEachForMulticast.mockResolvedValue(okResponse(1));
  });

  it('skips send when opted-out via a NotificationPreference row on a mutable category', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', phone: '+910000000000' });
    prisma.notificationPreference.findUnique.mockResolvedValue({ enabled: false });

    const svc = makeService(prisma);
    const res = await (svc as any).sendNow('u1', baseNotification, undefined);

    expect(res).toEqual({ ok: false, reason: 'opted_out' });
    expect(mockSendEachForMulticast).not.toHaveBeenCalled();
    expect(prisma.notificationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'SKIPPED' }) }),
    );
  });

  it('still sends for a force-on category even when a disabled preference row exists', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', phone: '+910000000000' });
    prisma.notificationPreference.findUnique.mockResolvedValue({ enabled: false });
    prisma.device.findMany.mockResolvedValue([{ token: 'tok-sos' }]);

    const svc = makeService(prisma);
    const res = await (svc as any).sendNow(
      'u1',
      { title: 'SOS', body: 'Help', category: 'emergency_sos' },
      undefined,
    );

    expect(res).toEqual({ ok: true });
    // force-on => preference table should not even be consulted
    expect(prisma.notificationPreference.findUnique).not.toHaveBeenCalled();
    expect(mockSendEachForMulticast).toHaveBeenCalledTimes(1);
  });

  it('critical:true bypasses opt-out', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', phone: '+910000000000' });
    prisma.notificationPreference.findUnique.mockResolvedValue({ enabled: false });
    prisma.device.findMany.mockResolvedValue([{ token: 'tok-1' }]);

    const svc = makeService(prisma);
    const res = await (svc as any).sendNow(
      'u1',
      { title: 'Crit', body: 'now', category: 'complaints', critical: true },
      undefined,
    );

    expect(res).toEqual({ ok: true });
    expect(prisma.notificationPreference.findUnique).not.toHaveBeenCalled();
    expect(mockSendEachForMulticast).toHaveBeenCalledTimes(1);
  });

  it('multicasts to every Device token for the user', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', phone: '+910000000000', fcmToken: null });
    prisma.device.findMany.mockResolvedValue([{ token: 'tok-a' }, { token: 'tok-b' }]);
    mockSendEachForMulticast.mockResolvedValue(okResponse(2));

    const svc = makeService(prisma);
    const res = await (svc as any).sendNow('u1', baseNotification, undefined);

    expect(res).toEqual({ ok: true });
    const arg = mockSendEachForMulticast.mock.calls[0][0];
    expect(arg.tokens).toEqual(['tok-a', 'tok-b']);
  });

  it('de-dupes device tokens with the legacy fcmToken', async () => {
    const prisma = makePrisma();
    // user.findUnique is called for: the sendNow lookup (phone), the legacy
    // prefs fallback (notificationPrefs), and resolveTokens (fcmToken).
    prisma.user.findUnique.mockImplementation(({ select }: any) => {
      if (select?.fcmToken) return Promise.resolve({ fcmToken: 'tok-a' });
      if (select?.notificationPrefs) return Promise.resolve({ notificationPrefs: {} });
      return Promise.resolve({ id: 'u1', phone: '+910000000000' });
    });
    prisma.device.findMany.mockResolvedValue([{ token: 'tok-a' }, { token: 'tok-c' }]);
    mockSendEachForMulticast.mockResolvedValue(okResponse(2));

    const svc = makeService(prisma);
    await (svc as any).sendNow('u1', baseNotification, undefined);

    const arg = mockSendEachForMulticast.mock.calls[0][0];
    expect(arg.tokens).toEqual(['tok-a', 'tok-c']);
  });

  it('cleans up invalid Device tokens from a failed multicast response', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', phone: '+910000000000' });
    prisma.device.findMany.mockResolvedValue([{ token: 'good' }, { token: 'dead' }]);
    mockSendEachForMulticast.mockResolvedValue({
      successCount: 1,
      failureCount: 1,
      responses: [
        { success: true },
        {
          success: false,
          error: { errorInfo: { code: 'messaging/registration-token-not-registered' } },
        },
      ],
    });

    const svc = makeService(prisma);
    const res = await (svc as any).sendNow('u1', baseNotification, undefined);

    expect(res).toEqual({ ok: true });
    expect(prisma.device.deleteMany).toHaveBeenCalledWith({
      where: { token: { in: ['dead'] } },
    });
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { fcmToken: { in: ['dead'] } },
      data: { fcmToken: null },
    });
  });

  it('returns all_failed when no token succeeds', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', phone: '+910000000000' });
    prisma.device.findMany.mockResolvedValue([{ token: 'tok' }]);
    mockSendEachForMulticast.mockResolvedValue({
      successCount: 0,
      failureCount: 1,
      responses: [{ success: false, error: { message: 'internal' } }],
    });

    const svc = makeService(prisma);
    const res = await (svc as any).sendNow('u1', baseNotification, undefined);

    expect(res).toEqual({ ok: false, reason: 'all_failed' });
    expect(prisma.notificationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
    );
  });

  it('returns no_token when the user has no devices or fcmToken', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', phone: '+910000000000' });
    prisma.device.findMany.mockResolvedValue([]);

    const svc = makeService(prisma);
    const res = await (svc as any).sendNow('u1', baseNotification, undefined);

    expect(res).toEqual({ ok: false, reason: 'no_token' });
    expect(mockSendEachForMulticast).not.toHaveBeenCalled();
  });

  it('builds a simple message with android notification.imageUrl when imageUrl is provided', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', phone: '+910000000000' });
    prisma.device.findMany.mockResolvedValue([{ token: 'tok' }]);

    const svc = makeService(prisma);
    await (svc as any).sendNow(
      'u1',
      { ...baseNotification, imageUrl: 'https://cdn/x.jpg' },
      undefined,
    );

    const arg = mockSendEachForMulticast.mock.calls[0][0];
    expect(arg.notification).toEqual({ title: 'Hello', body: 'World' });
    expect(arg.android.notification.imageUrl).toBe('https://cdn/x.jpg');
  });

  it('builds a data-only message with serialized actions and no top-level notification block', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', phone: '+910000000000' });
    prisma.device.findMany.mockResolvedValue([{ token: 'tok' }]);

    const actions = [
      { id: 'approve', title: 'Approve' },
      { id: 'reject', title: 'Reject', destructive: true },
    ];
    const svc = makeService(prisma);
    await (svc as any).sendNow(
      'u1',
      { ...baseNotification, actions },
      { type: 'VISITOR' },
    );

    const arg = mockSendEachForMulticast.mock.calls[0][0];
    expect(arg.notification).toBeUndefined();
    expect(arg.data.title).toBe('Hello');
    expect(arg.data.body).toBe('World');
    expect(JSON.parse(arg.data.actions)).toEqual(actions);
    // Background/killed Android relies on the tray notification block — the
    // data payload alone is invisible until next app-open.
    expect(arg.android.notification).toEqual(
      expect.objectContaining({ channelId: 'system', title: 'Hello', body: 'World' }),
    );
    expect(arg.apns.payload.aps['content-available']).toBe(1);
    expect(arg.apns.payload.aps['mutable-content']).toBe(1);
    expect(arg.apns.payload.aps.category).toBe('complaints');
  });

  it('routes via the registry channelId with a 30-min TTL for approval-style pushes', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', phone: '+910000000000' });
    prisma.device.findMany.mockResolvedValue([{ token: 'tok' }]);

    const svc = makeService(prisma);
    await (svc as any).sendNow(
      'u1',
      { title: 'Guest', body: 'At gate', category: 'visitors_gate' },
      undefined,
    );

    const arg = mockSendEachForMulticast.mock.calls[0][0];
    expect(arg.android.notification.channelId).toBe('approvals');
    // Android group rides in data (FCM v1 has no android.notification.group);
    // it mirrors the iOS thread-id — both = channel bucket.
    expect(arg.data.group).toBe('approvals');
    expect(arg.android.ttl).toBe(30 * 60 * 1000);
    expect(arg.apns.headers['apns-expiration']).toBeDefined();
    expect(arg.apns.payload.aps['thread-id']).toBe('approvals');
  });

  it('sets aps.badge + android notificationCount to unread count + 1', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', phone: '+910000000000' });
    prisma.device.findMany.mockResolvedValue([{ token: 'tok' }]);
    prisma.notificationLog.count.mockResolvedValue(4);

    const svc = makeService(prisma);
    await (svc as any).sendNow('u1', baseNotification, undefined);

    const arg = mockSendEachForMulticast.mock.calls[0][0];
    expect(arg.apns.payload.aps.badge).toBe(5);
    expect(arg.android.notification.notificationCount).toBe(5);
  });

  it('persists NotificationLog.type = category key for inbox deep links', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', phone: '+910000000000' });
    prisma.device.findMany.mockResolvedValue([{ token: 'tok' }]);

    const svc = makeService(prisma);
    await (svc as any).sendNow(
      'u1',
      { title: 'Guest', body: 'At gate', category: 'visitors_gate' },
      { type: 'VISITOR_APPROVAL_REQUEST' },
    );

    expect(prisma.notificationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'visitors_gate', status: 'SENT' }),
      }),
    );
  });

  it('falls back to data.type for NotificationLog.type when no category is set', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', phone: '+910000000000' });
    prisma.device.findMany.mockResolvedValue([{ token: 'tok' }]);

    const svc = makeService(prisma);
    await (svc as any).sendNow(
      'u1',
      { title: 'Legacy', body: 'payload' },
      { type: 'RESIDENT_APPROVED' },
    );

    expect(prisma.notificationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'RESIDENT_APPROVED' }),
      }),
    );
  });

  it('applies collapse key to both android and apns headers', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', phone: '+910000000000' });
    prisma.device.findMany.mockResolvedValue([{ token: 'tok' }]);

    const svc = makeService(prisma);
    await (svc as any).sendNow('u1', { ...baseNotification, collapseKey: 'visitor-42' }, undefined);

    const arg = mockSendEachForMulticast.mock.calls[0][0];
    expect(arg.android.collapseKey).toBe('visitor-42');
    expect(arg.apns.headers['apns-collapse-id']).toBe('visitor-42');
  });

  it('returns user_not_found early', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue(null);

    const svc = makeService(prisma);
    const res = await (svc as any).sendNow('nope', baseNotification, undefined);

    expect(res).toEqual({ ok: false, reason: 'user_not_found' });
  });

  describe('sendToSocietyNow', () => {
    it('sends per-recipient (small fan-out) with badges and writes per-user inbox rows', async () => {
      const prisma = makePrisma();
      // Batched impl selects id + fcmToken + notificationPrefs in one query.
      prisma.user.findMany.mockResolvedValue([
        { id: 'u1', fcmToken: null, notificationPrefs: {} },
        { id: 'u2', fcmToken: 'legacy', notificationPrefs: {} },
      ]);
      // No stored category prefs => registry defaults (complaints is on).
      prisma.notificationPreference.findMany.mockResolvedValue([]);
      // One device query for all eligible recipients (userId + token).
      prisma.device.findMany.mockResolvedValue([
        { userId: 'u1', token: 't1' },
        { userId: 'u1', token: 't2' },
      ]);
      // u1 has 2 unread already; u2 none.
      prisma.notificationLog.groupBy.mockResolvedValue([
        { userId: 'u1', _count: { _all: 2 } },
      ]);
      mockSendEachForMulticast
        .mockResolvedValueOnce(okResponse(2))
        .mockResolvedValueOnce(okResponse(1));

      const svc = makeService(prisma);
      const res = await (svc as any).sendToSocietyNow('soc1', null, baseNotification, undefined);

      // device.findMany called exactly once (no N+1), with all eligible ids.
      expect(prisma.device.findMany).toHaveBeenCalledTimes(1);
      // ≤200 recipients → one message per recipient, each with its own badge.
      expect(mockSendEachForMulticast).toHaveBeenCalledTimes(2);
      const [msg1, msg2] = mockSendEachForMulticast.mock.calls.map((c) => c[0]);
      expect(msg1.tokens).toEqual(['t1', 't2']);
      expect(msg1.apns.payload.aps.badge).toBe(3); // 2 unread + this push
      expect(msg2.tokens).toEqual(['legacy']);
      expect(msg2.apns.payload.aps.badge).toBe(1);
      expect(res).toEqual({ sent: 3, failed: 0, cleaned: 0 });
      // Per-recipient inbox rows (the userId=null summary row is invisible
      // to the inbox query).
      expect(prisma.notificationLog.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ userId: 'u1', societyId: 'soc1', type: 'complaints', status: 'SENT' }),
          expect.objectContaining({ userId: 'u2', societyId: 'soc1', type: 'complaints', status: 'SENT' }),
        ]),
      });
      // Society-level audit summary row still written.
      expect(prisma.notificationLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'SENT', societyId: 'soc1', userId: null }),
        }),
      );
    });

    it('excludes users opted out via the preference table', async () => {
      const prisma = makePrisma();
      prisma.user.findMany.mockResolvedValue([
        { id: 'u1', fcmToken: null, notificationPrefs: {} },
        { id: 'u2', fcmToken: null, notificationPrefs: {} },
      ]);
      // u2 muted 'complaints' => only u1 eligible.
      prisma.notificationPreference.findMany.mockResolvedValue([
        { userId: 'u2', enabled: false },
      ]);
      prisma.device.findMany.mockResolvedValue([{ userId: 'u1', token: 't1' }]);
      mockSendEachForMulticast.mockResolvedValue(okResponse(1));

      const svc = makeService(prisma);
      await (svc as any).sendToSocietyNow('soc1', null, baseNotification, undefined);

      // device query scoped to eligible ids only (u1)
      const devArg = prisma.device.findMany.mock.calls[0][0];
      expect(devArg.where.userId.in).toEqual(['u1']);
    });

    it('returns zeros when no eligible tokens', async () => {
      const prisma = makePrisma();
      prisma.user.findMany.mockResolvedValue([{ id: 'u1', fcmToken: null, notificationPrefs: {} }]);
      prisma.notificationPreference.findMany.mockResolvedValue([]);
      prisma.device.findMany.mockResolvedValue([]);

      const svc = makeService(prisma);
      const res = await (svc as any).sendToSocietyNow('soc1', null, baseNotification, undefined);

      expect(res).toEqual({ sent: 0, failed: 0, cleaned: 0 });
      expect(mockSendEachForMulticast).not.toHaveBeenCalled();
    });
  });

  describe('quiet-hours deferral', () => {
    // 23:30 IST — squarely inside quiet hours (22:00–07:00).
    const QUIET_NOW = new Date('2026-07-06T23:30:00+05:30');

    afterEach(() => {
      jest.useRealTimers();
    });

    it('writes a DEFERRED log row and threads its id into the queued job', async () => {
      jest.useFakeTimers({ now: QUIET_NOW });
      const prisma = makePrisma();
      const svc = makeService(prisma);
      const add = jest.fn().mockResolvedValue({});
      (svc as any).deferQueue = { add };

      const queued = await (svc as any).enqueueDeferred({
        kind: 'user',
        userId: 'u1',
        notification: baseNotification,
        data: { type: 'COMPLAINT_UPDATE' },
      });

      expect(queued).toBe(true);
      expect(prisma.notificationLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'u1',
            status: 'DEFERRED',
            type: 'complaints',
          }),
        }),
      );
      const [name, job, opts] = add.mock.calls[0];
      expect(name).toBe('deliver');
      expect(job).toEqual(expect.objectContaining({ kind: 'user', userId: 'u1', logId: 'log-1' }));
      expect(opts.delay).toBeGreaterThan(0);
    });

    it('sends immediately (does not drop) when the queue is down during quiet hours', async () => {
      jest.useFakeTimers({ now: QUIET_NOW });
      const prisma = makePrisma();
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', phone: '+910000000000' });
      prisma.device.findMany.mockResolvedValue([{ token: 'tok' }]);

      const svc = makeService(prisma);
      (svc as any).deferQueue = {
        add: jest.fn().mockRejectedValue(new Error('redis down')),
      };

      const res = await svc.send('u1', baseNotification, undefined);

      // Losing a notification is worse than a late-night buzz: when the defer
      // queue is unavailable we fall through to an immediate send.
      expect(res.ok).toBe(true);
      expect(mockSendEachForMulticast).toHaveBeenCalled();
    });

    it('sends immediately during quiet hours when no queue is configured', async () => {
      jest.useFakeTimers({ now: QUIET_NOW });
      const prisma = makePrisma();
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', phone: '+910000000000' });
      prisma.device.findMany.mockResolvedValue([{ token: 'tok' }]);

      const svc = makeService(prisma); // onModuleInit never ran => deferQueue null

      const res = await svc.send('u1', baseNotification, undefined);

      expect(res.ok).toBe(true);
      expect(mockSendEachForMulticast).toHaveBeenCalled();
    });
  });
});
