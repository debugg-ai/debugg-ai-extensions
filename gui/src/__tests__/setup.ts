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
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock console methods to reduce noise in tests
const originalError = console.error;
beforeEach(() => {
  console.error = (...args: any[]) => {
    // Suppress React error boundary warnings in tests
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOMTestUtils.act')
    ) {
      return;
    }
    // Suppress specific testing library warnings
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('useAuth must be used within an AuthProvider') ||
       args[0].includes('act(...) is not supported'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterEach(() => {
  console.error = originalError;
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
vi.setConfig({ testTimeout: 10000 }); 