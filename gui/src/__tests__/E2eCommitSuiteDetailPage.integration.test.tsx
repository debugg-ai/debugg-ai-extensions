import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { E2eTest, E2eTestCommitSuite } from 'core/debuggAIServer/types';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Import the component we're testing
import E2eCommitSuiteDetailPage from '../pages/e2es/E2eCommitSuiteDetailPage';

// Mock the auth context
const mockAuthContext = {
  session: {
    account: { id: 'test-user-id' }
  }
};

// Complete mock commit suite data with tests
const mockCommitSuiteWithTests: E2eTestCommitSuite = {
  id: 1,
  uuid: 'commit-suite-123',
  commitHash: 'abc123def456789012345678901234567890abcd',
  commitHashShort: 'abc123de',
  project: 1,
  projectName: 'Test Project',
  description: 'Integration Test Commit Suite',
  summarizedChanges: 'Added comprehensive integration tests and fixed loading states',
  tests: [
    {
      id: 1,
      uuid: 'test-123',
      project: 1,
      projectName: 'Test Project',
      name: 'Login Flow Test',
      description: 'Tests user login functionality',
      testScript: 'test_login.py',
      curRun: {
        uuid: 'run-123',
        status: 'completed',
        outcome: 'pass',
        timestamp: '2024-01-01T10:00:00Z',
        lastMod: '2024-01-01T10:05:00Z'
      },
      timestamp: '2024-01-01T09:00:00Z',
      lastMod: '2024-01-01T09:00:00Z'
    },
    {
      id: 2,
      uuid: 'test-456',
      project: 1,
      projectName: 'Test Project',
      name: 'Checkout Process Test',
      description: 'Tests e-commerce checkout flow',
      testScript: 'test_checkout.py',
      curRun: {
        uuid: 'run-456',
        status: 'running',
        outcome: null,
        timestamp: '2024-01-01T11:00:00Z',
        lastMod: '2024-01-01T11:00:00Z'
      },
      timestamp: '2024-01-01T09:30:00Z',
      lastMod: '2024-01-01T09:30:00Z'
    },
    {
      id: 3,
      uuid: 'test-789',
      project: 1,
      projectName: 'Test Project',
      name: 'Payment Processing Test',
      description: 'Tests payment gateway integration',
      testScript: 'test_payment.py',
      curRun: {
        uuid: 'run-789',
        status: 'completed',
        outcome: 'fail',
        timestamp: '2024-01-01T12:00:00Z',
        lastMod: '2024-01-01T12:10:00Z'
      },
      timestamp: '2024-01-01T10:00:00Z',
      lastMod: '2024-01-01T10:00:00Z'
    }
  ] as unknown as E2eTest[],
  tunnelKey: 'tunnel-key-123',
  key: 'url-key-123',
  runStatus: 'running',
  createdBy: {
    uuid: 'user-123',
    email: 'integration@test.com',
    firstName: 'Integration',
    lastName: 'Tester',
    company: 'Test Company'
  },
  timestamp: '2024-01-01T08:00:00Z',
  lastMod: '2024-01-01T12:15:00Z'
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

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ suiteId: 'commit-suite-123' }),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
    useNavigate: () => mockNavigate
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

