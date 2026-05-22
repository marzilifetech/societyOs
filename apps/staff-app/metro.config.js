const path = require('path');
const fs = require('fs');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
const base = getDefaultConfig(projectRoot);

const config = withNativeWind(base, { input: './app/global.css' });

config.watchFolders = [
  projectRoot,
  path.resolve(workspaceRoot, 'packages'),
  path.resolve(workspaceRoot, 'node_modules'),
];

const appNodeModules = path.resolve(projectRoot, 'node_modules');
config.resolver.nodeModulesPaths = [appNodeModules];

// expo-asset lives as a peer of expo in the pnpm virtual store (not hoisted).
// Resolve expo's real path via symlink, then find expo-asset as a sibling.
const expoAssetPath = path.resolve(fs.realpathSync(path.resolve(appNodeModules, 'expo')), '..', 'expo-asset');

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  react: path.resolve(appNodeModules, 'react'),
  'react-native': path.resolve(appNodeModules, 'react-native'),
  'expo-asset': expoAssetPath,
};

module.exports = config;
