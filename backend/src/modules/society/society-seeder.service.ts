import { Injectable } from '@nestjs/common';

const DEFAULT_FEATURES: Record<string, boolean> = {
  canteen: true,
  events: true,
  medical: true,
  preOrders: true,
  propertyListings: true,
  travelPause: true,
};

const DEFAULT_BILLING: Record<string, number> = {
  baseMaintenance: 2500,
  parking: 500,
  water: 300,
  amenity: 200,
  penaltyPerDay: 50,
};

const DEFAULT_SLA: Record<string, number> = {
  Plumbing: 4,
  Electrical: 2,
  Cleaning: 8,
  Carpentry: 24,
  Security: 1,
  Other: 12,
};

const DEFAULT_SERVICE_CATEGORIES = [
  'Plumbing',
  'Electrical',
  'Cleaning',
  'Carpentry',
  'Security',
  'Other',
];

/**
 * Placeholder numbers earlier builds seeded into every new society. They do
 * not connect ("+91-108" is not a dialable form of 108), so a resident in an
 * emergency would call nothing. Filtered out wherever contacts are served.
 */
export const PLACEHOLDER_EMERGENCY_PHONES = new Set(['+91-9000000099', '+91-9000000088', '+91-108', '+91-101']);

@Injectable()
export class SocietySeederService {
  buildDefaultConfig(overrides?: Record<string, unknown>): Record<string, unknown> {
    const base: Record<string, unknown> = {
      features: { ...DEFAULT_FEATURES, ...(overrides?.features as object) },
      billing: { ...DEFAULT_BILLING, ...(overrides?.billing as object) },
      sla: { ...DEFAULT_SLA, ...(overrides?.sla as object) },
      serviceCategories: DEFAULT_SERVICE_CATEGORIES,
      // Empty until the society's admin enters its real numbers (admin → SOS).
      // The app always offers the national numbers (112, 100, 101, 108).
      emergencyContacts: [],
    };
    // Apply overrides last so callers can swap any default key, but make sure
    // we don't end up with the seed default winning over a real value.
    return { ...base, ...(overrides ?? {}) };
  }
}
