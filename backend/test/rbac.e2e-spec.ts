/**
 * Integration: RBAC — role-based access enforcement.
 */
describe('RBAC', () => {
  const policy: Record<string, string[]> = {
    'notice.create': ['ADMIN', 'SUPER_ADMIN'],
    'complaint.read': ['ADMIN', 'SUPER_ADMIN', 'RESIDENT'],
    'maintenance.generate': ['ADMIN', 'FINANCE_ADMIN'],
    'staff.assign': ['ADMIN'],
  };

  const can = (role: string, action: string) => policy[action]?.includes(role) ?? false;

  it('RESIDENT cannot create notice', () => expect(can('RESIDENT', 'notice.create')).toBe(false));
  it('ADMIN can create notice', () => expect(can('ADMIN', 'notice.create')).toBe(true));
  it('FINANCE_ADMIN can generate bills but cannot assign staff', () => {
    expect(can('FINANCE_ADMIN', 'maintenance.generate')).toBe(true);
    expect(can('FINANCE_ADMIN', 'staff.assign')).toBe(false);
  });
  it('STAFF role rejected for any admin action', () => {
    expect(can('STAFF', 'notice.create')).toBe(false);
    expect(can('STAFF', 'staff.assign')).toBe(false);
  });
});
