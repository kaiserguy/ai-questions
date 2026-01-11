// Test setup file for Jest
// This file runs before each test

// Add TextEncoder/TextDecoder polyfills for Node.js environment
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Add setImmediate polyfill for Node.js environment
global.setImmediate = global.setImmediate || ((fn, ...args) => setTimeout(fn, 0, ...args));
global.clearImmediate = global.clearImmediate || clearTimeout;

// Mock browser APIs that might not be available in test environment
global.fetch = jest.fn();
global.localStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};

global.indexedDB = {
  open: jest.fn(() => ({
    onerror: null,
    onsuccess: null,
    onupgradeneeded: null,
    result: {
      createObjectStore: jest.fn(),
      transaction: jest.fn(() => ({
        objectStore: jest.fn(() => ({
          add: jest.fn(),
          get: jest.fn(),
          put: jest.fn(),
          delete: jest.fn()
        }))
      }))
    },
    error: null
  })),
  deleteDatabase: jest.fn()
};

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Enhanced DOM mocking for Jest environment
// Note: jsdom already provides document, but we need to ensure mocking works
if (typeof document !== 'undefined') {
  // Enhance existing document with Jest mocks
  const originalGetElementById = document.getElementById;
  document.getElementById = jest.fn(originalGetElementById);
  
  const originalQuerySelector = document.querySelector;
  document.querySelector = jest.fn(originalQuerySelector);
  
  const originalQuerySelectorAll = document.querySelectorAll;
  document.querySelectorAll = jest.fn(originalQuerySelectorAll);
  
  const originalCreateElement = document.createElement;
  document.createElement = jest.fn(originalCreateElement);
  
  const originalAddEventListener = document.addEventListener;
  document.addEventListener = jest.fn(originalAddEventListener);
} else {
  // Fallback for environments without jsdom
  global.document = {
    getElementById: jest.fn(),
    querySelector: jest.fn(),
    querySelectorAll: jest.fn(),
    createElement: jest.fn(),
    addEventListener: jest.fn()
  };
}

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});

// Global test utilities
global.createMockElement = (id, properties = {}) => {
  const element = {
    id,
    style: properties.style || {},
    textContent: properties.textContent || '',
    innerHTML: properties.innerHTML || '',
    classList: {
      add: jest.fn(),
      remove: jest.fn(),
      contains: jest.fn(),
      toggle: jest.fn()
    },
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    click: jest.fn(),
    focus: jest.fn(),
    blur: jest.fn()
  };
  
  // Merge any additional properties
  Object.keys(properties).forEach(key => {
    if (key !== 'style' && key !== 'textContent' && key !== 'innerHTML') {
      element[key] = properties[key];
    }
  });
  
  // Set up getElementById mock to return this element
  if (document && document.getElementById && document.getElementById.mockImplementation) {
    document.getElementById.mockImplementation((elementId) => {
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

// Mock package configurations for tests
global.mockPackageConfigs = {
  minimal: {
    aiModel: { name: 'TinyBERT', size: '150MB' },
    wikipedia: { name: 'Wikipedia Subset', size: '20MB' }
  },
  performance: {
    aiModel: { name: 'Phi-3 Mini', size: '500MB' },
    wikipedia: { name: 'Simple Wikipedia', size: '50MB' }
  },
  comprehensive: {
    aiModel: { name: 'Llama 3.2', size: '2GB' },
    wikipedia: { name: 'Full Wikipedia', size: '100GB' }
  }
};
