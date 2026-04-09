module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['src/**/*.js', '!src/server.js', '!**/node_modules/**'],
  testMatch: ['**/tests/**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: 'reports/integration',
        outputName: 'junit.xml'
      }
    ],
    [
      'jest-html-reporters',
      {
        publicPath: 'reports/integration',
        filename: 'report.html',
        pageTitle: 'SynthAI Auth Integration Tests',
        includeFailureMsg: true
      }
    ]
  ],
  testTimeout: 10000,
  verbose: true
};
