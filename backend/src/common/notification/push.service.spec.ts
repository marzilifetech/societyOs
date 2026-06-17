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
      create: jest.fn().mockResolvedValue({}),
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
    expect(arg.apns.payload.aps['content-available']).toBe(1);
    expect(arg.apns.payload.aps['mutable-content']).toBe(1);
    expect(arg.apns.payload.aps.category).toBe('complaints');
  });

  it('full-screen forces data-only delivery and sets data.fullScreen=true', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', phone: '+910000000000' });
    prisma.device.findMany.mockResolvedValue([{ token: 'tok' }]);

    const svc = makeService(prisma);
    await (svc as any).sendNow(
      'u1',
      { ...baseNotification, fullScreen: true },
      { type: 'SOS_TRIGGERED' },
    );

    const arg = mockSendEachForMulticast.mock.calls[0][0];
    // data-only: no top-level notification block, so the app's background
    // handler fires and raises the full-screen intent.
    expect(arg.notification).toBeUndefined();
    expect(arg.data.fullScreen).toBe('true');
    expect(arg.data.title).toBe('Hello');
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
    it('batch-resolves recipient tokens from Device table union fcmToken and multicasts', async () => {
      const prisma = makePrisma();
      // Batched impl selects id + fcmToken + notificationPrefs in one query.
      prisma.user.findMany.mockResolvedValue([
        { id: 'u1', fcmToken: null, notificationPrefs: {} },
        { id: 'u2', fcmToken: 'legacy', notificationPrefs: {} },
      ]);
      // No stored category prefs => registry defaults (complaints is on).
      prisma.notificationPreference.findMany.mockResolvedValue([]);
      // One device query for all eligible recipients.
      prisma.device.findMany.mockResolvedValue([{ token: 't1' }, { token: 't2' }]);
      mockSendEachForMulticast.mockResolvedValue(okResponse(3));

      const svc = makeService(prisma);
      const res = await (svc as any).sendToSocietyNow('soc1', null, baseNotification, undefined);

      // device.findMany called exactly once (no N+1), with all eligible ids.
      expect(prisma.device.findMany).toHaveBeenCalledTimes(1);
      const arg = mockSendEachForMulticast.mock.calls[0][0];
      expect(arg.tokens).toEqual(['t1', 't2', 'legacy']);
      expect(res).toEqual({ sent: 3, failed: 0, cleaned: 0 });
      expect(prisma.notificationLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'SENT', societyId: 'soc1' }),
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
      prisma.device.findMany.mockResolvedValue([{ token: 't1' }]);
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
});
