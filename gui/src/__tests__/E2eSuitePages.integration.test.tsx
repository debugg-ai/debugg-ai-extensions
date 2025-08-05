import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../util/test/render';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import type { E2eTestCommitSuite, PublicUserInfo } from 'core/debuggAIServer/types';

// Import the components we're testing
import E2eCommitSuitesPage from '../pages/e2es/E2eCommitSuitesPage';
import E2eCommitSuiteDetailPage from '../pages/e2es/E2eCommitSuiteDetailPage';

// Import store slices
import e2eCommitSuitesSlice from '../redux/slices/e2eCommitSuitesSlice';
import sessionSlice from '../redux/slices/sessionSlice';

// Mock the auth context
const mockAuthContext = {
  session: {
    account: { id: 'test-user-id' }
  }
};

const mockIdeMessenger = {
  createE2eCommitSuite: vi.fn(),
  runE2eCommitSuite: vi.fn(),
  getE2eCommitSuite: vi.fn(),
};

// Mock the contexts
vi.mock('../context/Auth', () => ({
  useAuth: () => mockAuthContext
}));

vi.mock('../context/IdeMessenger', () => ({
  IdeMessengerContext: {
    Provider: ({ children }: any) => children,
    Consumer: ({ children }: any) => children(mockIdeMessenger)
  }
}));

vi.mock('../hooks/useNavigationListener', () => ({
  useNavigationListener: () => {}
}));

// Create test store
function createTestStore(initialState: any = {}) {
  return configureStore({
    reducer: {
      e2eCommitSuites: e2eCommitSuitesSlice,
      session: sessionSlice,
    },
    preloadedState: {
      e2eCommitSuites: {
        items: [],
        loading: false,
        error: null,
        currentFilters: {},
        currentPagination: { page: 1, limit: 10 },
        ...(initialState.e2eCommitSuites || {})
      },
      session: {
        messages: [],
        isStreaming: false,
        abortController: null,
        ...(initialState.session || {})
      }
    }
  });
}

// Mock user data that could cause the original error
const mockUserObject: PublicUserInfo = {
  uuid: 'user-123',
  email: 'john.doe@example.com',
  firstName: 'John',
  lastName: 'Doe',
  company: 'Acme Corp'
};

const mockCommitSuite: E2eTestCommitSuite = {
  id: 1,
  uuid: 'suite-123',
  commitHash: 'abc123def456',
  commitHashShort: 'abc123d',
  project: 1,
  projectName: 'Test Project',
  description: 'Test Suite Description',
  summarizedChanges: 'Some test changes',
  tests: [],
  tunnelKey: 'test-tunnel-key',
  key: 'test-key',
  runStatus: 'completed',
  createdBy: mockUserObject,
  timestamp: '2024-01-01T00:00:00Z',
  lastMod: '2024-01-01T00:00:00Z'
};

// Test wrapper component
function TestWrapper({ children, store }: { children: React.ReactNode; store: any }) {
  return (
    <Provider store={store}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </Provider>
  );
}

