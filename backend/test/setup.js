// Test setup file
console.log('🧪 Setting up test environment...');

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '0'; // Use random port for tests

// Increase timeout for Docker operations
jest.setTimeout(30000);

// Suppress console.log during tests unless explicitly needed
const originalConsoleLog = console.log;
console.log = (...args) => {
  if (process.env.VERBOSE_TESTS) {
    originalConsoleLog(...args);
  }
};
