const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
const appNodeModules = path.resolve(projectRoot, 'node_modules');
const rootNodeModules = path.resolve(workspaceRoot, 'node_modules');
const base = getDefaultConfig(projectRoot);

const config = withNativeWind(base, { input: './app/global.css' });

// Watch only this app and the shared workspace packages — not sibling apps —
// so expo-router's require.context can't pull `apps/staff-app/app/**` into this bundle.
config.watchFolders = [
  projectRoot,
  path.resolve(workspaceRoot, 'packages'),
  rootNodeModules,
];

// .npmrc uses `node-linker=hoisted`, so dependencies are flattened into the
// monorepo-root node_modules (this app's own node_modules holds only the
// @societyos/* workspace symlinks). Resolve from the app's node_modules first,
// then fall back to the hoisted root.
config.resolver.nodeModulesPaths = [appNodeModules, rootNodeModules];

// Hoisting yields a single flat copy of each package, but pin react /
// react-native to the root copy so workspace packages can never bundle a
// duplicate React instance.
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  react: path.resolve(rootNodeModules, 'react'),
  'react-native': path.resolve(rootNodeModules, 'react-native'),
};

// Web-only: expo-secure-store has no web implementation. Alias it to a
// localStorage shim so the app can run under react-native-web for visual
// verification. Native (ios/android) builds are unaffected.
const _origResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'expo-secure-store') {
    return { type: 'sourceFile', filePath: path.resolve(projectRoot, 'src/lib/secure-store.web-shim.js') };
  }
  return (_origResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