describe('E2E Suite Pages Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('E2eCommitSuitesPage', () => {
    it('should render commit suites with user objects without React child errors', async () => {
      const store = createTestStore({
        e2eCommitSuites: {
          items: [mockCommitSuite],
          loading: false,
          error: null
        }
      });

      // Mock the Redux dispatch to avoid actual API calls
      const mockDispatch = vi.fn().mockResolvedValue({ payload: [] });
      store.dispatch = mockDispatch;

      expect(() => {
        renderWithProviders(
          <TestWrapper store={store}>
            <E2eCommitSuitesPage />
          </TestWrapper>
        );
      }).not.toThrow();

      // Check that user display is rendered as string, not object
      await waitFor(() => {
        const userDisplay = screen.getByText(/By: John Doe/);  
        expect(userDisplay).toBeInTheDocument();
        expect(userDisplay.textContent).not.toContain('[object Object]');
        expect(userDisplay.textContent).not.toContain('uuid');
      });
    });

    it('should handle commit suite with string createdBy field', async () => {
      const suiteWithStringUser = { ...mockCommitSuite, createdBy: 'user123' };
      const store = createTestStore({
        e2eCommitSuites: {
          items: [suiteWithStringUser],
          loading: false,
          error: null
        }
      });

      store.dispatch = vi.fn().mockResolvedValue({ payload: [] });

      renderWithProviders(
        <TestWrapper store={store}>
          <E2eCommitSuitesPage />
        </TestWrapper>
      );

      await waitFor(() => {
        const userDisplay = screen.getByText(/By: User user123/);
        expect(userDisplay).toBeInTheDocument();
      });
    });

    it('should handle commit suite with missing createdBy field', async () => {
      const suiteWithoutUser = { ...mockCommitSuite, createdBy: undefined };
      const store = createTestStore({
        e2eCommitSuites: {
          items: [suiteWithoutUser],
          loading: false,
          error: null
        }
      });

      store.dispatch = vi.fn().mockResolvedValue({ payload: [] });

      renderWithProviders(
        <TestWrapper store={store}>
          <E2eCommitSuitesPage />
        </TestWrapper>
      );

      // Should not crash, and user section should not appear
      await waitFor(() => {
        const description = screen.getByText('Test Suite Description');
        expect(description).toBeInTheDocument();
      });
    });

    it('should handle user object with missing names', async () => {
      const userWithoutNames = { ...mockUserObject, firstName: '', lastName: '' };
      const suiteWithIncompleteUser = { ...mockCommitSuite, createdBy: userWithoutNames };
      
      const store = createTestStore({
        e2eCommitSuites: {
          items: [suiteWithIncompleteUser],
          loading: false,
          error: null
        }
      });

      store.dispatch = vi.fn().mockResolvedValue({ payload: [] });

      renderWithProviders(
        <TestWrapper store={store}>
          <E2eCommitSuitesPage />
        </TestWrapper>
      );

      // Should fall back to email
      await waitFor(() => {
        const userDisplay = screen.getByText(/By: john\.doe@example\.com/);
        expect(userDisplay).toBeInTheDocument();
      });
    });
  });

  describe('E2eCommitSuiteDetailPage', () => {
    beforeEach(() => {
      // Mock the useParams hook
      vi.mock('react-router-dom', async () => {
        const actual = await vi.importActual('react-router-dom');
        return {
          ...actual,
          useParams: () => ({ suiteId: 'suite-123' }),
          useSearchParams: () => [new URLSearchParams(), vi.fn()],
          useNavigate: () => vi.fn()
        };
      });
    });

    it('should render commit suite detail with user object without React child errors', async () => {
      // Mock the IDE messenger to return the commit suite
      mockIdeMessenger.getE2eCommitSuite.mockResolvedValue(mockCommitSuite);

      const store = createTestStore();

      expect(() => {
        renderWithProviders(
          <TestWrapper store={store}>
            <E2eCommitSuiteDetailPage />
          </TestWrapper>
        );
      }).not.toThrow();

      // Wait for the component to load data
      await waitFor(() => {
        const userDisplay = screen.getByText(/By: John Doe/);
        expect(userDisplay).toBeInTheDocument();
        expect(userDisplay.textContent).not.toContain('[object Object]');
        expect(userDisplay.textContent).not.toContain('uuid');
      });
    });

    it('should handle API response with malformed user data', async () => {
      const malformedSuite = {
        ...mockCommitSuite,
        createdBy: { malformed: 'data', no: 'names', or: 'email' }
      };
      
      mockIdeMessenger.getE2eCommitSuite.mockResolvedValue(malformedSuite);

      const store = createTestStore();

      renderWithProviders(
        <TestWrapper store={store}>
          <E2eCommitSuiteDetailPage />
        </TestWrapper>
      );

      // Should not crash and should show fallback
      await waitFor(() => {
        const userDisplay = screen.getByText(/By: Unknown User/);
        expect(userDisplay).toBeInTheDocument();
      });
    });

    it('should render loading state without errors', async () => {
      // Mock a slow API response
      mockIdeMessenger.getE2eCommitSuite.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockCommitSuite), 1000))
      );

      const store = createTestStore();

      renderWithProviders(
        <TestWrapper store={store}>
          <E2eCommitSuiteDetailPage />
        </TestWrapper>
      );

      // Should show loading state
      await waitFor(() => {
        const loadingText = screen.getByText(/Loading commit suite details/);
        expect(loadingText).toBeInTheDocument();
      });
    });
  });

  describe('Error Prevention Tests', () => {
    it('should never render raw objects in any user display scenario', async () => {
      const testCases = [
        mockUserObject,
        { ...mockUserObject, firstName: '', lastName: '' },
        { ...mockUserObject, firstName: '', lastName: '', email: '' },
        'string-user',
        null,
        undefined,
        { malformed: 'object' }
      ];

      for (const createdBy of testCases) {
        const suite = { ...mockCommitSuite, createdBy };
        const store = createTestStore({
          e2eCommitSuites: {
            items: [suite],
            loading: false,
            error: null
          }
        });

        store.dispatch = vi.fn().mockResolvedValue({ payload: [] });

        const { container, unmount } = renderWithProviders(
          <TestWrapper store={store}>
            <E2eCommitSuitesPage />
          </TestWrapper>
        );

        // Check that no raw objects are rendered
        const html = container.innerHTML;
        expect(html).not.toContain('[object Object]');
        expect(html).not.toContain('uuid');
        expect(html).not.toContain('company');
        
        // If user info is displayed, it should be a string
        const byText = html.match(/By: ([^<]+)/);
        if (byText) {
          expect(typeof byText[1]).toBe('string');
          expect(byText[1].trim().length).toBeGreaterThan(0);
        }

        unmount();
      }
    });

    it('should handle component re-renders without React child errors', async () => {
      const store = createTestStore({
        e2eCommitSuites: {
          items: [mockCommitSuite],
          loading: false,
          error: null
        }
      });

      store.dispatch = vi.fn().mockResolvedValue({ payload: [] });

      const { rerender } = renderWithProviders(
        <TestWrapper store={store}>
          <E2eCommitSuitesPage />
        </TestWrapper>
      );

      // Re-render multiple times to test stability
      for (let i = 0; i < 5; i++) {
        expect(() => {
          rerender(
            <TestWrapper store={store}>
              <E2eCommitSuitesPage />
            </TestWrapper>
          );
        }).not.toThrow();
      }

      // Verify user display is still correct
      const userDisplay = screen.getByText(/By: John Doe/);
      expect(userDisplay).toBeInTheDocument();
    });
  });
});