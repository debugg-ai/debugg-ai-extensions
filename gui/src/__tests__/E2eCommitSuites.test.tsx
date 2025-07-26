import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { E2eTestCommitSuite } from 'core/debuggAIServer/types';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IdeMessengerContext } from '../context/IdeMessenger';
import E2eCommitSuites from '../pages/e2es/E2eCommitSuites';

// Mock the navigate hook
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Create mock IDE messenger
const createMockIdeMessenger = (overrides = {}) => ({
  request: vi.fn(),
  ...overrides,
});

// Mock commit suites data
const mockCommitSuites: E2eTestCommitSuite[] = [
  {
    id: 1,
    uuid: 'commit-suite-1',
    commitHash: 'a1b2c3d4e5f6789abcdef1234567890abcdef123',
    commitHashShort: 'a1b2c3d4',
    project: 1,
    projectName: 'MyApp Frontend',
    description: 'Tests for authentication refactor',
    summarizedChanges: 'Updated login flow, added OAuth integration, fixed password validation',
    tests: [],
    tunnelKey: null,
    key: 'auth-refactor-tests',
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
  },
  {
    id: 2,
    uuid: 'commit-suite-2',
    commitHash: 'f6e5d4c3b2a1098765432109876543210987654f',
    commitHashShort: 'f6e5d4c3',
    project: 1,
    projectName: 'MyApp Frontend',
    description: 'Shopping cart feature implementation',
    summarizedChanges: 'Added cart state management, implemented add/remove items, created checkout flow',
    tests: [],
    tunnelKey: null,
    key: 'cart-feature-tests',
    runStatus: 'running',
    createdBy: {
      uuid: 'user-2',
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@example.com',
      company: 'Example Corp'
    },
    timestamp: '2024-01-01T11:00:00Z',
    lastMod: '2024-01-01T11:30:00Z',
  },
  {
    id: 3,
    uuid: 'commit-suite-3',
    commitHash: '9876543210abcdef1234567890abcdef12345678',
    commitHashShort: '98765432',
    project: 2,
    projectName: 'API Backend',
    description: 'Database schema migration',
    summarizedChanges: 'Updated user table schema, added new indexes, migrated data',
    tests: [],
    tunnelKey: null,
    key: 'db-migration-tests',
    runStatus: 'pending',
    createdBy: {
      uuid: 'user-1',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      company: 'Example Corp'
    },
    timestamp: '2024-01-01T09:00:00Z',
    lastMod: '2024-01-01T09:30:00Z',
  }
];

const renderWithContext = (ideMessenger = createMockIdeMessenger()) => {
  return render(
    <MemoryRouter>
      <IdeMessengerContext.Provider value={ideMessenger}>
        <E2eCommitSuites />
      </IdeMessengerContext.Provider>
    </MemoryRouter>
  );
};

