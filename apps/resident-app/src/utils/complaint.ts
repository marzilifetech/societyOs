/** Spellings that differ from the title-cased enum value. */
const CATEGORY_LABELS: Record<string, string> = { NEIGHBOR: 'Neighbour' };

/** "NOISE" → "Noise": the API returns the enum value, lists showed it raw. */
export function complaintCategoryLabel(category: string | null | undefined): string | null {
  if (!category) return null;
  const key = category.toUpperCase();
  if (CATEGORY_LABELS[key]) return CATEGORY_LABELS[key];
  return key
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
