import {
    ArrowPathIcon,
    CalendarIcon,
    CheckCircleIcon,
    ClockIcon,
    CodeBracketIcon,
    ExclamationTriangleIcon,
    EyeIcon,
    PlayIcon,
    PlusIcon,
    UserIcon
} from "@heroicons/react/24/outline";
import type { E2eTestCommitSuite } from "core/debuggAIServer/types";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IdeMessengerContext } from "../../context/IdeMessenger";

interface CreateCommitSuiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { description: string; commitHash?: string; branchName?: string; filePath?: string; repoName?: string }) => Promise<void>;
  loading: boolean;
}

function CreateCommitSuiteModal({ isOpen, onClose, onSubmit, loading }: CreateCommitSuiteModalProps) {
  const [description, setDescription] = useState("");
  const [commitHash, setCommitHash] = useState("");
  const [branchName, setBranchName] = useState("");
  const [filePath, setFilePath] = useState("");
  const [repoName, setRepoName] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;
    
    await onSubmit({
      description: description.trim(),
      commitHash: commitHash.trim() || undefined,
      branchName: branchName.trim() || undefined,
      filePath: filePath.trim() || undefined,
      repoName: repoName.trim() || undefined,
    });
    
    // Reset form
    setDescription("");
    setCommitHash("");
    setBranchName("");
    setFilePath("");
    setRepoName("");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-vsc-editor-background border border-vsc-panel-border rounded-sm max-w-md w-full max-h-[80vh] overflow-auto">
        <div className="p-4 border-b border-vsc-panel-border">
          <h2 className="text-sm font-medium text-vsc-foreground">Create Commit Suite</h2>
          <p className="text-xs text-vsc-descriptionForeground mt-1">Generate E2E tests based on commit changes</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-vsc-foreground mb-1">
              Description *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the changes in this commit that need testing..."
              className="w-full px-2 py-1.5 text-xs bg-vsc-input-background border border-vsc-input-border text-vsc-foreground rounded-sm focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none"
              rows={3}
              required
            />
          </div>
          
          <div>
            <label className="block text-xs font-medium text-vsc-foreground mb-1">
              Commit Hash
            </label>
            <input
              type="text"
              value={commitHash}
              onChange={(e) => setCommitHash(e.target.value)}
              placeholder="abc123def456..."
              className="w-full px-2 py-1.5 text-xs bg-vsc-input-background border border-vsc-input-border text-vsc-foreground rounded-sm focus:outline-none focus:ring-1 focus:ring-purple-500 font-mono"
            />
          </div>
          
          <div>
            <label className="block text-xs font-medium text-vsc-foreground mb-1">
              Branch Name
            </label>
            <input
              type="text"
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              placeholder="feature/new-feature"
              className="w-full px-2 py-1.5 text-xs bg-vsc-input-background border border-vsc-input-border text-vsc-foreground rounded-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>
          
          <div>
            <label className="block text-xs font-medium text-vsc-foreground mb-1">
              Changed File Path
            </label>
            <input
              type="text"
              value={filePath}
              onChange={(e) => setFilePath(e.target.value)}
              placeholder="/path/to/changed/file"
              className="w-full px-2 py-1.5 text-xs bg-vsc-input-background border border-vsc-input-border text-vsc-foreground rounded-sm focus:outline-none focus:ring-1 focus:ring-purple-500 font-mono"
            />
          </div>
          
          <div>
            <label className="block text-xs font-medium text-vsc-foreground mb-1">
              Repository
            </label>
            <input
              type="text"
              value={repoName}
              onChange={(e) => setRepoName(e.target.value)}
              placeholder="owner/repository-name"
              className="w-full px-2 py-1.5 text-xs bg-vsc-input-background border border-vsc-input-border text-vsc-foreground rounded-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>
          
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-3 py-1.5 text-xs font-medium text-vsc-button-secondaryForeground bg-vsc-button-secondaryBackground rounded-sm hover:bg-vsc-button-secondaryHoverBackground transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!description.trim() || loading}
              className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-purple-600 rounded-sm hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "Creating..." : "Create Commit Suite"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Status badge component
interface StatusBadgeProps {
  status: 'completed' | 'running' | 'pending' | 'failed';
}

function StatusBadge({ status }: StatusBadgeProps) {
  const config = {
    completed: { icon: CheckCircleIcon, bgColor: 'bg-vsc-testing-iconPassed', textColor: 'text-white', label: 'Completed' },
    running: { icon: ClockIcon, bgColor: 'bg-purple-600', textColor: 'text-white', label: 'Running' },
    pending: { icon: ExclamationTriangleIcon, bgColor: 'bg-vsc-testing-iconQueued', textColor: 'text-black', label: 'Pending' },
    failed: { icon: ExclamationTriangleIcon, bgColor: 'bg-vsc-testing-iconFailed', textColor: 'text-white', label: 'Failed' },
  };

  const { icon: Icon, bgColor, textColor, label } = config[status] || config.pending;

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-xs font-medium ${bgColor} ${textColor}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

// Loading state component
function LoadingState() {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="flex items-center gap-2">
        <div className="animate-spin rounded-full h-4 w-4 border-2 border-purple-600 border-t-transparent" role="progressbar"></div>
        <span className="text-xs text-vsc-descriptionForeground">Loading commit suites...</span>
      </div>
    </div>
  );
}

