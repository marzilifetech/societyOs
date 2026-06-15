import { ExpoConfig, ConfigContext } from '@expo/config';

/**
 * Dynamic config layer. The static fields stay in `app.json`; this file only
 * overrides what needs to vary by build flavour — currently just the iOS APNs
 * environment. Setting `APP_VARIANT=production` flips to the production APNs
 * gateway. Anything else (default: development) targets sandbox.
 *
 * IMPORTANT: an iOS `Release` build with `aps-environment=development` will
 * silently fail to deliver push (Apple ships dev tokens to sandbox APNs only).
 * Set APP_VARIANT=production for every release/TestFlight build.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const variant = process.env.APP_VARIANT ?? 'development';
  const apsEnvironment = variant === 'production' ? 'production' : 'development';

  return {
    ...(config as ExpoConfig),
    ios: {
      ...(config.ios ?? {}),
      bundleIdentifier:
        (config.ios as any)?.bundleIdentifier ?? 'com.societyos.resident',
      entitlements: {
        ...((config.ios as any)?.entitlements ?? {}),
        'aps-environment': apsEnvironment,
      },
    },
  };
};
