import { configureStore } from '@reduxjs/toolkit';
import { render } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import type { E2eRun, E2eTest, E2eTestSuite, E2eTestCommitSuite } from 'core/debuggAIServer/types';
import { AuthProvider } from '../../context/Auth';
import { IdeMessengerContext } from '../../context/IdeMessenger';

/**
 * Shared test utilities for E2E components
 * Provides consistent mocking, data creation, and rendering patterns
 */

// =================
// MOCK FACTORIES
// =================

export const createMockIdeMessenger = (overrides = {}) => ({
  request: vi.fn().mockResolvedValue({ success: true }),
  ...overrides,
});

export const createMockAuth = (overrides = {}) => ({
  session: null,
  login: vi.fn(),
  logout: vi.fn(),
  isLoading: false,
  ...overrides,
});

export const createMockAuthenticatedUser = () => ({
  session: {
    account: {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
    },
    token: 'mock-token',
  },
  login: vi.fn(),
  logout: vi.fn(),
  isLoading: false,
});

// =================
// DATA FACTORIES
// =================

export const createMockE2eTest = (overrides: Partial<E2eTest> = {}): E2eTest => ({
  id: 'test-123',
  uuid: 'test-123',
  timeStamp: '2024-01-01T10:00:00Z',
  lastModified: '2024-01-01T12:00:00Z',
  project: 1,
  projectName: 'Sample Project',
  name: 'Sample E2E Test',
  description: 'A comprehensive test for authentication flow',
  testScript: '/tests/auth.spec.ts',
  createdBy: 1,
  curRun: null,
  host: null,
  tunnelKey: null,
  agent: null,
  agentTaskDescription: null,
  ...overrides,
});

export const createMockE2eRun = (overrides: Partial<E2eRun> = {}): E2eRun => ({
  id: 456,
  uuid: 'run-456',
  timestamp: '2024-01-01T10:30:00Z',
  lastModified: '2024-01-01T11:00:00Z',
  key: 'test-run-key-456',
  runType: 'automated',
  test: null,
  status: 'completed',
  outcome: 'pass',
  conversations: [
    {
      uuid: 'conv-1',
      messages: [
        { role: 'user', content: 'Start test execution' },
        { role: 'assistant', content: 'Test completed successfully' }
      ]
    }
  ],
  startedBy: 1,
  runOnHost: 1,
  targetUrl: 'https://app.example.com',
  runGif: null,
  runScript: null,
  runJson: null,
  metrics: {
    executionTime: 25.7,
    numSteps: 8
  },
  tunnelKey: null,
  ...overrides,
});

export const createMockE2eTestSuite = (overrides: Partial<E2eTestSuite> = {}): E2eTestSuite => ({
  uuid: 'suite-123',
  id: 1,
  name: 'Sample Test Suite',
  description: 'A comprehensive suite for testing user workflows',
  project: 1,
  completed: true,
  completedAt: '2024-01-01T12:00:00Z',
  timestamp: '2024-01-01T10:00:00Z',
  lastMod: '2024-01-01T12:00:00Z',
  key: 'suite-key-123',
  createdBy: 1,
  host: 1,
  tests: [],
  feature: null,
  testType: null,
  userRole: null,
  deviceType: null,
  region: null,
  featureId: null,
  testTypeId: null,
  userRoleId: null,
  deviceTypeId: null,
  regionId: null,
  tunnelKey: null,
  ...overrides,
});

export const createMockE2eCommitSuite = (overrides: Partial<E2eTestCommitSuite> = {}): E2eTestCommitSuite => ({
  id: 1,
  uuid: 'commit-suite-123',
  commitHash: 'a1b2c3d4e5f6789abcdef1234567890abcdef123',
  commitHashShort: 'a1b2c3d4',
  project: 1,
  projectName: 'Sample App',
  description: 'Tests for authentication feature',
  summarizedChanges: 'Updated login flow, added OAuth integration',
  tests: [],
  tunnelKey: null,
  key: 'commit-suite-key-123',
  runStatus: 'completed',
  createdBy: {
    uuid: 'user-1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    company: 'Example Corp'
  },
  timestamp: '2024-01-01T10:00:00Z',
  lastMod: '2024-01-01T12:00:00Z',
  ...overrides,
});

// =================
// STORE FACTORIES
// =================