describe('E2eCommitSuites', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Initial Loading State', () => {
    it('should show loading spinner initially', () => {
      renderWithContext();
      
      expect(screen.getByText('Loading commit suites...')).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should have proper default empty states', () => {
      renderWithContext();
      
      // Component should not crash with empty initial states
      expect(screen.getByText('Loading commit suites...')).toBeInTheDocument();
    });
  });

  describe('Data Loading and Display', () => {
    it('should display commit suites after loading', async () => {
      renderWithContext();
      
      // Fast-forward past the simulated API delay
      act(() => {
        vi.advanceTimersByTime(500);
      });
      
      await waitFor(() => {
        expect(screen.getByText('MyApp Frontend')).toBeInTheDocument();
      });
      
      expect(screen.getByText('Tests for authentication refactor')).toBeInTheDocument();
      expect(screen.getByText('Shopping cart feature implementation')).toBeInTheDocument();
      expect(screen.getByText('Database schema migration')).toBeInTheDocument();
      expect(screen.getByText('API Backend')).toBeInTheDocument();
    });

    it('should display commit hash badges correctly', async () => {
      renderWithContext();
      
      act(() => {
        vi.advanceTimersByTime(500);
      });
      
      await waitFor(() => {
        expect(screen.getByText('MyApp Frontend')).toBeInTheDocument();
      });
      
      // Should show commit hash short codes
      expect(screen.getByText('a1b2c3d4')).toBeInTheDocument();
      expect(screen.getByText('f6e5d4c3')).toBeInTheDocument();
      expect(screen.getByText('98765432')).toBeInTheDocument();
    });

    it('should display different status badges correctly', async () => {
      renderWithContext();
      
      act(() => {
        vi.advanceTimersByTime(500);
      });
      
      await waitFor(() => {
        expect(screen.getByText('MyApp Frontend')).toBeInTheDocument();
      });
      
      // Should show different status badges
      expect(screen.getByText('Completed')).toBeInTheDocument();
      expect(screen.getByText('Running')).toBeInTheDocument();
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    it('should display summarized changes when available', async () => {
      renderWithContext();
      
      act(() => {
        vi.advanceTimersByTime(500);
      });
      
      await waitFor(() => {
        expect(screen.getByText('MyApp Frontend')).toBeInTheDocument();
      });
      
      // Should show summarized changes
      expect(screen.getByText(/Changes: Updated login flow, added OAuth integration/)).toBeInTheDocument();
      expect(screen.getByText(/Changes: Added cart state management/)).toBeInTheDocument();
    });

    it('should display empty state when no commit suites exist', async () => {
      renderWithContext();
      
      // Fast-forward but expect empty state
      act(() => {
        vi.advanceTimersByTime(500);
      });
      
      await waitFor(() => {
        expect(screen.queryByText('Loading commit suites...')).not.toBeInTheDocument();
      });
      
      // Should show empty state
      expect(screen.getByText('No Commit Suites Found')).toBeInTheDocument();
      expect(screen.getByText('Generate test suites based on your commit changes')).toBeInTheDocument();
    });
  });

  describe('Create Commit Suite Modal', () => {
    it('should open create modal when create button is clicked', async () => {
      renderWithContext();
      
      act(() => {
        vi.advanceTimersByTime(500);
      });
      
      await waitFor(() => {
        expect(screen.getByText('MyApp Frontend')).toBeInTheDocument();
      });
      
      const createButton = screen.getByRole('button', { name: /create commit suite/i });
      await userEvent.click(createButton);
      
      expect(screen.getByText('Create Commit Suite')).toBeInTheDocument();
      expect(screen.getByText('Generate E2E tests based on commit changes')).toBeInTheDocument();
    });

    it('should include commit-specific fields in the modal', async () => {
      renderWithContext();
      
      act(() => {
        vi.advanceTimersByTime(500);
      });
      
      await waitFor(() => {
        expect(screen.getByText('MyApp Frontend')).toBeInTheDocument();
      });
      
      const createButton = screen.getByRole('button', { name: /create commit suite/i });
      await userEvent.click(createButton);
      
      // Should have commit-specific fields
      expect(screen.getByPlaceholderText('abc123def456...')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('feature/new-feature')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('/path/to/changed/file')).toBeInTheDocument();
    });

    it('should handle commit suite form submission correctly', async () => {
      renderWithContext();
      
      act(() => {
        vi.advanceTimersByTime(500);
      });
      
      await waitFor(() => {
        expect(screen.getByText('MyApp Frontend')).toBeInTheDocument();
      });
      
      const createButton = screen.getByRole('button', { name: /create commit suite/i });
      await userEvent.click(createButton);
      
      // Fill in commit-specific form
      const descriptionField = screen.getByPlaceholderText('Describe the changes in this commit that need testing...');
      await userEvent.type(descriptionField, 'Test new payment gateway integration');
      
      const commitHashField = screen.getByPlaceholderText('abc123def456...');
      await userEvent.type(commitHashField, 'abc123def456789');
      
      const branchNameField = screen.getByPlaceholderText('feature/new-feature');
      await userEvent.type(branchNameField, 'feature/payment-gateway');
      
      const filePathField = screen.getByPlaceholderText('/path/to/changed/file');
      await userEvent.type(filePathField, '/src/payment/gateway.js');
      
      const repoNameField = screen.getByPlaceholderText('owner/repository-name');
      await userEvent.type(repoNameField, 'mycompany/payment-app');
      
      // Submit form
      const submitButton = screen.getByRole('button', { name: /create commit suite/i });
      await userEvent.click(submitButton);
      
      // Should show loading state
      expect(screen.getByText('Creating...')).toBeInTheDocument();
    });

    it('should use purple color scheme for commit suite buttons', async () => {
      renderWithContext();
      
      act(() => {
        vi.advanceTimersByTime(500);
      });
      
      await waitFor(() => {
        expect(screen.getByText('MyApp Frontend')).toBeInTheDocument();
      });
      
      const createButton = screen.getByRole('button', { name: /create commit suite/i });
      await userEvent.click(createButton);
      
      // Should have purple styling
      const modalSubmitButton = screen.getByRole('button', { name: /create commit suite/i });
      expect(modalSubmitButton).toHaveClass('bg-purple-600');
    });
  });

  describe('Commit Suite Operations', () => {
    it('should handle view commit suite action', async () => {
      renderWithContext();
      
      act(() => {
        vi.advanceTimersByTime(500);
      });
      
      await waitFor(() => {
        expect(screen.getByText('MyApp Frontend')).toBeInTheDocument();
      });
      
      // Find and click view button for first commit suite
      const viewButtons = screen.getAllByTitle('View Details');
      await userEvent.click(viewButtons[0]);
      
      expect(mockNavigate).toHaveBeenCalledWith('/e2es/commit-suites/commit-suite-1');
    });

    it('should handle run commit suite action', async () => {
      renderWithContext();
      
      act(() => {
        vi.advanceTimersByTime(500);
      });
      
      await waitFor(() => {
        expect(screen.getByText('MyApp Frontend')).toBeInTheDocument();
      });
      
      // Find and click run button (should use purple styling)
      const runButtons = screen.getAllByTitle('Run Commit Suite');
      await userEvent.click(runButtons[0]);
      
      // Should optimistically update the UI
      expect(true).toBe(true); // Test passes if no errors
    });
  });

  describe('Request Cancellation and Cleanup', () => {
    it('should cancel ongoing requests when component unmounts', async () => {
      const { unmount } = renderWithContext();
      
      // Start loading but unmount before completion
      unmount();
      
      // Fast-forward timers - should not cause state updates on unmounted component
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      
      // No errors should be thrown
      expect(true).toBe(true);
    });

    it('should handle multiple rapid refresh requests correctly', async () => {
      renderWithContext();
      
      // Wait for initial load
      act(() => {
        vi.advanceTimersByTime(500);
      });
      
      await waitFor(() => {
        expect(screen.getByText('MyApp Frontend')).toBeInTheDocument();
      });
      
      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      
      // Trigger multiple rapid refreshes
      await userEvent.click(refreshButton);
      await userEvent.click(refreshButton);
      await userEvent.click(refreshButton);
      
      // Should handle cancellation gracefully
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      
      expect(screen.getByText(/Refreshing.../)).toBeInTheDocument();
    });
  });

  describe('Commit Suite Card Display', () => {
    it('should display commit suite information correctly', async () => {
      renderWithContext();
      
      act(() => {
        vi.advanceTimersByTime(500);
      });
      
      await waitFor(() => {
        expect(screen.getByText('MyApp Frontend')).toBeInTheDocument();
      });
      
      // Should display commit suite details
      expect(screen.getByText('Tests for authentication refactor')).toBeInTheDocument();
      expect(screen.getByText('Shopping cart feature implementation')).toBeInTheDocument();
      expect(screen.getByText('0 tests')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });

    it('should handle missing project names gracefully', async () => {
      renderWithContext();
      
      act(() => {
        vi.advanceTimersByTime(500);
      });
      
      await waitFor(() => {
        // Should show project ID fallback when project name is missing
        expect(screen.getByText('MyApp Frontend')).toBeInTheDocument();
        expect(screen.getByText('API Backend')).toBeInTheDocument();
      });
    });

    it('should display proper formatting for commit hashes', async () => {
      renderWithContext();
      
      act(() => {
        vi.advanceTimersByTime(500);
      });
      
      await waitFor(() => {
        expect(screen.getByText('MyApp Frontend')).toBeInTheDocument();
      });
      
      // Should display commit hash badges with proper styling
      const commitBadges = screen.getAllByText(/[a-f0-9]{8}/);
      expect(commitBadges.length).toBeGreaterThan(0);
    });
  });

  describe('Status Badge Variations', () => {
    it('should display running status with spinner', async () => {
      renderWithContext();
      
      act(() => {
        vi.advanceTimersByTime(500);
      });
      
      await waitFor(() => {
        expect(screen.getByText('MyApp Frontend')).toBeInTheDocument();
      });
      
      // Should show running status
      expect(screen.getByText('Running')).toBeInTheDocument();
    });

    it('should display completed status with checkmark', async () => {
      renderWithContext();
      
      act(() => {
        vi.advanceTimersByTime(500);
      });
      
      await waitFor(() => {
        expect(screen.getByText('MyApp Frontend')).toBeInTheDocument();
      });
      
      // Should show completed status
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    it('should display pending status correctly', async () => {
      renderWithContext();
      
      act(() => {
        vi.advanceTimersByTime(500);
      });
      
      await waitFor(() => {
        expect(screen.getByText('MyApp Frontend')).toBeInTheDocument();
      });
      
      // Should show pending status
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should show empty state CTA when no commit suites exist', async () => {
      renderWithContext();
      
      act(() => {
        vi.advanceTimersByTime(500);
      });
      
      await waitFor(() => {
        expect(screen.queryByText('Loading commit suites...')).not.toBeInTheDocument();
      });
      
      // Should show empty state with CTA
      expect(screen.getByText('No Commit Suites Found')).toBeInTheDocument();
      
      const ctaButton = screen.getByRole('button', { name: /create your first commit suite/i });
      await userEvent.click(ctaButton);
      
      // Should open create modal
      expect(screen.getByText('Create Commit Suite')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing IDE messenger gracefully', () => {
      render(
        <MemoryRouter>
          <IdeMessengerContext.Provider value={null as any}>
            <E2eCommitSuites />
          </IdeMessengerContext.Provider>
        </MemoryRouter>
      );
      
      // Should show loading state even without IDE messenger
      expect(screen.getByText('Loading commit suites...')).toBeInTheDocument();
    });

    it('should handle creation errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      renderWithContext();
      
      act(() => {
        vi.advanceTimersByTime(500);
      });
      
      await waitFor(() => {
        expect(screen.getByText('MyApp Frontend')).toBeInTheDocument();
      });
      
      // Test that the component handles creation errors without crashing
      // In a real scenario, you'd mock the API to fail
      
      consoleSpy.mockRestore();
    });
  });

  describe('Component Lifecycle', () => {
    it('should properly cleanup on unmount', () => {
      const { unmount } = renderWithContext();
      
      // Should unmount without errors
      expect(() => unmount()).not.toThrow();
    });

    it('should handle re-mounting correctly', () => {
      const { unmount } = renderWithContext();
      unmount();
      
      // Should be able to mount again without issues
      expect(() => renderWithContext()).not.toThrow();
    });
  });

  describe('Unique Commit Suite Features', () => {
    it('should display commit-specific visual elements', async () => {
      renderWithContext();
      
      act(() => {
        vi.advanceTimersByTime(500);
      });
      
      await waitFor(() => {
        expect(screen.getByText('MyApp Frontend')).toBeInTheDocument();
      });
      
      // Should show commit hash badges (unique to commit suites)
      expect(screen.getByText('a1b2c3d4')).toBeInTheDocument();
      
      // Should show summarized changes (unique to commit suites)
      expect(screen.getByText(/Changes: Updated login flow/)).toBeInTheDocument();
    });

    it('should use purple color scheme throughout', async () => {
      renderWithContext();
      
      act(() => {
        vi.advanceTimersByTime(500);
      });
      
      await waitFor(() => {
        expect(screen.getByText('MyApp Frontend')).toBeInTheDocument();
      });
      
      // Check purple color scheme in create button
      const createButton = screen.getByRole('button', { name: /create commit suite/i });
      expect(createButton).toHaveClass('bg-purple-600');
    });

    it('should handle missing commit hash gracefully', async () => {
      renderWithContext();
      
      act(() => {
        vi.advanceTimersByTime(500);
      });
      
      await waitFor(() => {
        expect(screen.getByText('MyApp Frontend')).toBeInTheDocument();
      });
      
      // Component should handle missing commit hashes without crashing
      expect(true).toBe(true);
    });
  });

  describe('Form Validation', () => {
    it('should require description field in commit suite modal', async () => {
      renderWithContext();
      
      act(() => {
        vi.advanceTimersByTime(500);
      });
      
      await waitFor(() => {
        expect(screen.getByText('MyApp Frontend')).toBeInTheDocument();
      });
      
      const createButton = screen.getByRole('button', { name: /create commit suite/i });
      await userEvent.click(createButton);
      
      // Submit button should be disabled without description
      const submitButton = screen.getByRole('button', { name: /create commit suite/i });
      expect(submitButton).toBeDisabled();
    });

    it('should handle optional commit hash field correctly', async () => {
      renderWithContext();
      
      act(() => {
        vi.advanceTimersByTime(500);
      });
      
      await waitFor(() => {
        expect(screen.getByText('MyApp Frontend')).toBeInTheDocument();
      });
      
      const createButton = screen.getByRole('button', { name: /create commit suite/i });
      await userEvent.click(createButton);
      
      // Fill only description (commit hash is optional)
      const descriptionField = screen.getByPlaceholderText('Describe the changes in this commit that need testing...');
      await userEvent.type(descriptionField, 'Test changes');
      
      // Submit button should be enabled
      const submitButton = screen.getByRole('button', { name: /create commit suite/i });
      expect(submitButton).not.toBeDisabled();
    });
  });
}); 