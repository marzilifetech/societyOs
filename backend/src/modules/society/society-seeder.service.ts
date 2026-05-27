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

// Default 4-tile emergency contact set surfaced on the resident-app home
// screen (F5). Per-society values can override this through admin /sos.
const DEFAULT_EMERGENCY_CONTACTS = [
  { id: 'ec-security', label: 'Security', phone: '+91-9000000099' },
  { id: 'ec-manager', label: 'Manager', phone: '+91-9000000088' },
  { id: 'ec-medical', label: 'Medical', phone: '+91-108' },
  { id: 'ec-fire', label: 'Fire', phone: '+91-101' },
];

@Injectable()
export class SocietySeederService {
  buildDefaultConfig(overrides?: Record<string, unknown>): Record<string, unknown> {
    const base: Record<string, unknown> = {
      features: { ...DEFAULT_FEATURES, ...(overrides?.features as object) },
      billing: { ...DEFAULT_BILLING, ...(overrides?.billing as object) },
      sla: { ...DEFAULT_SLA, ...(overrides?.sla as object) },
      serviceCategories: DEFAULT_SERVICE_CATEGORIES,
      emergencyContacts: DEFAULT_EMERGENCY_CONTACTS,
    };
    // Apply overrides last so callers can swap any default key, but make sure
    // we don't end up with the seed default winning over a real value.
    return { ...base, ...(overrides ?? {}) };
  }
}
