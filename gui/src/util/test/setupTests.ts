import "@testing-library/jest-dom";

afterEach(() => {
  vi.clearAllMocks();
});

afterAll(() => {
  vi.resetAllMocks();
});

// https://github.com/vitest-dev/vitest/issues/821
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock VS Code API - must be available globally for typeof check
(global as any).vscode = {
  postMessage: vi.fn(),
  setState: vi.fn(),
  getState: vi.fn(() => ({})),
};

Object.defineProperty(window, "vscode", {
  writable: true,
  value: {
    postMessage: vi.fn(),
    setState: vi.fn(),
    getState: vi.fn(() => ({})),
  },
});

// Ensure vscode is available at module level
Object.defineProperty(globalThis, "vscode", {
  writable: true,
  value: {
    postMessage: vi.fn(),
    setState: vi.fn(),
    getState: vi.fn(() => ({})),
  },
});

// Mock global functions that might be called
Object.defineProperty(global, "postToIde", {
  writable: true,
  value: vi.fn(),
});

Object.defineProperty(global, "requestFromIde", {
  writable: true,
  value: vi.fn().mockResolvedValue({}),
});

// Mock console methods to reduce noise in tests
Object.defineProperty(console, 'log', {
  writable: true,
  value: vi.fn(),
});

Object.defineProperty(console, 'warn', {
  writable: true,
  value: vi.fn(),
});

Object.defineProperty(console, 'info', {
  writable: true,
  value: vi.fn(),
});
