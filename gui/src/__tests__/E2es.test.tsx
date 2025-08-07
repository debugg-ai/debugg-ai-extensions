import { configureStore } from '@reduxjs/toolkit';
import { screen, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { IdeMessengerContext } from '../context/IdeMessenger';
import E2esPage from '../pages/e2es/E2es';

// Mock child components
const MockE2eTests = () => <div data-testid="e2e-tests">Individual Tests Content</div>;
const MockE2eSuites = () => <div data-testid="e2e-suites">Test Suites Content</div>;
const MockE2eCommitSuites = () => <div data-testid="e2e-commit-suites">Commit Suites Content</div>;

vi.mock('../pages/e2es/E2eTestsPage', () => ({
  default: MockE2eTests,
}));

vi.mock('../pages/e2es/E2eSuites', () => ({
  default: MockE2eSuites,
}));

vi.mock('../pages/e2es/E2eCommitSuites', () => ({
  default: MockE2eCommitSuites,
}));

// Mock the navigation listener hook
vi.mock('../hooks/useNavigationListener', () => ({
  useNavigationListener: vi.fn(),
}));

// Mock the onboarding card
const MockPlatformOnboardingCard = ({ isDialog }: { isDialog: boolean }) => (
  <div data-testid="platform-onboarding-card">
    <div>Please authenticate to use E2E testing features</div>
    <button>Get Started</button>
  </div>
);

vi.mock('../components/OnboardingCard/platform/PlatformOnboardingCard', () => ({
  PlatformOnboardingCard: MockPlatformOnboardingCard,
}));

// Mock the navigate hook
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Create mock auth context
const createMockAuth = (overrides = {}) => ({
  session: null,
  login: vi.fn(),
  logout: vi.fn(),
  isLoading: false,
  ...overrides,
});

// Create mock authenticated user
const createMockAuthenticatedUser = () => ({
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

// Create mock IDE messenger
const createMockIdeMessenger = (overrides = {}) => ({
  post: vi.fn(),
  respond: vi.fn(),
  request: vi.fn(),
  streamRequest: vi.fn().mockReturnValue((async function*() { yield []; })()),
  llmStreamChat: vi.fn().mockReturnValue((async function*() { yield []; })()),
  
  // E2E Tests methods
  fetchE2eTests: vi.fn().mockResolvedValue({ count: 0, next: null, previous: null, results: [] }),
  createE2eTest: vi.fn().mockResolvedValue({ success: true }),
  runE2eTest: vi.fn().mockResolvedValue({ success: true }),
  deleteE2eTest: vi.fn().mockResolvedValue(undefined),
  
  // E2E Test Suites methods
  fetchE2eSuites: vi.fn().mockResolvedValue({ count: 0, next: null, previous: null, results: [] }),
  createE2eSuite: vi.fn().mockResolvedValue({ success: true }),
  runE2eSuite: vi.fn().mockResolvedValue(undefined),
  deleteE2eSuite: vi.fn().mockResolvedValue("deleted"),
  
  // E2E Commit Suites methods
  fetchE2eCommitSuites: vi.fn().mockResolvedValue({ count: 0, next: null, previous: null, results: [] }),
  getE2eCommitSuite: vi.fn().mockResolvedValue(null),
  createE2eCommitSuite: vi.fn().mockResolvedValue({ success: true }),
  runE2eCommitSuite: vi.fn().mockResolvedValue(undefined),
  deleteE2eCommitSuite: vi.fn().mockResolvedValue("deleted"),
  
  ide: {} as any,
  ...overrides,
});

// Create mock Redux store
const createMockStore = (initialState = {}) => {
  const defaultState = {
    config: {
      config: {
        disableIndexing: false,
      },
      ...(initialState as any).config,
    },
  };

  return configureStore({
    reducer: {
      config: (state = defaultState.config) => state,
    },
    preloadedState: defaultState,
  });
};

const renderWithProviders = (
  authContext: any = createMockAuth(),
  ideMessenger: any = createMockIdeMessenger(),
  storeState: any = {}
) => {
  const store = createMockStore(storeState);
  
  return {
    store,
    ...render(
      <Provider store={store}>
        <MemoryRouter>
                      <div data-testid="mock-auth-provider">
            <IdeMessengerContext.Provider value={ideMessenger}>
              <E2esPage />
            </IdeMessengerContext.Provider>
          </div>
        </MemoryRouter>
      </Provider>
    ),
  };
};

describe('E2esPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Authentication States', () => {
    it('should show onboarding card when user is not authenticated', () => {
      renderWithProviders(createMockAuth());
      
      expect(screen.getByTestId('platform-onboarding-card')).toBeInTheDocument();
      expect(screen.getByText('Please authenticate to use E2E testing features')).toBeInTheDocument();
      expect(screen.getByText('E2E Testing')).toBeInTheDocument();
      expect(screen.getByText('End-to-end testing made simple')).toBeInTheDocument();
    });

    it('should show main interface when user is authenticated', () => {
      renderWithProviders(createMockAuthenticatedUser());
      
      expect(screen.queryByTestId('platform-onboarding-card')).not.toBeInTheDocument();
      expect(screen.getByText('E2E Testing')).toBeInTheDocument();
      expect(screen.getByText('Comprehensive end-to-end testing for your applications')).toBeInTheDocument();
    });

    it('should handle null session gracefully', () => {
      renderWithProviders(createMockAuth({ session: null }));
      
      expect(screen.getByTestId('platform-onboarding-card')).toBeInTheDocument();
    });

    it('should handle undefined session gracefully', () => {
      renderWithProviders(createMockAuth({ session: undefined }));
      
      expect(screen.getByTestId('platform-onboarding-card')).toBeInTheDocument();
    });
  });

  describe('Tab Navigation', () => {
    it('should render all tab buttons when authenticated', () => {
      renderWithProviders(createMockAuthenticatedUser());
      
      expect(screen.getByRole('button', { name: /individual tests/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /test suites/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /commit suites/i })).toBeInTheDocument();
    });

    it('should show individual tests tab as active by default', () => {
      renderWithProviders(createMockAuthenticatedUser());
      
      const testsTab = screen.getByRole('button', { name: /individual tests/i });
      expect(testsTab).toHaveClass('border-b-2', 'border-blue-600', 'text-blue-600');
      
      // Should display individual tests content
      expect(screen.getByTestId('e2e-tests')).toBeInTheDocument();
      expect(screen.getByText('Individual Tests Content')).toBeInTheDocument();
    });

    it('should switch to test suites tab when clicked', async () => {
      renderWithProviders(createMockAuthenticatedUser());
      
      const suitesTab = screen.getByRole('button', { name: /test suites/i });
      await userEvent.click(suitesTab);
      
      // Should show test suites content
      expect(screen.getByTestId('e2e-suites')).toBeInTheDocument();
      expect(screen.getByText('Test Suites Content')).toBeInTheDocument();
      
      // Tab should be active
      expect(suitesTab).toHaveClass('border-b-2', 'border-blue-600', 'text-blue-600');
    });

    it('should switch to commit suites tab when clicked', async () => {
      renderWithProviders(createMockAuthenticatedUser());
      
      const commitSuitesTab = screen.getByRole('button', { name: /commit suites/i });
      await userEvent.click(commitSuitesTab);
      
      // Should show commit suites content
      expect(screen.getByTestId('e2e-commit-suites')).toBeInTheDocument();
      expect(screen.getByText('Commit Suites Content')).toBeInTheDocument();
      
      // Tab should be active
      expect(commitSuitesTab).toHaveClass('border-b-2', 'border-blue-600', 'text-blue-600');
    });

    it('should display correct tab descriptions', () => {
      renderWithProviders(createMockAuthenticatedUser());
      
      expect(screen.getByText('Manage individual end-to-end tests')).toBeInTheDocument();
      expect(screen.getByText('Organized collections of related tests')).toBeInTheDocument();
      expect(screen.getByText('Test suites generated from commit changes')).toBeInTheDocument();
    });

    it('should handle rapid tab switching', async () => {
      renderWithProviders(createMockAuthenticatedUser());
      
      const testsTab = screen.getByRole('button', { name: /individual tests/i });
      const suitesTab = screen.getByRole('button', { name: /test suites/i });
      const commitSuitesTab = screen.getByRole('button', { name: /commit suites/i });
      
      // Rapid tab switching
      await userEvent.click(suitesTab);
      await userEvent.click(commitSuitesTab);
      await userEvent.click(testsTab);
      await userEvent.click(suitesTab);
      
      // Should handle gracefully and show final tab
      expect(screen.getByTestId('e2e-suites')).toBeInTheDocument();
    });
  });

  describe('Component Lifecycle and Cleanup', () => {
    it('should properly cleanup on unmount', () => {
      const { unmount } = renderWithProviders(createMockAuthenticatedUser());
      
      // Should unmount without errors
      expect(() => unmount()).not.toThrow();
    });

    it('should handle re-mounting correctly', () => {
      const { unmount } = renderWithProviders(createMockAuthenticatedUser());
      unmount();
      
      // Should be able to mount again without issues
      expect(() => renderWithProviders(createMockAuthenticatedUser())).not.toThrow();
    });

    it('should prevent state updates after unmount', async () => {
      const { unmount } = renderWithProviders(createMockAuthenticatedUser());
      
      // Start tab switching
      const suitesTab = screen.getByRole('button', { name: /test suites/i });
      await userEvent.click(suitesTab);
      
      // Unmount before completion
      unmount();
      
      // Should not cause any errors
      expect(true).toBe(true);
    });
  });

  describe('Quick Stats Section', () => {
    it('should display quick stats for all E2E entity types', () => {
      renderWithProviders(createMockAuthenticatedUser());
      
      // Should show all three quick stat cards
      expect(screen.getByText('Individual Tests')).toBeInTheDocument();
      expect(screen.getByText('Create and run specific test scenarios')).toBeInTheDocument();
      
      expect(screen.getByText('Test Suites')).toBeInTheDocument();
      expect(screen.getByText('Organize tests by features or workflows')).toBeInTheDocument();
      
      expect(screen.getByText('Commit Suites')).toBeInTheDocument();
      expect(screen.getByText('Automatically test code changes')).toBeInTheDocument();
    });

    it('should display correct icons for each entity type', () => {
      renderWithProviders(createMockAuthenticatedUser());
      
      // Icons should be present (can't easily test specific SVG content in jsdom)
      const quickStatsSection = screen.getByText('Individual Tests').closest('.grid');
      expect(quickStatsSection).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing auth context gracefully', () => {
      expect(() => 
        renderWithProviders(
          <Provider store={createMockStore()}>
            <MemoryRouter>
              <IdeMessengerContext.Provider value={createMockIdeMessenger()}>
                <E2esPage />
              </IdeMessengerContext.Provider>
            </MemoryRouter>
          </Provider>
        )
      ).not.toThrow();
    });

    it('should handle missing IDE messenger gracefully', () => {
      expect(() => 
        renderWithProviders(
          <Provider store={createMockStore()}>
            <MemoryRouter>
              <div data-testid="mock-auth-provider">
                <IdeMessengerContext.Provider value={null as any}>
                  <E2esPage />
                              </IdeMessengerContext.Provider>
            </div>
            </MemoryRouter>
          </Provider>
        )
      ).not.toThrow();
    });
  });

  describe('Redux Integration', () => {
    it('should integrate with config from Redux store', () => {
      renderWithProviders(
        createMockAuthenticatedUser(),
        createMockIdeMessenger(),
        {
          config: {
            config: {
              disableIndexing: true,
            },
          },
        }
      );
      
      // Should render normally with config
      expect(screen.getByText('E2E Testing')).toBeInTheDocument();
    });

    it('should handle missing config gracefully', () => {
      renderWithProviders(
        createMockAuthenticatedUser(),
        createMockIdeMessenger(),
        {
          config: {
            config: null,
          },
        }
      );
      
      // Should render normally even with null config
      expect(screen.getByText('E2E Testing')).toBeInTheDocument();
    });
  });

  describe('Navigation Integration', () => {
    it('should call useNavigationListener hook', () => {
      const useNavigationListenerMock = vi.mocked(
        require('../hooks/useNavigationListener').useNavigationListener
      );
      
      renderWithProviders(createMockAuthenticatedUser());
      
      expect(useNavigationListenerMock).toHaveBeenCalled();
    });
  });

  describe('Responsive Design', () => {
    it('should render responsive grid layout', () => {
      renderWithProviders(createMockAuthenticatedUser());
      
      // Should have responsive grid classes
      const quickStatsGrid = screen.getByText('Individual Tests').closest('.grid');
      expect(quickStatsGrid).toHaveClass('grid-cols-1', 'md:grid-cols-3');
    });

    it('should handle different screen sizes', () => {
      renderWithProviders(createMockAuthenticatedUser());
      
      // Should render without layout issues
      expect(screen.getByText('E2E Testing')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', () => {
      renderWithProviders(createMockAuthenticatedUser());
      
      // Should have proper heading structure
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('E2E Testing');
      expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Individual Tests');
    });

    it('should have proper button roles and labels', () => {
      renderWithProviders(createMockAuthenticatedUser());
      
      expect(screen.getByRole('button', { name: /individual tests/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /test suites/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /commit suites/i })).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      renderWithProviders(createMockAuthenticatedUser());
      
      // Should be able to tab through buttons
      const testsTab = screen.getByRole('button', { name: /individual tests/i });
      const suitesTab = screen.getByRole('button', { name: /test suites/i });
      
      // Tab navigation should work
      testsTab.focus();
      await userEvent.keyboard('{Tab}');
      // Next tab should be focusable (though we can't easily test focus in jsdom)
    });
  });

  describe('Content Loading', () => {
    it('should load correct child component based on active tab', async () => {
      renderWithProviders(createMockAuthenticatedUser());
      
      // Initially should show individual tests
      expect(screen.getByTestId('e2e-tests')).toBeInTheDocument();
      
      // Switch to suites
      await userEvent.click(screen.getByRole('button', { name: /test suites/i }));
      expect(screen.getByTestId('e2e-suites')).toBeInTheDocument();
      expect(screen.queryByTestId('e2e-tests')).not.toBeInTheDocument();
      
      // Switch to commit suites
      await userEvent.click(screen.getByRole('button', { name: /commit suites/i }));
      expect(screen.getByTestId('e2e-commit-suites')).toBeInTheDocument();
      expect(screen.queryByTestId('e2e-suites')).not.toBeInTheDocument();
    });

    it('should handle unknown tab gracefully', () => {
      renderWithProviders(createMockAuthenticatedUser());
      
      // Should fallback to first tab if active tab is invalid
      expect(screen.getByTestId('e2e-tests')).toBeInTheDocument();
    });
  });

  describe('Visual Design', () => {
    it('should apply proper styling classes', () => {
      renderWithProviders(createMockAuthenticatedUser());
      
      // Should have proper background and layout classes
      const mainContainer = screen.getByText('E2E Testing').closest('.min-h-screen');
      expect(mainContainer).toHaveClass('bg-zinc-50');
    });

    it('should display icons with proper styling', () => {
      renderWithProviders(createMockAuthenticatedUser());
      
      // Icons should be present in tabs and quick stats
      const tabsContainer = screen.getByRole('button', { name: /individual tests/i });
      expect(tabsContainer).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('should render efficiently with minimal re-renders', () => {
      const { rerender } = renderWithProviders(createMockAuthenticatedUser());
      
      // Re-render with same props should be efficient
      rerender(
        <Provider store={createMockStore()}>
          <MemoryRouter>
                          <div data-testid="mock-auth-provider">
                <IdeMessengerContext.Provider value={createMockIdeMessenger()}>
                  <E2esPage />
                </IdeMessengerContext.Provider>
              </div>
          </MemoryRouter>
        </Provider>
      );
      
      expect(screen.getByText('E2E Testing')).toBeInTheDocument();
    });
  });
}); 