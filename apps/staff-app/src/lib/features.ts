/**
 * Build-time feature flags.
 *
 * HEALTH_ENABLED gates the in-app Doctor Portal: the doctor's appointment
 * list (patient names, clinical notes), availability toggle and schedule
 * (routes under `/doctor`). It ships OFF for the Google Play build so the app
 * carries no health features and the Play Console "Health Apps Declaration"
 * can be answered truthfully with "My app does not provide any health
 * features".
 *
 * IMPORTANT: this is the source of truth for that declaration. While this flag
 * is `false`, the `/doctor/*` routes redirect home (see app/doctor/_layout.tsx)
 * and the Doctor Portal entry on Home is hidden, so the feature is genuinely
 * unreachable — not merely hidden by the `designation === 'DOCTOR'` role check.
 *
 * This mirrors the resident app's HEALTH_ENABLED flag
 * (apps/resident-app/src/lib/features.ts) so both apps present the same
 * Health-policy posture to Google Play.
 *
 * Flip to `true` ONLY in a build where the Health Apps Declaration has been
 * completed and the Data Safety form declares health-data collection.
 */
export const HEALTH_ENABLED = false;