// Error state component
function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="text-center py-8">
      <ExclamationTriangleIcon className="h-8 w-8 text-vsc-notificationsErrorIcon-foreground mx-auto mb-2" />
      <h3 className="text-sm font-medium text-vsc-foreground mb-1">Error Loading</h3>
      <p className="text-xs text-vsc-descriptionForeground mb-3">Failed to load commit suites</p>
      <button
        onClick={onRetry}
        className="px-3 py-1.5 text-xs font-medium text-white bg-purple-600 rounded-sm hover:bg-purple-700 transition-colors"
      >
        Try Again
      </button>
    </div>
  );
}

// Empty state component
function EmptyState({ onCreateCommitSuite }: { onCreateCommitSuite: () => void }) {
  return (
    <div className="text-center py-8">
      <CodeBracketIcon className="h-8 w-8 text-vsc-descriptionForeground mx-auto mb-2" />
      <h3 className="text-sm font-medium text-vsc-foreground mb-1">No Commit Suites Found</h3>
      <p className="text-xs text-vsc-descriptionForeground mb-3">Generate test suites based on your commit changes</p>
      <button
        onClick={onCreateCommitSuite}
        className="px-3 py-1.5 text-xs font-medium text-white bg-purple-600 rounded-sm hover:bg-purple-700 transition-colors"
      >
        Create Your First Commit Suite
      </button>
    </div>
  );
}