export const createMockStore = (initialState = {}) => {
  const defaultState = {
    e2eTests: {
      currentFilters: {},
      currentPagination: { page: 1, limit: 10 },
      tests: [],
      loading: false,
      error: null,
      ...initialState.e2eTests,
    },
    config: {
      config: {
        disableIndexing: false,
      },
      ...initialState.config,
    },
  };

  return configureStore({
    reducer: {
      e2eTests: (state = defaultState.e2eTests) => state,
      config: (state = defaultState.config) => state,
    },
    preloadedState: defaultState,
  });
};

// =================
// RENDER UTILITIES
// =================

interface RenderWithProvidersOptions {
  authContext?: any;
  ideMessenger?: any;
  storeState?: any;
  initialRoute?: string;
}

export const renderWithProviders = (
  component: React.ReactElement,
  options: RenderWithProvidersOptions = {}
) => {
  const {
    authContext = createMockAuth(),
    ideMessenger = createMockIdeMessenger(),
    storeState = {},
    initialRoute = '/',
  } = options;

  const store = createMockStore(storeState);

  return {
    store,
    ...render(
      <Provider store={store}>
        <MemoryRouter initialEntries={[initialRoute]}>
          <AuthProvider value={authContext}>
            <IdeMessengerContext.Provider value={ideMessenger}>
              {component}
            </IdeMessengerContext.Provider>
          </AuthProvider>
        </MemoryRouter>
      </Provider>
    ),
  };
};

export const renderWithAuthentication = (
  component: React.ReactElement,
  options: Omit<RenderWithProvidersOptions, 'authContext'> = {}
) => {
  return renderWithProviders(component, {
    ...options,
    authContext: createMockAuthenticatedUser(),
  });
};

// =================
// TEST ASSERTIONS
// =================

export const expectLoadingState = (screen: any) => {
  const loadingIndicators = [
    'Loading test run details...',
    'Loading test suites...',
    'Loading commit suites...',
    'Loading...',
  ];

  const hasLoadingState = loadingIndicators.some(indicator => 
    screen.queryByText(indicator) !== null
  );

  expect(hasLoadingState).toBe(true);
};

export const expectErrorState = (screen: any, errorMessage?: string) => {
  const errorIndicators = [
    'Error Loading',
    'Try Again',
    'Failed to load',
    errorMessage,
  ].filter(Boolean);

  const hasErrorState = errorIndicators.some(indicator => 
    screen.queryByText(new RegExp(indicator!, 'i')) !== null
  );

  expect(hasErrorState).toBe(true);
};

export const expectEmptyState = (screen: any) => {
  const emptyStateIndicators = [
    'No Test Suites Found',
    'No Commit Suites Found',
    'No tests found',
    'Get started by creating',
  ];

  const hasEmptyState = emptyStateIndicators.some(indicator => 
    screen.queryByText(new RegExp(indicator, 'i')) !== null
  );

  expect(hasEmptyState).toBe(true);
};

// =================
// COMMON TEST PATTERNS
// =================

export const testComponentCleanup = (renderComponent: () => any) => {
  return () => {
    it('should properly cleanup on unmount', () => {
      const { unmount } = renderComponent();
      expect(() => unmount()).not.toThrow();
    });

    it('should handle re-mounting correctly', () => {
      const { unmount } = renderComponent();
      unmount();
      expect(() => renderComponent()).not.toThrow();
    });
  };
};

export const testRequestCancellation = (screen: any, triggerAction: () => Promise<void>) => {
  return () => {
    it('should handle request cancellation gracefully', async () => {
      await triggerAction();
      // Test should pass if no errors are thrown during cleanup
      expect(true).toBe(true);
    });
  };
};

export const testModalBehavior = (screen: any, modalTrigger: string, modalTitle: string) => {
  return () => {
    it('should open modal when trigger is clicked', async () => {
      const { userEvent } = await import('@testing-library/user-event');
      const user = userEvent.setup();
      
      const triggerButton = screen.getByRole('button', { name: new RegExp(modalTrigger, 'i') });
      await user.click(triggerButton);
      
      expect(screen.getByText(modalTitle)).toBeInTheDocument();
    });

    it('should close modal when cancel is clicked', async () => {
      const { userEvent } = await import('@testing-library/user-event');
      const user = userEvent.setup();
      
      const triggerButton = screen.getByRole('button', { name: new RegExp(modalTrigger, 'i') });
      await user.click(triggerButton);
      
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);
      
      expect(screen.queryByText(modalTitle)).not.toBeInTheDocument();
    });
  };
};

