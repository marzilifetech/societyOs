/** Made-up numbers older servers seeded into every society; never dial them. */
const PLACEHOLDER_PHONES = new Set(['+91-9000000099', '+91-9000000088', '+91-108', '+91-101']);

/** A society emergency number, as set by the admin in society settings. */
export type EmergencyContact = { label: string; phone: string };

/**
 * The society's emergency contacts from `GET /residents/society/emergency-contacts`
 * (`{ config: { emergencyContacts: [...] } }`), dropping rows with no number.
 */
export function readEmergencyContacts(data: unknown): EmergencyContact[] {
  const list = (data as { config?: { emergencyContacts?: unknown } } | null)?.config?.emergencyContacts;
  if (!Array.isArray(list)) return [];
  return list.flatMap((c) => {
    const phone = typeof c?.phone === 'string' ? c.phone.trim() : '';
    return phone && !PLACEHOLDER_PHONES.has(phone) ? [{ label: String(c.label || 'Emergency contact'), phone }] : [];
  });
}

/** The society's security number, or its first emergency contact. */
export function pickSecurityContact(data: unknown): EmergencyContact | null {
  const contacts = readEmergencyContacts(data);
  return contacts.find((c) => /security|guard|gate/i.test(c.label)) ?? contacts[0] ?? null;
}

/**
 * Numbers that work anywhere in India. 112 is the single emergency number
 * (police, fire, ambulance); the older direct lines still work.
 */
export const NATIONAL_EMERGENCY_NUMBERS: EmergencyContact[] = [
  { label: 'Emergency (all services)', phone: '112' },
  { label: 'Police', phone: '100' },
  { label: 'Fire', phone: '101' },
  { label: 'Ambulance', phone: '108' },
];
