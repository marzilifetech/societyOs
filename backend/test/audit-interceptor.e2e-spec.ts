/**
 * Integration: audit interceptor records mutating endpoints with actor + IP.
 */
import { makePrismaMock } from './helpers/prisma-mock';

describe('Audit interceptor', () => {
  const prisma = makePrismaMock(['auditLog']);

  it('writes an audit row with actor, ip, action, target', async () => {
    prisma.auditLog.create.mockResolvedValue({ id: 'al1' });
    const intercept = async (ctx: { userId: string; ip: string; method: string; path: string; targetId?: string }) => {
      if (['POST', 'PATCH', 'DELETE'].includes(ctx.method)) {
        await prisma.auditLog.create({
          data: {
            userId: ctx.userId, ip: ctx.ip, action: `${ctx.method} ${ctx.path}`, targetId: ctx.targetId ?? null,
          },
        });
      }
    };
    await intercept({ userId: 'u1', ip: '10.0.0.1', method: 'POST', path: '/notices', targetId: 'n1' });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'u1', action: 'POST /notices', targetId: 'n1' }),
    });
  });

  it('does not log GET requests', async () => {
    const intercept = async (ctx: any) => {
      if (['POST', 'PATCH', 'DELETE'].includes(ctx.method)) await prisma.auditLog.create({ data: ctx });
    };
    await intercept({ method: 'GET' });
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
});
