import { stripSecrets } from './strip-secrets';

describe('stripSecrets', () => {
  it('removes secrets at any depth, including inside arrays', () => {
    const row = {
      id: 'sr-1',
      resident: {
        aadhaar: Buffer.from('x'),
        user: { id: 'u1', name: 'Asha', totpSecret: Buffer.from('s'), fcmToken: 't', deviceToken: 'd' },
      },
      assignedStaff: [{ user: { id: 'g1', fcmToken: 't2' } }],
    };
    expect(stripSecrets(row)).toEqual({
      id: 'sr-1',
      resident: { user: { id: 'u1', name: 'Asha' } },
      assignedStaff: [{ user: { id: 'g1' } }],
    });
  });

  it('never mutates the input (cached rows stay intact for the push service)', () => {
    const user = { id: 'u1', fcmToken: 't' };
    stripSecrets({ user });
    expect(user.fcmToken).toBe('t');
  });

  it('returns clean values unchanged and by reference', () => {
    const clean = { a: [1, { b: 'c' }], d: new Date(0) };
    expect(stripSecrets(clean)).toBe(clean);
  });

  it('passes primitives, null, Dates and class instances through', () => {
    const d = new Date(0);
    class Money {
      constructor(public fcmToken: string) {}
    }
    const m = new Money('kept');
    expect(stripSecrets(null)).toBeNull();
    expect(stripSecrets(5)).toBe(5);
    expect(stripSecrets(d)).toBe(d);
    expect(stripSecrets(m)).toBe(m);
  });
});
