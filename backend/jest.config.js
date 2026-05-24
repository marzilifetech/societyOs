/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  collectCoverageFrom: ['src/**/*.(t|j)s'],
  coverageDirectory: 'coverage',
  testEnvironment: 'node',
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '\\.module\\.ts$',
    '\\.controller\\.ts$',
    '\\.gateway\\.ts$',
    '/dto/',
  ],
  coverageThreshold: {
    './src/modules/service-request/service-request-reminder.scheduler.ts': {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
    './src/modules/service-request/service-request.service.ts': {
      statements: 90,
      branches: 70,
      functions: 95,
      lines: 100,
    },
    './src/modules/visitor/visitor.service.ts': {
      statements: 98,
      branches: 90,
      functions: 100,
      lines: 100,
    },
    './src/common/notification/whatsapp.service.ts': {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
    './src/modules/help-request/help-request.service.ts': {
      statements: 95,
      branches: 80,
      functions: 95,
      lines: 100,
    },
  },
};
