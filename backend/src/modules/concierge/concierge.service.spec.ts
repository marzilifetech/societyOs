import { ConciergeService } from './concierge.service';

const flush = () => new Promise((r) => setImmediate(r));

function setup(staff: { userId: string; department: string | null; categories: string[] }[]) {
  const prisma: any = {
    resident: { findFirst: jest.fn().mockResolvedValue({ id: 'r1' }) },
    conciergeRequest: {
      create: jest.fn(async ({ data }: any) => ({
        id: 'hr-1',
        ...data,
        resident: { user: { name: 'Asha' }, flat: { block: 'B', number: '204' } },
      })),
    },
    staffMember: { findMany: jest.fn().mockResolvedValue(staff) },
  };
  const push: any = { send: jest.fn().mockResolvedValue({ ok: true }) };
  return { prisma, push, svc: new ConciergeService(prisma, push) };
}

describe('ConciergeService.createRequest — staff are told someone needs help', () => {
  it('pushes an actionable help request to non-security staff', async () => {
    const { push, svc } = setup([
      { userId: 'guard', department: 'SECURITY', categories: [] },
      { userId: 'helper', department: 'HOUSEKEEPING', categories: [] },
    ]);

    await svc.createRequest('u-res', 'soc-1', { type: 'COURIER', description: 'Parcel to carry up' });
    await flush();

    expect(push.send).toHaveBeenCalledTimes(1);
    const [userId, notification, data] = push.send.mock.calls[0];
    expect(userId).toBe('helper');
    expect(notification).toEqual(
      expect.objectContaining({ category: 'staff_help_requests', actions: expect.any(Array) }),
    );
    expect(notification.body).toContain('Asha, Flat B-204');
    expect(data).toEqual(
      expect.objectContaining({ type: 'HELP_REQUEST', entityId: 'hr-1', actionGroup: 'help_request' }),
    );
  });

  it('falls back to security staff when the society has no one else', async () => {
    const { push, svc } = setup([{ userId: 'guard', department: null, categories: ['SECURITY'] }]);
    await svc.createRequest('u-res', 'soc-1', { type: 'OTHER', description: 'Help' });
    await flush();
    expect(push.send.mock.calls.map((c: any[]) => c[0])).toEqual(['guard']);
  });

  it('never fails the request because a push failed', async () => {
    const { push, svc } = setup([{ userId: 'helper', department: null, categories: [] }]);
    push.send.mockRejectedValue(new Error('fcm down'));
    await expect(
      svc.createRequest('u-res', 'soc-1', { type: 'OTHER', description: 'Help' }),
    ).resolves.toEqual(expect.objectContaining({ id: 'hr-1' }));
    await flush();
  });
});
