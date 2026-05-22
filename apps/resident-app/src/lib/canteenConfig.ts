export const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  PENDING:   { label: 'Pending',   color: '#9CA3AF', bg: 'rgba(156,163,175,0.15)' },
  CONFIRMED: { label: 'Confirmed', color: '#60A5FA', bg: 'rgba(96,165,250,0.15)' },
  READY:     { label: 'Ready',     color: '#34D399', bg: 'rgba(52,211,153,0.15)' },
  COLLECTED: { label: 'Collected', color: 'rgba(255,255,255,0.30)', bg: 'rgba(255,255,255,0.06)' },
  CANCELLED: { label: 'Cancelled', color: '#F87171', bg: 'rgba(248,113,113,0.15)' },
};
