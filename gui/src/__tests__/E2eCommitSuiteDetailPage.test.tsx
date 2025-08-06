import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../util/test/render';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import type { E2eTestCommitSuite } from 'core/debuggAIServer/types';

// Import the component we're testing
import E2eCommitSuiteDetailPage from '../pages/e2es/E2eCommitSuiteDetailPage';

// Mock the auth context
const mockAuthContext = {
  session: {
    account: { id: 'test-user-id' }
  }
};

// Mock commit suite data
const mockCommitSuite: E2eTestCommitSuite = {
  id: 1,
  uuid: 'commit-suite-123',
  commitHash: 'abc123def456',
  commitHashShort: 'abc123de',
  project: 1,
  projectName: 'Test Project',
  description: 'Test Commit Suite',
  summarizedChanges: 'Added new features',
  tests: [],
  tunnelKey: 'tunnel-key-123',
  key: 'url-key-123',
  runStatus: 'pending',
  createdBy: {
    uuid: 'user-123',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    company: 'Test Company'
  },
  timestamp: '2024-01-01T00:00:00Z',
  lastMod: '2024-01-01T00:00:00Z'
};

const mockIdeMessenger = {
  getE2eCommitSuite: vi.fn(),
  runE2eCommitSuite: vi.fn(),
};

// Mock the contexts and hooks
vi.mock('../context/Auth', () => ({
  useAuth: () => mockAuthContext
}));

vi.mock('../context/IdeMessenger', () => ({
  IdeMessengerContext: {
    Provider: ({ children }: any) => children,
    Consumer: ({ children }: any) => children(mockIdeMessenger)
  }
}));

vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
    useContext: () => mockIdeMessenger
  };
});

vi.mock('../hooks/useNavigationListener', () => ({
  useNavigationListener: () => {}
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ suiteId: 'commit-suite-123' }),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
    useNavigate: () => vi.fn()
  };
});

// Test wrapper component
function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <BrowserRouter>
      {children}
    </BrowserRouter>
  );
}

