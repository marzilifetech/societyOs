/**
 * Maintenance bill breakdown rows.
 *
 * `breakdown` is a free-form JSON written by billing: { base, rateMode,
 * areaSqft?, ratePerSqft?, override?, travelPauseCredit?, pausedDays? }.
 * Rendering every key as rupees showed "₹NaN" for rateMode and "₹1,200" for
 * the flat's area. Only known fields are shown, each formatted for what it is.
 */

export type BreakdownRow = { key: string; label: string; value: string };

const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const FIELDS: { key: string; label: string; format: (n: number) => string }[] = [
  { key: 'base', label: 'Maintenance charge', format: inr },
  { key: 'areaSqft', label: 'Flat area', format: (n) => `${n.toLocaleString('en-IN')} sq ft` },
  { key: 'ratePerSqft', label: 'Rate', format: (n) => `${inr(n)} / sq ft` },
  { key: 'override', label: 'Adjusted amount', format: inr },
  { key: 'travelPauseCredit', label: 'Travel pause credit', format: (n) => `− ${inr(n)}` },
  { key: 'pausedDays', label: 'Days paused', format: (n) => `${n}` },
];

export function billBreakdownRows(breakdown: unknown): BreakdownRow[] {
  if (!breakdown || typeof breakdown !== 'object' || Array.isArray(breakdown)) return [];
  const b = breakdown as Record<string, unknown>;
  const rows: BreakdownRow[] = [];
  for (const f of FIELDS) {
    const raw = b[f.key];
    if (raw === null || raw === undefined || raw === '') continue;
    const n = Number(raw); // Decimals may arrive as strings
    if (!Number.isFinite(n)) continue;
    rows.push({ key: f.key, label: f.label, value: f.format(n) });
  }
  return rows;
}
