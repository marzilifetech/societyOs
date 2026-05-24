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

@Injectable()
export class SocietySeederService {
  buildDefaultConfig(overrides?: Record<string, unknown>): Record<string, unknown> {
    return {
      features: { ...DEFAULT_FEATURES, ...(overrides?.features as object) },
      billing: { ...DEFAULT_BILLING, ...(overrides?.billing as object) },
      sla: { ...DEFAULT_SLA, ...(overrides?.sla as object) },
      serviceCategories: DEFAULT_SERVICE_CATEGORIES,
      ...(overrides ?? {}),
    };
  }
}
