module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    // NOTE: do NOT list the reanimated/worklets babel plugin here.
    // babel-preset-expo adds it automatically and picks the correct one:
    // react-native-worklets/plugin when that package is installed (Reanimated 4),
    // otherwise react-native-reanimated/plugin (Reanimated 3). Listing it
    // manually double-applies it and pins the wrong one across upgrades.
  };
};
