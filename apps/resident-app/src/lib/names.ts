/**
 * First word of a person's name for greetings, or `fallback` when there is no
 * usable name. Tolerates the shapes real records come in: null, empty,
 * padded, or multiple spaces between words.
 */
export function firstNameOf(name: string | null | undefined, fallback = 'Resident'): string {
  const first = name?.trim().split(/\s+/)[0];
  return first ? first : fallback;
}
