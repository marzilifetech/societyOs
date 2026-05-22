/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/__tests__/**/*.test.ts'],
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.test.json',
    },
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/__tests__/**'],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: { lines: 100, branches: 100, functions: 100, statements: 100 },
  },
};
