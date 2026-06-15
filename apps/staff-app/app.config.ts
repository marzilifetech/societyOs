import { ExpoConfig, ConfigContext } from '@expo/config';

/**
 * Dynamic config layer for the staff app. Static fields stay in `app.json`;
 * this file only overrides what needs to vary by build flavour. Currently:
 *
 *   APP_VARIANT=production  →  iOS `aps-environment=production`
 *   anything else (default) →  iOS `aps-environment=development`
 *
 * Apple's APNs gateway routing depends on the token environment, which is
 * itself determined by this entitlement. Releasing without flipping it
 * silently drops push to sandbox APNs (TestFlight is fine; App Store is not).
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const variant = process.env.APP_VARIANT ?? 'development';
  const apsEnvironment = variant === 'production' ? 'production' : 'development';

  return {
    ...(config as ExpoConfig),
    ios: {
      ...(config.ios ?? {}),
      bundleIdentifier:
        (config.ios as any)?.bundleIdentifier ?? 'com.societyos.staff',
      entitlements: {
        ...((config.ios as any)?.entitlements ?? {}),
        'aps-environment': apsEnvironment,
      },
    },
  };
};