// Main component
function E2eCommitSuites() {
  const navigate = useNavigate();
  const ideMessenger = useContext(IdeMessengerContext);
  
  // State management with default empty states
  const EMPTY_COMMIT_SUITES: E2eTestCommitSuite[] = [];
  const [commitSuites, setCommitSuites] = useState<E2eTestCommitSuite[]>(EMPTY_COMMIT_SUITES);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  // Refs for cleanup and request cancellation
  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  // Fetch commit suites data
  const fetchCommitSuites = useCallback(async (isRefresh = false) => {
    // Cancel any ongoing requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      if (!isRefresh) {
        setCommitSuites(EMPTY_COMMIT_SUITES);
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);

      // TODO: Replace with real API call when ideMessenger protocol is available
      // const result = await ideMessenger?.request('e2eCommitSuites/list', {}, { signal });
      
      // Mock API call with delay to simulate loading
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(resolve, 500);
        signal.addEventListener('abort', () => {
          clearTimeout(timeout);
          reject(new Error('Request cancelled'));
        });
      });

      // Check if component is still mounted and request wasn't cancelled
      if (mountedRef.current && !signal.aborted) {
        // Mock data - replace with real data when API is available
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
          }
        ];

        setCommitSuites(mockCommitSuites);
      }
    } catch (error) {
      if (mountedRef.current && !signal.aborted) {
        console.error('Error fetching commit suites:', error);
        setError('Failed to load commit suites');
        setCommitSuites(EMPTY_COMMIT_SUITES);
      }
    } finally {
      if (mountedRef.current && !signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [ideMessenger]);

  // Initial data fetch
  useEffect(() => {
    fetchCommitSuites();
    
    // Cleanup function
    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchCommitSuites]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    fetchCommitSuites(true);
  }, [fetchCommitSuites]);

  // Modal handlers
  const handleOpenModal = useCallback(() => {
    if (mountedRef.current) {
      setIsCreateModalOpen(true);
    }
  }, []);

  const handleCloseModal = useCallback(() => {
    if (mountedRef.current) {
      setIsCreateModalOpen(false);
    }
  }, []);

  // Handle commit suite creation
  const handleCreateCommitSuite = useCallback(async (data: { description: string; commitHash?: string; branchName?: string; filePath?: string; repoName?: string }) => {
    if (!mountedRef.current) return;

    // Cancel any ongoing requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      setCreateLoading(true);

      // TODO: Replace with real API call when ideMessenger protocol is available
      // const result = await ideMessenger?.request('e2eCommitSuites/create', data, { signal });
      
      // Mock API call with delay
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(resolve, 1500);
        signal.addEventListener('abort', () => {
          clearTimeout(timeout);
          reject(new Error('Request cancelled'));
        });
      });

      // Check if component is still mounted and request wasn't cancelled
      if (mountedRef.current && !signal.aborted) {
        setIsCreateModalOpen(false);
        handleRefresh(); // Refresh the list
      }
    } catch (error) {
      if (mountedRef.current && !signal.aborted) {
        console.error('Error creating commit suite:', error);
        // Handle error (could show toast notification)
      }
    } finally {
      if (mountedRef.current && !signal.aborted) {
        setCreateLoading(false);
      }
    }
  }, [handleRefresh, ideMessenger]);

  // Handle commit suite actions
  const handleViewCommitSuite = useCallback((suite: E2eTestCommitSuite) => {
    navigate(`/e2es/commit-suites/${suite.uuid}`);
  }, [navigate]);

  const handleRunCommitSuite = useCallback(async (suite: E2eTestCommitSuite) => {
    try {
      // Optimistic UI update
      setCommitSuites(prevSuites => 
        prevSuites.map(s => 
          s.uuid === suite.uuid 
            ? { ...s, runStatus: 'running' }
            : s
        )
      );

      // TODO: Replace with real API call
      // await ideMessenger?.request('e2eCommitSuites/run', { uuid: suite.uuid });
      
      console.log('Running commit suite:', suite.description);
    } catch (error) {
      console.error('Error running commit suite:', error);
      // Revert optimistic update on error
      setCommitSuites(prevSuites => 
        prevSuites.map(s => 
          s.uuid === suite.uuid 
            ? { ...s, runStatus: 'completed' }
            : s
        )
      );
    }
  }, [ideMessenger]);

  // Render loading state
  if (loading) {
    return <LoadingState />;
  }

  // Render error state
  if (error) {
    return <ErrorState onRetry={() => fetchCommitSuites()} />;
  }

  // Render empty state
  if (commitSuites.length === 0) {
    return <EmptyState onCreateCommitSuite={handleOpenModal} />;
  }

  return (
    <div className="h-full bg-vsc-editor-background text-vsc-foreground flex flex-col">
      {/* Compact Header */}
      <div className="p-2 border-b border-vsc-panel-border">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-vsc-foreground">Commit Suites</h2>
            <p className="text-xs text-vsc-descriptionForeground">Tests for commit changes</p>
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-1.5 text-vsc-tab-inactiveForeground hover:text-vsc-tab-activeForeground hover:bg-vsc-list-hoverBackground rounded-sm transition-colors disabled:opacity-50"
              title="Refresh commit suites"
            >
              <ArrowPathIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleOpenModal}
              className="flex items-center space-x-1 px-2 py-1 text-xs font-medium text-white bg-purple-600 rounded-sm hover:bg-purple-700 transition-colors"
            >
              <PlusIcon className="h-4 w-4" />
              <span>Create</span>
            </button>
          </div>
        </div>
        {refreshing && (
          <div className="text-xs text-purple-400 mt-1">Refreshing...</div>
        )}
      </div>

      {/* Commit suites list */}
      <div className="p-2 space-y-2">
        {commitSuites.map((suite) => (
          <div
            key={suite.uuid}
            className="bg-vsc-input-background border border-vsc-input-border rounded-sm p-2 hover:bg-vsc-list-hoverBackground transition-colors"
          >
            <div className="flex items-start justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <h3 className="text-xs font-medium text-vsc-foreground leading-tight">
                  {suite.projectName || `Project ${suite.project}`}
                </h3>
                <span className="px-1.5 py-0.5 bg-purple-600 text-white text-xs font-mono rounded-sm">
                  {suite.commitHashShort}
                </span>
              </div>
              <StatusBadge status={suite.runStatus as any} />
            </div>
            
            <p className="text-xs text-vsc-descriptionForeground mb-2 leading-tight">
              {suite.description || "No description provided"}
            </p>
            
            {suite.summarizedChanges && (
              <p className="text-xs text-vsc-descriptionForeground mb-2 leading-tight">
                <span className="font-medium">Changes:</span> {suite.summarizedChanges}
              </p>
            )}
            
            <div className="flex items-center justify-between text-xs text-vsc-descriptionForeground">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5">
                  <UserIcon className="h-3 w-3" />
                  <span>{suite.createdBy?.firstName} {suite.createdBy?.lastName}</span>
                </div>
                <div className="flex items-center gap-0.5">
                  <CalendarIcon className="h-3 w-3" />
                  <span>{new Date(suite.timestamp || Date.now()).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="text-xs text-vsc-foreground">
                {suite.tests?.length || 0} tests
              </div>
            </div>

            <div className="flex gap-1 mt-2">
              <button
                onClick={() => handleViewCommitSuite(suite)}
                className="flex items-center gap-1 px-2 py-1 text-xs text-vsc-foreground hover:text-vsc-foreground hover:bg-vsc-button-secondaryBackground rounded-sm transition-colors"
                title="View Details"
              >
                <EyeIcon className="h-3 w-3" />
                View
              </button>
              {suite.runStatus === 'completed' && (
                <button
                  onClick={() => handleRunCommitSuite(suite)}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-purple-400 hover:text-purple-300 hover:bg-vsc-button-secondaryBackground rounded-sm transition-colors"
                  title="Run Commit Suite"
                >
                  <PlayIcon className="h-3 w-3" />
                  Run
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Create Commit Suite Modal */}
      <CreateCommitSuiteModal
        isOpen={isCreateModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleCreateCommitSuite}
        loading={createLoading}
      />
    </div>
  );
}

export default E2eCommitSuites; 