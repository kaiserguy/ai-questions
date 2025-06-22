// Test setup file for Jest
// This file runs before each test

// Mock browser APIs that might not be available in test environment
global.fetch = jest.fn();
global.localStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};

global.indexedDB = {
  open: jest.fn(),
  deleteDatabase: jest.fn()
};

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Mock DOM methods
global.document = {
  ...document,
  getElementById: jest.fn(),
  querySelector: jest.fn(),
  querySelectorAll: jest.fn(),
  createElement: jest.fn(),
  addEventListener: jest.fn()
};

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});

// Global test utilities
global.createMockElement = (id, properties = {}) => {
  const element = {
    id,
    style: {},
    textContent: '',
    innerHTML: '',
    classList: {
      add: jest.fn(),
      remove: jest.fn(),
      contains: jest.fn()
    },
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    ...properties
  };
  
  if (global.document.getElementById) {
    global.document.getElementById.mockImplementation((elementId) => {
      return elementId === id ? element : null;
    });
  }
  
  return element;
};

// Mock successful fetch responses
global.mockFetchSuccess = (data) => {
  global.fetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => data,
    text: async () => JSON.stringify(data)
  });
};

// Mock failed fetch responses
global.mockFetchError = (status = 500, message = 'Server Error') => {
  global.fetch.mockRejectedValueOnce(new Error(message));
};