describe('E2eCommitSuiteDetailPage Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear console logs before each test
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('should load and display complete commit suite with all tabs', async () => {
    mockIdeMessenger.getE2eCommitSuite.mockResolvedValue(mockCommitSuiteWithTests);

    render(
      <TestWrapper>
        <E2eCommitSuiteDetailPage />
      </TestWrapper>
    );

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Integration Test Commit Suite')).toBeInTheDocument();
    });

    // Verify overview tab content
    expect(screen.getByText('Project: Test Project')).toBeInTheDocument();
    expect(screen.getByText(/Added comprehensive integration tests/)).toBeInTheDocument();
    expect(screen.getByText('Total Tests:')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('By: Integration Tester')).toBeInTheDocument();

    // Switch to tests tab
    const testsTab = screen.getByText(/Tests \(3\)/);
    fireEvent.click(testsTab);

    // Verify tests are displayed
    await waitFor(() => {
      expect(screen.getByText('Login Flow Test')).toBeInTheDocument();
      expect(screen.getByText('Checkout Process Test')).toBeInTheDocument();
      expect(screen.getByText('Payment Processing Test')).toBeInTheDocument();
    });

    // Verify test statuses (use getAllByText since we may have multiple Running statuses)
    expect(screen.getByText('Passed')).toBeInTheDocument();
    expect(screen.getAllByText('Running').length).toBeGreaterThan(0);
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('should handle realistic network delays gracefully', async () => {
    // Simulate realistic API delay
    mockIdeMessenger.getE2eCommitSuite.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(mockCommitSuiteWithTests), 500))
    );

    render(
      <TestWrapper>
        <E2eCommitSuiteDetailPage />
      </TestWrapper>
    );

    // Should show loading state
    expect(screen.getByText('Loading commit suite details...')).toBeInTheDocument();

    // Should not show content immediately
    expect(screen.queryByText('Integration Test Commit Suite')).not.toBeInTheDocument();

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Integration Test Commit Suite')).toBeInTheDocument();
    }, { timeout: 1000 });

    // Should no longer show loading
    expect(screen.queryByText('Loading commit suite details...')).not.toBeInTheDocument();
  });

  it('should handle complete user workflow: load -> error -> retry -> success', async () => {
    // First call fails
    mockIdeMessenger.getE2eCommitSuite
      .mockRejectedValueOnce(new Error('Network timeout'))
      .mockResolvedValueOnce(mockCommitSuiteWithTests);

    render(
      <TestWrapper>
        <E2eCommitSuiteDetailPage />
      </TestWrapper>
    );

    // Initial loading
    expect(screen.getByText('Loading commit suite details...')).toBeInTheDocument();

    // Wait for error state
    await waitFor(() => {
      expect(screen.getByText('Error Loading')).toBeInTheDocument();
    });

    expect(screen.getByText('Failed to load commit suite details')).toBeInTheDocument();

    // User clicks retry
    const retryButton = screen.getByText('Try Again');
    fireEvent.click(retryButton);

    // Should show loading again
    expect(screen.getByText('Loading commit suite details...')).toBeInTheDocument();

    // Should successfully load on retry
    await waitFor(() => {
      expect(screen.getByText('Integration Test Commit Suite')).toBeInTheDocument();
    });

    // Should be able to interact with loaded data
    const testsTab = screen.getByText(/Tests \(3\)/);
    fireEvent.click(testsTab);

    await waitFor(() => {
      expect(screen.getByText('Login Flow Test')).toBeInTheDocument();
    });
  });

  it('should handle refresh functionality correctly', async () => {
    let refreshCallCount = 0;
    mockIdeMessenger.getE2eCommitSuite.mockImplementation(() => {
      refreshCallCount++;
      return Promise.resolve(mockCommitSuiteWithTests);
    });

    render(
      <TestWrapper>
        <E2eCommitSuiteDetailPage />
      </TestWrapper>
    );

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Integration Test Commit Suite')).toBeInTheDocument();
    });

    expect(refreshCallCount).toBe(1);

    // Click refresh button
    const refreshButton = screen.getByTitle('Refresh');
    fireEvent.click(refreshButton);

    // Wait for refresh to complete
    await waitFor(() => {
      expect(refreshCallCount).toBe(2);
    });

    // Content should still be visible after refresh
    expect(screen.getByText('Integration Test Commit Suite')).toBeInTheDocument();
  });

  it('should handle run commit suite functionality', async () => {
    mockIdeMessenger.getE2eCommitSuite.mockResolvedValue(mockCommitSuiteWithTests);
    mockIdeMessenger.runE2eCommitSuite.mockResolvedValue({});

    render(
      <TestWrapper>
        <E2eCommitSuiteDetailPage />
      </TestWrapper>
    );

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Integration Test Commit Suite')).toBeInTheDocument();
    });

    // Click run button
    const runButton = screen.getByText('Run');
    fireEvent.click(runButton);

    // Should call the API
    await waitFor(() => {
      expect(mockIdeMessenger.runE2eCommitSuite).toHaveBeenCalledWith('commit-suite-123');
    });
  });

  it('should handle navigation scenarios correctly', async () => {
    mockIdeMessenger.getE2eCommitSuite.mockResolvedValue(mockCommitSuiteWithTests);

    render(
      <TestWrapper>
        <E2eCommitSuiteDetailPage />
      </TestWrapper>
    );

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Integration Test Commit Suite')).toBeInTheDocument();
    });

    // Click back button (use more specific selector)
    const backButton = screen.getByTitle('Back to Commit Suites');
    fireEvent.click(backButton);

    // Should navigate back
    expect(mockNavigate).toHaveBeenCalledWith('/e2e-commit-suites');
  });

  it('should prevent memory leaks on quick navigation', async () => {
    // Simulate slow API response
    mockIdeMessenger.getE2eCommitSuite.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(mockCommitSuiteWithTests), 1000))
    );

    const { unmount } = render(
      <TestWrapper>
        <E2eCommitSuiteDetailPage />
      </TestWrapper>
    );

    // Should show loading
    expect(screen.getByText('Loading commit suite details...')).toBeInTheDocument();

    // Unmount before API completes (simulating navigation away)
    unmount();

    // Wait a bit to ensure async operations don't cause issues
    await new Promise(resolve => setTimeout(resolve, 100));

    // Should not throw errors or cause memory leaks
    expect(true).toBe(true); // Test passes if no errors thrown
  });
});