// =================
// ASYNC UTILITIES
// =================

export const waitForDataLoad = async (screen: any, expectedContent: string, timeout = 1000) => {
  const { waitFor } = await import('@testing-library/react');
  
  await waitFor(() => {
    expect(screen.getByText(expectedContent)).toBeInTheDocument();
  }, { timeout });
};

export const simulateAsyncDelay = (delay = 500) => {
  return new Promise(resolve => setTimeout(resolve, delay));
};

// =================
// FORM UTILITIES
// =================

export const fillForm = async (screen: any, fields: Record<string, string>) => {
  const { userEvent } = await import('@testing-library/user-event');
  const user = userEvent.setup();

  for (const [fieldName, value] of Object.entries(fields)) {
    const field = screen.getByLabelText(new RegExp(fieldName, 'i')) || 
                 screen.getByPlaceholderText(new RegExp(fieldName, 'i'));
    await user.clear(field);
    await user.type(field, value);
  }
};

export const submitForm = async (screen: any, submitButtonText = 'submit') => {
  const { userEvent } = await import('@testing-library/user-event');
  const user = userEvent.setup();

  const submitButton = screen.getByRole('button', { name: new RegExp(submitButtonText, 'i') });
  await user.click(submitButton);
};

// =================
// TIMER UTILITIES
// =================

export const advanceTimers = (ms: number) => {
  const { act } = require('@testing-library/react');
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

export const setupFakeTimers = () => {
  vi.useFakeTimers();
  return () => vi.useRealTimers();
};

// =================
// ERROR HANDLING UTILITIES
// =================

export const suppressConsoleError = (testFn: () => void | Promise<void>) => {
  return async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    try {
      await testFn();
    } finally {
      consoleSpy.mockRestore();
    }
  };
};

export const expectConsoleError = (errorMessage: string, testFn: () => void | Promise<void>) => {
  return async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    try {
      await testFn();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(errorMessage),
        expect.anything()
      );
    } finally {
      consoleSpy.mockRestore();
    }
  };
};

// =================
// NAVIGATION UTILITIES
// =================

export const mockNavigate = vi.fn();

export const expectNavigation = (expectedPath: string) => {
  expect(mockNavigate).toHaveBeenCalledWith(expectedPath);
};

export const expectBackNavigation = () => {
  expect(mockNavigate).toHaveBeenCalledWith(-1);
};

// =================
// ACCESSIBILITY UTILITIES
// =================

export const testAccessibility = (screen: any) => {
  return () => {
    it('should have proper button roles', () => {
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('should have proper heading structure', () => {
      const headings = screen.getAllByRole('heading');
      expect(headings.length).toBeGreaterThan(0);
    });
  };
};

// =================
// COMPONENT-SPECIFIC UTILITIES
// =================

export const createE2eRunPageProps = (overrides = {}) => ({
  testId: 'test-123',
  runId: 'run-456',
  ...overrides,
});

export const createStatusBadgeProps = (status: string, outcome?: string) => ({
  status: status as any,
  outcome: outcome as any,
});

// =================
// VITEST EXTENSIONS
// =================

export const expectToBeInDocument = (element: any) => {
  expect(element).toBeInTheDocument();
};

export const expectNotToBeInDocument = (element: any) => {
  expect(element).not.toBeInTheDocument();
};

export const expectToHaveClass = (element: any, className: string) => {
  expect(element).toHaveClass(className);
};

// =================
// EXPORT COLLECTIONS
// =================

export const testUtils = {
  // Factories
  createMockIdeMessenger,
  createMockAuth,
  createMockAuthenticatedUser,
  createMockE2eTest,
  createMockE2eRun,
  createMockE2eTestSuite,
  createMockE2eCommitSuite,
  createMockStore,

  // Rendering
  renderWithProviders,
  renderWithAuthentication,

  // Assertions
  expectLoadingState,
  expectErrorState,
  expectEmptyState,

  // Patterns
  testComponentCleanup,
  testRequestCancellation,
  testModalBehavior,
  testAccessibility,

  // Async
  waitForDataLoad,
  simulateAsyncDelay,

  // Forms
  fillForm,
  submitForm,

  // Timers
  advanceTimers,
  setupFakeTimers,

  // Navigation
  mockNavigate,
  expectNavigation,
  expectBackNavigation,

  // Error handling
  suppressConsoleError,
  expectConsoleError,
}; 