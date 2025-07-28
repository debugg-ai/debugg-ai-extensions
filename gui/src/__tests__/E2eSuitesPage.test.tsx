import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import type { E2eTestSuite, PublicUserInfo } from 'core/debuggAIServer/types';

// Import the component we're testing
import E2eSuitesPage from '../pages/e2es/E2eSuitesPage';

// Import store slices
import e2eSuitesSlice from '../redux/slices/e2eSuitesSlice';
import sessionSlice from '../redux/slices/sessionSlice';

// Mock the auth context
const mockAuthContext = {
  session: {
    account: { id: 'test-user-id' }
  }
};

const mockIdeMessenger = {
  createE2eSuite: vi.fn(),
  runE2eSuite: vi.fn(),
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
      e2eSuites: e2eSuitesSlice,
      session: sessionSlice,
    },
    preloadedState: {
      e2eSuites: {
        items: [],
        loading: false,
        error: null,
        currentFilters: {},
        currentPagination: { page: 1, limit: 10 },
        ...(initialState.e2eSuites || {})
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

const mockE2eSuite: E2eTestSuite = {
  uuid: 'suite-123',
  id: 1,
  name: 'Test Suite',
  description: 'Test Suite Description',
  project: 1,
  host: null,
  createdBy: mockUserObject as any, // This could be object or number
  completed: true,
  completedAt: '2024-01-01T00:00:00Z',
  tests: [],
  key: 'test-key',
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

describe('E2eSuitesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('User Display', () => {
    it('should render suite with user object without React child errors', async () => {
      const store = createTestStore({
        e2eSuites: {
          items: [mockE2eSuite],
          loading: false,
          error: null
        }
      });

      // Mock the Redux dispatch to avoid actual API calls
      const mockDispatch = vi.fn().mockResolvedValue({ payload: [] });
      store.dispatch = mockDispatch;

      expect(() => {
        render(
          <TestWrapper store={store}>
            <E2eSuitesPage />
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

    it('should handle suite with numeric createdBy field', async () => {
      const suiteWithNumericUser = { ...mockE2eSuite, createdBy: 123 };
      const store = createTestStore({
        e2eSuites: {
          items: [suiteWithNumericUser],
          loading: false,
          error: null
        }
      });

      store.dispatch = vi.fn().mockResolvedValue({ payload: [] });

      render(
        <TestWrapper store={store}>
          <E2eSuitesPage />
        </TestWrapper>
      );

      await waitFor(() => {
        const userDisplay = screen.getByText(/By: 123/);
        expect(userDisplay).toBeInTheDocument();
      });
    });

    it('should handle suite with missing createdBy field', async () => {
      const suiteWithoutUser = { ...mockE2eSuite, createdBy: null };
      const store = createTestStore({
        e2eSuites: {
          items: [suiteWithoutUser],
          loading: false,
          error: null
        }
      });

      store.dispatch = vi.fn().mockResolvedValue({ payload: [] });

      render(
        <TestWrapper store={store}>
          <E2eSuitesPage />
        </TestWrapper>
      );

      // Should not crash, and user section should not appear
      await waitFor(() => {
        const description = screen.getByText('Test Suite Description');
        expect(description).toBeInTheDocument();
        // User section should not be present
        expect(screen.queryByText(/By:/)).not.toBeInTheDocument();
      });
    });

    it('should handle user object with missing names', async () => {
      const userWithoutNames = { ...mockUserObject, firstName: '', lastName: '' };
      const suiteWithIncompleteUser = { ...mockE2eSuite, createdBy: userWithoutNames };
      
      const store = createTestStore({
        e2eSuites: {
          items: [suiteWithIncompleteUser],
          loading: false,
          error: null
        }
      });

      store.dispatch = vi.fn().mockResolvedValue({ payload: [] });

      render(
        <TestWrapper store={store}>
          <E2eSuitesPage />
        </TestWrapper>
      );

      // Should fall back to email
      await waitFor(() => {
        const userDisplay = screen.getByText(/By: john\.doe@example\.com/);
        expect(userDisplay).toBeInTheDocument();
      });
    });

    it('should never render raw objects in user display', async () => {
      const testCases = [
        mockUserObject,
        { ...mockUserObject, firstName: '', lastName: '' },
        { ...mockUserObject, firstName: '', lastName: '', email: '' },
        123,
        null,
        { malformed: 'object' }
      ];

      for (const createdBy of testCases) {
        const suite = { ...mockE2eSuite, createdBy };
        const store = createTestStore({
          e2eSuites: {
            items: [suite],
            loading: false,
            error: null
          }
        });

        store.dispatch = vi.fn().mockResolvedValue({ payload: [] });

        const { container, unmount } = render(
          <TestWrapper store={store}>
            <E2eSuitesPage />
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
  });
});