/**
 * Build-time feature flags.
 *
 * HEALTH_ENABLED gates the in-app health/medical module: doctor desk &
 * booking, appointments, health records, vitals and medications. It ships
 * OFF for the Google Play build so the app carries no health features and the
 * Play Console "Health Apps Declaration" can be answered truthfully with
 * "My app does not provide any health features".
 *
 * IMPORTANT: this is the source of truth for that declaration. While this flag
 * is `false`, the corresponding routes (`/health/*` and the non-SOS part of
 * `/medical/*`) redirect home (see app/health/_layout.tsx and
 * app/medical/_layout.tsx) and their entry points on Home/Profile are hidden,
 * so the features are genuinely unreachable — not merely relabeled.
 *
 * The Emergency SOS flow is intentionally NOT gated by this flag. It is a
 * generic security/gate panic alert (POST /sos/trigger) and is not a health
 * feature.
 *
 * Flip to `true` ONLY in a build where the Health Apps Declaration has been
 * completed and the Data Safety form declares health-data collection.
 */
export const HEALTH_ENABLED = false;
