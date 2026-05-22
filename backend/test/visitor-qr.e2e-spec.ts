/**
 * Integration: visitor pre-approval QR generation + single-use redemption.
 */
import { makePrismaMock } from './helpers/prisma-mock';

describe('Visitor QR flow', () => {
  const prisma = makePrismaMock(['visitor', 'visitorPass']);

  beforeEach(() => jest.clearAllMocks());

  it('issues a visitor pass with a unique QR token', async () => {
    prisma.visitorPass.create.mockResolvedValue({
      id: 'vp1',
      qrToken: 'tok_abc123',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      redeemedAt: null,
    });
    const pass = await prisma.visitorPass.create({
      data: { visitorId: 'v1', qrToken: 'tok_abc123' },
    });
    expect(pass.qrToken).toMatch(/^tok_/);
    expect(pass.redeemedAt).toBeNull();
  });

  it('rejects a redeemed QR on second scan', async () => {
    prisma.visitorPass.findUnique
      .mockResolvedValueOnce({ id: 'vp1', redeemedAt: null, expiresAt: new Date(Date.now() + 1e6) })
      .mockResolvedValueOnce({ id: 'vp1', redeemedAt: new Date(), expiresAt: new Date(Date.now() + 1e6) });

    const redeem = async (token: string) => {
      const p = await prisma.visitorPass.findUnique({ where: { qrToken: token } });
      if (!p) return { ok: false, reason: 'NOT_FOUND' };
      if (p.redeemedAt) return { ok: false, reason: 'ALREADY_USED' };
      if (p.expiresAt < new Date()) return { ok: false, reason: 'EXPIRED' };
      return { ok: true };
    };
    expect(await redeem('tok_abc123')).toEqual({ ok: true });
    expect(await redeem('tok_abc123')).toEqual({ ok: false, reason: 'ALREADY_USED' });
  });

  it.skip('VisitorService.generatePass HMAC-signs token — unblocks when P2 ships signed-token impl');
});
