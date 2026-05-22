/**
 * Stub for react-native-css-interop in jest.
 * The nativewind babel plugin swaps jsxImportSource to this package, which
 * then tries to load Appearance → NativePlatformConstantsIOS (native bridge).
 * In tests we don't need CSS-in-JS, so just pass through to React's runtime.
 */
const { jsx, jsxs, Fragment } = require('react/jsx-runtime');
const { createElement } = require('react');

module.exports = {
  __esModule: true,
  jsx,
  jsxs,
  jsxDEV: jsx,
  Fragment,
  createElement,
  createInteropElement: createElement,
  // css-to-rn noop
  cssToReactNativeRuntime: () => ({}),
  // interop helpers
  remapProps: (Component) => Component,
  StyleSheet: { create: (s) => s },
};
