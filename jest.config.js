const { createConfig } = require('@openedx/frontend-build');

const mergedConfig = createConfig('jest', {
  setupFilesAfterEnv: [
    '<rootDir>/src/setupTest.ts',
  ],
  coveragePathIgnorePatterns: [
    'src/setupTest.ts',
    'src/i18n',
  ],
  testTimeout: 30000,
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '\\.css$': 'identity-obj-proxy',
  },
});

// Allow ts-jest to transform TypeScript files
mergedConfig.transform['^.+\\.[tj]sx?$'] = [
  'ts-jest',
  {
    diagnostics: {
      exclude: ['!**/*.test.*'],
    },
  },
];

module.exports = mergedConfig;
