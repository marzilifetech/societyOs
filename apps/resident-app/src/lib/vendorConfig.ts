export const CATEGORY_COLORS: Record<string, { color: string; bg: string }> = {
  Grocery: { color: '#22C55E', bg: 'rgba(34,197,94,0.15)' },
  Pharmacy: { color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
  Dairy: { color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  Bakery: { color: '#EC4899', bg: 'rgba(236,72,153,0.15)' },
  Vegetables: { color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
  Other: { color: 'rgba(255,255,255,0.5)', bg: 'rgba(255,255,255,0.08)' },
};

export function avatarBg(name: string) {
  const colors = ['#821A52', '#22C55E', '#F59E0B', '#EC4899', '#3B82F6', '#10B981'];
  return colors[name.charCodeAt(0) % colors.length];
}
