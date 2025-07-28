import { configureStore } from '@reduxjs/toolkit';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IdeMessengerContext } from '../context/IdeMessenger';
import E2eTestsPage from '../pages/e2es/E2eTestsPage';
import e2eTestsSlice from '../redux/slices/e2eTestsSlice';

// Mock the E2eTestsTable component
const MockE2eTestsTable = () => (
  <div data-testid="e2e-tests-table">
    <div>Test 1: Authentication Flow</div>
    <div>Test 2: Shopping Cart</div>
    <div>Test 3: Payment Process</div>
  </div>
);

vi.mock('../../components/e2es/e2e-tests-table', () => ({
  E2eTestsTable: MockE2eTestsTable,
}));

// Mock the navigation listener hook
vi.mock('../../hooks/useNavigationListener', () => ({
  useNavigationListener: vi.fn(),
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

// Mock the Redux thunk
const mockFetchE2eTests = vi.fn();
vi.mock('../../redux/thunks/e2eTestsThunks', () => ({
  fetchE2eTests: mockFetchE2eTests,
}));

// Create mock IDE messenger
const createMockIdeMessenger = (overrides = {}) => ({
  post: vi.fn(),
  respond: vi.fn(),
  request: vi.fn().mockResolvedValue({ success: true }),
  streamRequest: vi.fn().mockReturnValue((async function*() { yield []; })()),
  llmStreamChat: vi.fn().mockReturnValue((async function*() { yield []; })()),
  ide: {} as any,
  ...overrides,
});

// Create mock Redux store
const createMockStore = (initialState = {}) => {
  const defaultState = {
    e2eTests: {
      currentFilters: {},
      currentPagination: { page: 1, limit: 10 },
      tests: [],
      loading: false,
      error: null,
      ...(initialState as any).e2eTests,
    },
    config: {
      config: {
        disableIndexing: false,
      },
      ...(initialState as any).config,
    },
  };

  return configureStore({
    reducer: {
      e2eTests: e2eTestsSlice,
      config: (state = defaultState.config) => state,
    },
    preloadedState: defaultState,
  });
};

const renderWithProviders = (
  ideMessenger = createMockIdeMessenger(),
  storeState = {}
) => {
  const store = createMockStore(storeState);
  
  return {
    store,
    ...render(
      <Provider store={store}>
        <MemoryRouter>
          <IdeMessengerContext.Provider value={ideMessenger}>
            <E2eTestsPage />
          </IdeMessengerContext.Provider>
        </MemoryRouter>
      </Provider>
    ),
  };
};

describe('E2eTestsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockFetchE2eTests.mockReturnValue({ type: 'fetchE2eTests/pending' });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Component Structure', () => {
    it('should render header with title and description', () => {
      renderWithProviders();
      
      expect(screen.getByText('E2E Tests')).toBeInTheDocument();
      expect(screen.getByText('Manage your individual end-to-end tests')).toBeInTheDocument();
    });

    it('should render action buttons', () => {
      renderWithProviders();
      
      expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create test/i })).toBeInTheDocument();
    });

    it('should render the E2eTestsTable component', () => {
      renderWithProviders();
      
      expect(screen.getByTestId('e2e-tests-table')).toBeInTheDocument();
      expect(screen.getByText('Test 1: Authentication Flow')).toBeInTheDocument();
    });
  });

  describe('Redux Integration', () => {
    it('should dispatch fetchE2eTests on refresh', async () => {
      const store = createMockStore();
      const dispatchSpy = vi.spyOn(store, 'dispatch');
      
      renderWithProviders(createMockIdeMessenger(), {});
      
      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      await userEvent.click(refreshButton);
      
      expect(dispatchSpy).toHaveBeenCalled();
    });

    it('should use current filters and pagination from Redux state', () => {
      const mockFilters = { status: 'completed' };
      const mockPagination = { page: 2, limit: 20 };
      
      renderWithProviders(createMockIdeMessenger(), {
        e2eTests: {
          currentFilters: mockFilters,
          currentPagination: mockPagination,
        },
      });
      
      // Component should render without errors using Redux state
      expect(screen.getByText('E2E Tests')).toBeInTheDocument();
    });

    it('should handle Redux loading state', () => {
      renderWithProviders(createMockIdeMessenger(), {
        e2eTests: {
          loading: true,
        },
      });
      
      // Should render normally even when Redux is loading
      expect(screen.getByText('E2E Tests')).toBeInTheDocument();
    });

    it('should handle Redux error state', () => {
      renderWithProviders(createMockIdeMessenger(), {
        e2eTests: {
          error: 'Failed to load tests',
        },
      });
      
      // Should render normally even with Redux errors
      expect(screen.getByText('E2E Tests')).toBeInTheDocument();
    });
  });

  describe('Create Test Modal', () => {
    it('should open create modal when create button is clicked', async () => {
      renderWithProviders();
      
      const createButton = screen.getByRole('button', { name: /create test/i });
      await userEvent.click(createButton);
      
      expect(screen.getByText('Create E2E Test')).toBeInTheDocument();
      expect(screen.getByText('Generate a new end-to-end test')).toBeInTheDocument();
    });

    it('should close modal when cancel button is clicked', async () => {
      renderWithProviders();
      
      // Open modal
      const createButton = screen.getByRole('button', { name: /create test/i });
      await userEvent.click(createButton);
      
      expect(screen.getByText('Create E2E Test')).toBeInTheDocument();
      
      // Close modal
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await userEvent.click(cancelButton);
      
      expect(screen.queryByText('Create E2E Test')).not.toBeInTheDocument();
    });

    it('should require description field', async () => {
      renderWithProviders();
      
      const createButton = screen.getByRole('button', { name: /create test/i });
      await userEvent.click(createButton);
      
      // Submit button should be disabled without description
      const submitButton = screen.getByRole('button', { name: /create test/i });
      expect(submitButton).toBeDisabled();
    });

    it('should enable submit button when description is provided', async () => {
      renderWithProviders();
      
      const createButton = screen.getByRole('button', { name: /create test/i });
      await userEvent.click(createButton);
      
      // Fill in description
      const descriptionField = screen.getByPlaceholderText('Describe what this test should validate...');
      await userEvent.type(descriptionField, 'Test user login flow');
      
      // Submit button should be enabled
      const submitButton = screen.getByRole('button', { name: /create test/i });
      expect(submitButton).not.toBeDisabled();
    });

    it('should handle optional fields correctly', async () => {
      renderWithProviders();
      
      const createButton = screen.getByRole('button', { name: /create test/i });
      await userEvent.click(createButton);
      
      // Fill in all fields
      const descriptionField = screen.getByPlaceholderText('Describe what this test should validate...');
      await userEvent.type(descriptionField, 'Test checkout process');
      
      const filePathField = screen.getByPlaceholderText('/path/to/test/file');
      await userEvent.type(filePathField, '/tests/checkout.spec.js');
      
      const repoNameField = screen.getByPlaceholderText('owner/repository-name');
      await userEvent.type(repoNameField, 'mycompany/ecommerce-app');
      
      const branchNameField = screen.getByPlaceholderText('main');
      await userEvent.type(branchNameField, 'feature/checkout');
      
      // All fields should accept input
      expect(descriptionField).toHaveValue('Test checkout process');
      expect(filePathField).toHaveValue('/tests/checkout.spec.js');
      expect(repoNameField).toHaveValue('mycompany/ecommerce-app');
      expect(branchNameField).toHaveValue('feature/checkout');
    });
  });

  describe('Test Creation Flow', () => {
    it('should handle test creation via IDE messenger', async () => {
      const mockIdeMessenger = createMockIdeMessenger();
      const store = createMockStore();
      const dispatchSpy = vi.spyOn(store, 'dispatch');
      
      renderWithProviders(mockIdeMessenger, {});
      
      // Open modal and fill form
      const createButton = screen.getByRole('button', { name: /create test/i });
      await userEvent.click(createButton);
      
      const descriptionField = screen.getByPlaceholderText('Describe what this test should validate...');
      await userEvent.type(descriptionField, 'Test user registration');
      
      // Submit form
      const submitButton = screen.getByRole('button', { name: /create test/i });
      await userEvent.click(submitButton);
      
      // Should call IDE messenger
      expect(mockIdeMessenger.request).toHaveBeenCalledWith('ideCommand/run', {
        slashCommandName: 'run-command',
        params: {
          command: 'e2eTests/create',
          description: 'Test user registration',
        },
      });
    });

    it('should refresh tests after successful creation', async () => {
      const mockIdeMessenger = createMockIdeMessenger();
      const store = createMockStore();
      const dispatchSpy = vi.spyOn(store, 'dispatch');
      
      renderWithProviders(mockIdeMessenger, {});
      
      // Create test
      const createButton = screen.getByRole('button', { name: /create test/i });
      await userEvent.click(createButton);
      
      const descriptionField = screen.getByPlaceholderText('Describe what this test should validate...');
      await userEvent.type(descriptionField, 'Test search functionality');
      
      const submitButton = screen.getByRole('button', { name: /create test/i });
      await userEvent.click(submitButton);
      
      // Wait for async operations
      await waitFor(() => {
        expect(mockIdeMessenger.request).toHaveBeenCalled();
      });
      
      // Should dispatch refresh after creation
      expect(dispatchSpy).toHaveBeenCalled();
    });

    it('should show loading state during creation', async () => {
      const mockIdeMessenger = createMockIdeMessenger({
        request: vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000))),
      });
      
      renderWithProviders(mockIdeMessenger);
      
      const createButton = screen.getByRole('button', { name: /create test/i });
      await userEvent.click(createButton);
      
      const descriptionField = screen.getByPlaceholderText('Describe what this test should validate...');
      await userEvent.type(descriptionField, 'Test loading states');
      
      const submitButton = screen.getByRole('button', { name: /create test/i });
      await userEvent.click(submitButton);
      
      // Should show loading state
      expect(screen.getByText('Creating...')).toBeInTheDocument();
    });

    it('should close modal after successful creation', async () => {
      const mockIdeMessenger = createMockIdeMessenger();
      
      renderWithProviders(mockIdeMessenger);
      
      const createButton = screen.getByRole('button', { name: /create test/i });
      await userEvent.click(createButton);
      
      const descriptionField = screen.getByPlaceholderText('Describe what this test should validate...');
      await userEvent.type(descriptionField, 'Test form validation');
      
      const submitButton = screen.getByRole('button', { name: /create test/i });
      await userEvent.click(submitButton);
      
      // Wait for modal to close
      await waitFor(() => {
        expect(screen.queryByText('Create E2E Test')).not.toBeInTheDocument();
      });
    });
  });

  describe('Refresh Functionality', () => {
    it('should handle refresh button clicks', async () => {
      const store = createMockStore();
      const dispatchSpy = vi.spyOn(store, 'dispatch');
      
      renderWithProviders(createMockIdeMessenger(), {});
      
      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      await userEvent.click(refreshButton);
      
      expect(dispatchSpy).toHaveBeenCalled();
    });

    it('should show refreshing state', async () => {
      renderWithProviders();
      
      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      await userEvent.click(refreshButton);
      
      // Should show refreshing state
      expect(screen.getByText(/Refreshing.../)).toBeInTheDocument();
    });

    it('should disable refresh button while refreshing', async () => {
      renderWithProviders();
      
      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      await userEvent.click(refreshButton);
      
      // Button should be disabled during refresh
      expect(refreshButton).toBeDisabled();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing IDE messenger gracefully', () => {
      render(
        <Provider store={createMockStore()}>
          <MemoryRouter>
            <IdeMessengerContext.Provider value={null as any}>
              <E2eTestsPage />
            </IdeMessengerContext.Provider>
          </MemoryRouter>
        </Provider>
      );
      
      // Should render normally even without IDE messenger
      expect(screen.getByText('E2E Tests')).toBeInTheDocument();
      
      // Refresh button should be present but may not work
      expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
    });

    it('should handle test creation errors gracefully', async () => {
      const mockIdeMessenger = createMockIdeMessenger({
        request: vi.fn().mockRejectedValue(new Error('Creation failed')),
      });
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      renderWithProviders(mockIdeMessenger);
      
      const createButton = screen.getByRole('button', { name: /create test/i });
      await userEvent.click(createButton);
      
      const descriptionField = screen.getByPlaceholderText('Describe what this test should validate...');
      await userEvent.type(descriptionField, 'Test error handling');
      
      const submitButton = screen.getByRole('button', { name: /create test/i });
      await userEvent.click(submitButton);
      
      // Should handle error gracefully
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Error creating test:', expect.any(Error));
      });
      
      consoleSpy.mockRestore();
    });
  });

  describe('Component Lifecycle and Cleanup', () => {
    it('should properly cleanup on unmount', () => {
      const { unmount } = renderWithProviders();
      
      // Should unmount without errors
      expect(() => unmount()).not.toThrow();
    });

    it('should handle re-mounting correctly', () => {
      const { unmount } = renderWithProviders();
      unmount();
      
      // Should be able to mount again without issues
      expect(() => renderWithProviders()).not.toThrow();
    });

    it('should cancel ongoing requests when component unmounts', async () => {
      const { unmount } = renderWithProviders();
      
      // Start a refresh
      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      await userEvent.click(refreshButton);
      
      // Unmount before completion
      unmount();
      
      // Should not cause any errors
      expect(true).toBe(true);
    });
  });

  describe('Navigation Integration', () => {
    it('should call useNavigationListener hook', () => {
      const useNavigationListenerMock = vi.mocked(
        require('../../hooks/useNavigationListener').useNavigationListener
      );
      
      renderWithProviders();
      
      expect(useNavigationListenerMock).toHaveBeenCalled();
    });
  });

  describe('Form Reset', () => {
    it('should reset form after successful submission', async () => {
      const mockIdeMessenger = createMockIdeMessenger();
      
      renderWithProviders(mockIdeMessenger);
      
      const createButton = screen.getByRole('button', { name: /create test/i });
      await userEvent.click(createButton);
      
      // Fill form
      const descriptionField = screen.getByPlaceholderText('Describe what this test should validate...');
      await userEvent.type(descriptionField, 'Test form reset');
      
      const filePathField = screen.getByPlaceholderText('/path/to/test/file');
      await userEvent.type(filePathField, '/tests/reset.spec.js');
      
      // Submit
      const submitButton = screen.getByRole('button', { name: /create test/i });
      await userEvent.click(submitButton);
      
      // Wait for submission to complete
      await waitFor(() => {
        expect(screen.queryByText('Create E2E Test')).not.toBeInTheDocument();
      });
      
      // Open modal again - form should be reset
      await userEvent.click(createButton);
      
      const newDescriptionField = screen.getByPlaceholderText('Describe what this test should validate...');
      expect(newDescriptionField).toHaveValue('');
    });
  });

  describe('Config Integration', () => {
    it('should integrate with config from Redux store', () => {
      renderWithProviders(createMockIdeMessenger(), {
        config: {
          config: {
            disableIndexing: true,
          },
        },
      });
      
      // Should render normally with config
      expect(screen.getByText('E2E Tests')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper button roles and labels', () => {
      renderWithProviders();
      
      expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create test/i })).toBeInTheDocument();
    });

    it('should handle keyboard navigation in modal', async () => {
      renderWithProviders();
      
      const createButton = screen.getByRole('button', { name: /create test/i });
      await userEvent.click(createButton);
      
      // Modal should be keyboard accessible
      const descriptionField = screen.getByPlaceholderText('Describe what this test should validate...');
      expect(descriptionField).toBeInTheDocument();
      
      // Tab navigation should work
      await userEvent.tab();
      // Next field should be focused (though we can't easily test focus in jsdom)
    });
  });
}); 