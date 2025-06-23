module.exports = {
  // Test environment
  testEnvironment: 'jsdom',
  
  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  
  // Coverage configuration
  collectCoverageFrom: [
    'core/public/offline/**/*.js',
    'hosted/public/offline/**/*.js',
    'local/**/*.js',
    '!**/*.test.js',
    '!**/*.spec.js',
    '!**/node_modules/**'
  ],
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/',
    '/tests/integration/' // Skip integration tests for now
  ],
  
  // Module path ignore patterns to fix package.json collision
  modulePathIgnorePatterns: [
    '<rootDir>/local/package.json'
  ],
  
  // Haste configuration to avoid naming collisions
  haste: {
    enableSymlinks: false
  },
  
  // Verbose output
  verbose: true,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Restore mocks after each test
  restoreMocks: true
};