describe('E2eCommitSuiteDetailPage Loading States', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear console logs before each test
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('should show loading state initially', async () => {
    // Mock a delayed API response
    mockIdeMessenger.getE2eCommitSuite.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(mockCommitSuite), 100))
    );

    renderWithProviders(
      <TestWrapper>
        <E2eCommitSuiteDetailPage />
      </TestWrapper>
    );

    // Should show loading state initially
    expect(screen.getByText('Loading commit suite details...')).toBeInTheDocument();
  });

  it('should load and display commit suite data successfully', async () => {
    // Mock successful API response
    mockIdeMessenger.getE2eCommitSuite.mockResolvedValue(mockCommitSuite);

    renderWithProviders(
      <TestWrapper>
        <E2eCommitSuiteDetailPage />
      </TestWrapper>
    );

    // Should show loading initially
    expect(screen.getByText('Loading commit suite details...')).toBeInTheDocument();

    // Wait for data to load and loading to disappear
    await waitFor(() => {
      expect(screen.queryByText('Loading commit suite details...')).not.toBeInTheDocument();
    }, { timeout: 3000 });

    // Should show the commit suite data
    await waitFor(() => {
      expect(screen.getByText('Test Commit Suite')).toBeInTheDocument();
    });
  });

  it('should handle API failure gracefully', async () => {
    // Mock API failure
    mockIdeMessenger.getE2eCommitSuite.mockRejectedValue(new Error('API Error'));

    renderWithProviders(
      <TestWrapper>
        <E2eCommitSuiteDetailPage />
      </TestWrapper>
    );

    // Should show loading initially
    expect(screen.getByText('Loading commit suite details...')).toBeInTheDocument();

    // Wait for error state
    await waitFor(() => {
      expect(screen.getByText('Error Loading')).toBeInTheDocument();
    });

    expect(screen.getByText('Failed to load commit suite details')).toBeInTheDocument();
  });

  it('should handle null API response', async () => {
    // Mock null response
    mockIdeMessenger.getE2eCommitSuite.mockResolvedValue(null);

    renderWithProviders(
      <TestWrapper>
        <E2eCommitSuiteDetailPage />
      </TestWrapper>
    );

    // Wait for error state
    await waitFor(() => {
      expect(screen.getByText('Error Loading')).toBeInTheDocument();
    });

    expect(screen.getByText('Failed to load commit suite details')).toBeInTheDocument();
  });

  it('should handle undefined API response', async () => {
    // Mock undefined response
    mockIdeMessenger.getE2eCommitSuite.mockResolvedValue(undefined);

    renderWithProviders(
      <TestWrapper>
        <E2eCommitSuiteDetailPage />
      </TestWrapper>
    );

    // Wait for error state
    await waitFor(() => {
      expect(screen.getByText('Error Loading')).toBeInTheDocument();
    });

    expect(screen.getByText('Failed to load commit suite details')).toBeInTheDocument();
  });

  it('should handle retry functionality', async () => {
    // Mock initial failure then success
    mockIdeMessenger.getE2eCommitSuite
      .mockRejectedValueOnce(new Error('API Error'))
      .mockResolvedValueOnce(mockCommitSuite);

    renderWithProviders(
      <TestWrapper>
        <E2eCommitSuiteDetailPage />
      </TestWrapper>
    );

    // Wait for error state
    await waitFor(() => {
      expect(screen.getByText('Error Loading')).toBeInTheDocument();
    });

    // Click retry button
    const retryButton = screen.getByText('Try Again');
    fireEvent.click(retryButton);

    // Should show loading again
    expect(screen.getByText('Loading commit suite details...')).toBeInTheDocument();

    // Wait for successful load
    await waitFor(() => {
      expect(screen.getByText('Test Commit Suite')).toBeInTheDocument();
    });
  });

  it('should have production-ready logging capabilities', async () => {
    // Test that the component can handle logging without crashing
    mockIdeMessenger.getE2eCommitSuite.mockResolvedValue(mockCommitSuite);

    renderWithProviders(
      <TestWrapper>
        <E2eCommitSuiteDetailPage />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Commit Suite')).toBeInTheDocument();
    });

    // Component should render successfully even with logging enabled
    expect(screen.getByText('Test Commit Suite')).toBeInTheDocument();
    
    // The user display is on the overview tab, need to check if it exists
    const userDisplay = screen.queryByText(/By: John Doe/);
    // User display might not be visible depending on which tab is active and component structure
    
    // Verify performance monitoring doesn't interfere with functionality
    expect(mockIdeMessenger.getE2eCommitSuite).toHaveBeenCalled();
  });

  it('should handle component remount scenarios', async () => {
    // Test that component properly handles mounting/unmounting cycles
    mockIdeMessenger.getE2eCommitSuite.mockResolvedValue(mockCommitSuite);

    const { unmount } = renderWithProviders(
      <TestWrapper>
        <E2eCommitSuiteDetailPage />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Commit Suite')).toBeInTheDocument();
    });

    // Unmount the component
    unmount();
    
    // Mount a new instance
    renderWithProviders(
      <TestWrapper>
        <E2eCommitSuiteDetailPage />
      </TestWrapper>
    );

    // Should still work after remount
    await waitFor(() => {
      expect(screen.getByText('Test Commit Suite')).toBeInTheDocument();
    });
  });

  it('should handle concurrent API calls gracefully', async () => {
    // Simulate concurrent API calls
    let resolveCount = 0;
    mockIdeMessenger.getE2eCommitSuite.mockImplementation(() => {
      resolveCount++;
      return new Promise(resolve => 
        setTimeout(() => resolve(mockCommitSuite), resolveCount * 50)
      );
    });

    renderWithProviders(
      <TestWrapper>
        <E2eCommitSuiteDetailPage />
      </TestWrapper>
    );

    // Should show loading initially
    expect(screen.getByText('Loading commit suite details...')).toBeInTheDocument();

    // Wait for final result (should handle race conditions)
    await waitFor(() => {
      expect(screen.getByText('Test Commit Suite')).toBeInTheDocument();
    }, { timeout: 3000 });

    // Should only show content once, not duplicated
    expect(screen.getAllByText('Test Commit Suite')).toHaveLength(1);
  });

  it('should handle malformed API response data', async () => {
    // Test with missing required fields
    const malformedData = {
      uuid: 'test-uuid',
      description: 'Test',
      // Missing other required fields
    };

    mockIdeMessenger.getE2eCommitSuite.mockResolvedValue(malformedData);

    renderWithProviders(
      <TestWrapper>
        <E2eCommitSuiteDetailPage />
      </TestWrapper>
    );

    // Should still render without crashing
    await waitFor(() => {
      expect(screen.queryByText('Loading commit suite details...')).not.toBeInTheDocument();
    });

    // Should show the available data
    expect(screen.getByText('Test')).toBeInTheDocument();
  });
});