/** Staff profile fields used to detect gate/security persona. */
export type SecurityStaffProfile = {
  categories?: string[];
  department?: string | null;
};

export function isSecurityStaff(profile?: SecurityStaffProfile | null): boolean {
  if (!profile) return false;
  const dept = profile.department?.toUpperCase() ?? '';
  if (dept === 'SECURITY') return true;
  return (profile.categories ?? []).some((c) => c.toUpperCase() === 'SECURITY');
}
