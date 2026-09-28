import { Platform } from 'react-native';

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

/**
 * UGC_ENABLED gates content one resident writes that other residents can read:
 * the community feed (posts, comments, reactions) and the free-text comments on
 * canteen dish reviews. Star ratings are not affected.
 *
 * It ships OFF on iOS because App Store Guideline 1.2 requires any app showing
 * user-generated content to let users report objectionable content and block
 * abusive users, and neither exists yet. While it is `false` the /community
 * routes redirect home (see app/community/_layout.tsx) and other residents'
 * review comments are not rendered, so the App Store "User Generated Content"
 * age-rating answer can truthfully be No.
 *
 * Android is unchanged. Turn it on for iOS only once report + block ship.
 */
export const UGC_ENABLED = Platform.OS !== 'ios';

/**
 * CARE_PORTAL_ENABLED gates the "PLUS" tile, which opens the web Care portal
 * (vitals, health records) in an in-app WebView — see src/lib/care-portal.ts.
 *
 * It ships OFF on iOS for App Review: the portal is the only route to health
 * features in the iOS build (HEALTH_ENABLED is off), and its content lives on
 * the web, outside the reviewed binary. With it off, the tile is hidden, /plus
 * redirects home, and the App Privacy answers need not declare Health data.
 */
export const CARE_PORTAL_ENABLED = Platform.OS !== 'ios';
