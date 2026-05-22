module.exports = {
  preset: 'jest-expo',
  setupFiles: [
    'react-native/jest/setup.js',
    'jest-expo/src/preset/setup.js',
    '<rootDir>/__tests__/setup.ts',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/e2e/', '/dist/', '/vendor/', '/__tests__/setup\\.ts$', '/__tests__/__mocks__/'],
  transformIgnorePatterns: [
    'node_modules/(?!((.pnpm/[^/]*/node_modules/))?((jest-)?react-native|@react-native(-community)?|@react-native/.*|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|nativewind|@tanstack/.*))',
  ],
  moduleNameMapper: {
    '\\.(css|less|sass|scss)$': '<rootDir>/__tests__/__mocks__/style-mock.js',
    'react-native-css-interop/.*': '<rootDir>/__tests__/__mocks__/react-native-css-interop.js',
    '^react-native-css-interop$': '<rootDir>/__tests__/__mocks__/react-native-css-interop.js',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
  ],
};
