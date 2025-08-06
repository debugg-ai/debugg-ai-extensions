import '@testing-library/jest-dom';
import { afterEach, beforeEach, vi } from 'vitest';

// Mock window.matchMedia since it's not available in jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
  
  get root() { return null; }
  get rootMargin() { return '0px'; }
  get thresholds() { return [0]; }
  takeRecords() { return []; }
} as any;

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock console methods to reduce noise in tests
const originalError = console.error;
const originalWarn = console.warn;

beforeEach(() => {
  console.error = (...args: any[]) => {
    // Suppress React error boundary warnings in tests
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOMTestUtils.act') ||
       args[0].includes('Warning: An update to') ||
       args[0].includes('act(...) is not supported') ||
       args[0].includes('useAuth must be used within an AuthProvider'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
  
  console.warn = (...args: any[]) => {
    // Suppress common React warnings in tests
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOMTestUtils.act') ||
       args[0].includes('Warning: An update to'))
    ) {
      return;
    }
    originalWarn.call(console, ...args);
  };
});

afterEach(() => {
  console.error = originalError;
  console.warn = originalWarn;
});

// Global test setup for auth tests
beforeEach(() => {
  // Clear localStorage before each test
  localStorage.clear();
  
  // Reset any global state
  if (typeof window !== 'undefined') {
    delete (window as any).__INITIAL_STATE__;
  }
});

// Mock fetch for API calls
global.fetch = vi.fn();

// Increase timeout for integration tests
vi.setConfig({ testTimeout: 30000 });

// Global mock for vscode API
Object.defineProperty(globalThis, 'vscode', {
  writable: true,
  value: {
    postMessage: vi.fn(),
    setState: vi.fn(),
    getState: vi.fn(() => ({})),
  },
});

// Mock postToIde and requestFromIde globally
Object.defineProperty(globalThis, 'postToIde', {
  writable: true,
  value: vi.fn(),
});

Object.defineProperty(globalThis, 'requestFromIde', {
  writable: true,
  value: vi.fn().mockResolvedValue({}),
}); 