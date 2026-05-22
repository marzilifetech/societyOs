/**
 * Integration: A7 — refresh-token reuse must revoke entire token family.
 */
describe('Refresh token rotation (A7)', () => {
  type TokenRow = { jti: string; familyId: string; revoked: boolean; usedAt: Date | null };
  const store = new Map<string, TokenRow>();
  const family = new Map<string, string[]>();

  const issue = (familyId?: string) => {
    const fid = familyId ?? crypto.randomUUID();
    const jti = crypto.randomUUID();
    store.set(jti, { jti, familyId: fid, revoked: false, usedAt: null });
    family.set(fid, [...(family.get(fid) ?? []), jti]);
    return { jti, familyId: fid };
  };

  const refresh = (jti: string) => {
    const row = store.get(jti);
    if (!row) return { ok: false, code: 'NOT_FOUND' };
    if (row.revoked) {
      // reuse detected → revoke whole family
      for (const id of family.get(row.familyId) ?? []) {
        const r = store.get(id);
        if (r) r.revoked = true;
      }
      return { ok: false, code: 'REUSE_DETECTED_FAMILY_REVOKED' };
    }
    if (row.usedAt) {
      // reuse of already-used token also revokes family
      for (const id of family.get(row.familyId) ?? []) {
        const r = store.get(id);
        if (r) r.revoked = true;
      }
      return { ok: false, code: 'REUSE_DETECTED_FAMILY_REVOKED' };
    }
    row.usedAt = new Date();
    const next = issue(row.familyId);
    return { ok: true, next };
  };

  beforeEach(() => { store.clear(); family.clear(); });

  it('A7: replaying an old refresh token revokes the family', () => {
    const t1 = issue();
    const r1 = refresh(t1.jti);
    expect(r1.ok).toBe(true);
    // attacker replays t1 after rotation
    const replay = refresh(t1.jti);
    expect(replay).toMatchObject({ ok: false, code: 'REUSE_DETECTED_FAMILY_REVOKED' });
    // legitimate next token should now also be revoked
    expect(store.get((r1 as any).next.jti)?.revoked).toBe(true);
  });
});
