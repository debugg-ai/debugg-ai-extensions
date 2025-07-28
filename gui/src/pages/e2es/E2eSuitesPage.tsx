import {
    ArrowPathIcon,
    CalendarIcon,
    CheckCircleIcon,
    ClockIcon,
    ExclamationTriangleIcon,
    EyeIcon,
    FolderOpenIcon,
    PlayIcon,
    PlusIcon,
    UserIcon
} from "@heroicons/react/24/outline";
import type { E2eTestSuite } from "core/debuggAIServer/types";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PlatformOnboardingCard } from "../../components/OnboardingCard/platform/PlatformOnboardingCard";
import { useAuth } from "../../context/Auth";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useNavigationListener } from "../../hooks/useNavigationListener";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { fetchE2eSuites } from "../../redux/thunks/e2eSuitesThunks";

interface CreateSuiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { description: string; filePath?: string; repoName?: string; branchName?: string }) => Promise<void>;
  loading: boolean;
}

// Create Suite Modal Component
function CreateSuiteModal({ isOpen, onClose, onSubmit, loading }: CreateSuiteModalProps) {
  const [description, setDescription] = useState('');
  const [filePath, setFilePath] = useState('');
  const [repoName, setRepoName] = useState('');
  const [branchName, setBranchName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (description.trim()) {
      await onSubmit({
        description: description.trim(),
        filePath: filePath.trim() || undefined,
        repoName: repoName.trim() || undefined,
        branchName: branchName.trim() || undefined,
      });
      // Reset form
      setDescription('');
      setFilePath('');
      setRepoName('');
      setBranchName('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-vsc-editor-background border border-vsc-input-border rounded-sm w-full max-w-md">
        <div className="p-4 border-b border-vsc-panel-border">
          <h3 className="text-sm font-medium text-vsc-foreground">Create New E2E Suite</h3>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-vsc-foreground mb-1">
              Description *
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-2 py-1 text-xs bg-vsc-input-background border border-vsc-input-border rounded-sm text-vsc-input-foreground focus:outline-none focus:border-vsc-focusBorder"
              placeholder="Enter suite description..."
              required
            />
          </div>
          
          <div>
            <label className="block text-xs font-medium text-vsc-foreground mb-1">
              File Path
            </label>
            <input
              type="text"
              value={filePath}
              onChange={(e) => setFilePath(e.target.value)}
              className="w-full px-2 py-1 text-xs bg-vsc-input-background border border-vsc-input-border rounded-sm text-vsc-input-foreground focus:outline-none focus:border-vsc-focusBorder"
              placeholder="Optional file path..."
            />
          </div>
          
          <div>
            <label className="block text-xs font-medium text-vsc-foreground mb-1">
              Repository Name
            </label>
            <input
              type="text"
              value={repoName}
              onChange={(e) => setRepoName(e.target.value)}
              className="w-full px-2 py-1 text-xs bg-vsc-input-background border border-vsc-input-border rounded-sm text-vsc-input-foreground focus:outline-none focus:border-vsc-focusBorder"
              placeholder="Optional repo name..."
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
              className="w-full px-2 py-1 text-xs bg-vsc-input-background border border-vsc-input-border rounded-sm text-vsc-input-foreground focus:outline-none focus:border-vsc-focusBorder"
              placeholder="Optional branch name..."
            />
          </div>
          
          <div className="flex justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 text-xs font-medium text-vsc-button-secondaryForeground bg-vsc-button-secondaryBackground rounded-sm hover:bg-vsc-button-secondaryHoverBackground transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !description.trim()}
              className="px-3 py-1 text-xs font-medium text-vsc-button-foreground bg-vsc-button-background rounded-sm hover:bg-vsc-button-hoverBackground transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Loading State Component
function LoadingState() {
  return (
    <div className="p-4 text-center">
      <div className="text-xs text-vsc-descriptionForeground">Loading suites...</div>
    </div>
  );
}

// Empty State Component
function EmptyState({ onCreateSuite }: { onCreateSuite: () => void }) {
  return (
    <div className="p-4 text-center">
      <FolderOpenIcon className="h-8 w-8 text-vsc-descriptionForeground mx-auto mb-2" />
      <p className="text-xs text-vsc-descriptionForeground mb-3">No E2E suites found</p>
      <button
        onClick={onCreateSuite}
        className="flex items-center space-x-1 px-2 py-1 text-xs font-medium text-vsc-button-foreground bg-vsc-button-background rounded-sm hover:bg-vsc-button-hoverBackground transition-colors mx-auto"
      >
        <PlusIcon className="h-4 w-4" />
        <span>Create Suite</span>
      </button>
    </div>
  );
}

// Main component
function E2eSuitesPage() {
  useNavigationListener();
  const { session } = useAuth();
  const navigate = useNavigate();
  const ideMessenger = useContext(IdeMessengerContext);
  const dispatch = useAppDispatch();
  
  // Redux state
  const suites = useAppSelector((store) => store.e2eSuites.items);
  const loading = useAppSelector((store) => store.e2eSuites.loading);
  const error = useAppSelector((store) => store.e2eSuites.error);
  const currentFilters = useAppSelector((store) => store.e2eSuites.currentFilters);
  const currentPagination = useAppSelector((store) => store.e2eSuites.currentPagination);

  // Local state for UI controls
  const [refreshing, setRefreshing] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  // Refs for cleanup
  const mountedRef = useRef(true);

  // Fetch suites data
  const handleRefresh = useCallback(async () => {
    if (!mountedRef.current) return;

    try {
      setRefreshing(true);
      (dispatch as any)(fetchE2eSuites({
        filters: currentFilters,
        pagination: currentPagination,
        search: ""
      }));
    } catch (error) {
      console.error('Error refreshing suites:', error);
    } finally {
      if (mountedRef.current) {
        setRefreshing(false);
      }
    }
  }, [dispatch, currentFilters, currentPagination]);

  // Initial data fetch
  useEffect(() => {
    if (ideMessenger) {
      (dispatch as any)(fetchE2eSuites({
        filters: currentFilters,
        pagination: currentPagination,
        search: ""
      }));
    }
  }, [ideMessenger, dispatch, currentFilters, currentPagination]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

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

  const handleCreateSuite = useCallback(async (data: { description: string; filePath?: string; repoName?: string; branchName?: string }) => {
    if (!mountedRef.current || !ideMessenger) return;

    try {
      setCreateLoading(true);
      await ideMessenger.createE2eSuite(data.description, data.filePath, data.repoName, data.branchName);
      await handleRefresh();
    } catch (error) {
      console.error('Error creating suite:', error);
    } finally {
      if (mountedRef.current) {
        setCreateLoading(false);
      }
    }
  }, [ideMessenger, handleRefresh]);

  const handleRunSuite = useCallback(async (suite: E2eTestSuite) => {
    try {
      console.log('Running suite:', suite.uuid);
      if (ideMessenger) {
        await ideMessenger.runE2eSuite(suite.uuid);
      }
    } catch (error) {
      console.error('Error running suite:', error);
    }
  }, [ideMessenger]);

  const handleViewSuite = useCallback((suite: E2eTestSuite) => {
    navigate(`/e2e-runs?suiteId=${suite.uuid}`);
  }, [navigate]);

  if (!session?.account.id) {
    return (
      <div className="h-full bg-vsc-editor-background text-vsc-foreground">
        <div className="p-3">
          <div className="mb-3">
            <h1 className="text-sm font-medium text-vsc-foreground mb-1">E2E Suites</h1>
            <p className="text-xs text-vsc-descriptionForeground">Organized test collections</p>
          </div>
          
          <div className="bg-vsc-input-background border border-vsc-input-border rounded-sm p-3">
            <PlatformOnboardingCard isDialog={false} />
          </div>
        </div>
      </div>
    );
  }

  // Render loading state
  if (loading && suites.length === 0) {
    return (
      <div className="h-full bg-vsc-editor-background text-vsc-foreground flex flex-col">
        <div className="p-3 border-b border-vsc-panel-border">
          <h2 className="text-sm font-medium text-vsc-foreground">E2E Suites</h2>
          <p className="text-xs text-vsc-descriptionForeground">Organized test collections</p>
        </div>
        <LoadingState />
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="h-full bg-vsc-editor-background text-vsc-foreground flex flex-col">
        <div className="p-3 border-b border-vsc-panel-border">
          <h2 className="text-sm font-medium text-vsc-foreground">E2E Suites</h2>
          <p className="text-xs text-vsc-descriptionForeground">Organized test collections</p>
        </div>
        <div className="p-4 text-center text-vsc-errorForeground">Error: {error}</div>
      </div>
    );
  }

  // Render empty state
  if (suites.length === 0) {
    return (
      <div className="h-full bg-vsc-editor-background text-vsc-foreground flex flex-col">
        <div className="p-3 border-b border-vsc-panel-border">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-vsc-foreground">E2E Suites</h2>
              <p className="text-xs text-vsc-descriptionForeground">Organized test collections</p>
            </div>
            <button
              onClick={handleOpenModal}
              className="flex items-center space-x-1 px-2 py-1 text-xs font-medium text-vsc-button-foreground bg-vsc-button-background rounded-sm hover:bg-vsc-button-hoverBackground transition-colors"
            >
              <PlusIcon className="h-4 w-4" />
              <span>Create</span>
            </button>
          </div>
        </div>
        <EmptyState onCreateSuite={handleOpenModal} />
        <CreateSuiteModal
          isOpen={isCreateModalOpen}
          onClose={handleCloseModal}
          onSubmit={handleCreateSuite}
          loading={createLoading}
        />
      </div>
    );
  }

  return (
    <div className="h-full bg-vsc-editor-background text-vsc-foreground flex flex-col">
      {/* Compact Header */}
      <div className="p-3 border-b border-vsc-panel-border">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-vsc-foreground">E2E Suites</h2>
            <p className="text-xs text-vsc-descriptionForeground">Organized test collections</p>
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-1.5 text-vsc-tab-inactiveForeground hover:text-vsc-tab-activeForeground hover:bg-vsc-list-hoverBackground rounded-sm transition-colors disabled:opacity-50"
              title="Refresh suites"
            >
              <ArrowPathIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleOpenModal}
              className="flex items-center space-x-1 px-2 py-1 text-xs font-medium text-vsc-button-foreground bg-vsc-button-background rounded-sm hover:bg-vsc-button-hoverBackground transition-colors"
            >
              <PlusIcon className="h-4 w-4" />
              <span>Create</span>
            </button>
          </div>
        </div>
        {refreshing && (
          <div className="text-xs text-vsc-textLink-foreground mt-1">Refreshing...</div>
        )}
      </div>

      {/* Suites List - Optimized for narrow panel */}
      <div className="flex-1 overflow-auto">
        <div className="p-1 space-y-1">
          {suites.map((suite) => (
            <div
              key={suite.uuid}
              className="bg-vsc-list-inactiveSelectionBackground border border-vsc-panel-border rounded-sm p-2 hover:bg-vsc-list-hoverBackground transition-colors"
            >
              {/* Suite Description - Allow wrapping for better readability */}
              <div className="mb-2">
                <h3 className="text-xs font-medium text-vsc-foreground leading-tight break-words">
                  {suite.description}
                </h3>
              </div>

              {/* Suite ID and Status - Stacked for narrow layout */}
              <div className="space-y-1 mb-2">
                <div className="text-xs text-vsc-descriptionForeground">
                  ID: {suite.uuid.slice(0, 8)}
                </div>
                {suite.status && (
                  <div className="flex items-center">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${
                      suite.status === 'completed' 
                        ? 'bg-green-100 text-green-800' 
                        : suite.status === 'running'
                        ? 'bg-blue-100 text-blue-800'
                        : suite.status === 'failed'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {suite.status === 'completed' && <CheckCircleIcon className="w-3 h-3 mr-1" />}
                      {suite.status === 'running' && <ClockIcon className="w-3 h-3 mr-1" />}
                      {suite.status === 'failed' && <ExclamationTriangleIcon className="w-3 h-3 mr-1" />}
                      {suite.status}
                    </span>
                  </div>
                )}
              </div>

              {/* Suite Details - More compact layout */}
              <div className="space-y-0.5 text-xs text-vsc-descriptionForeground mb-2">
                {suite.created_at && (
                  <div className="flex items-center space-x-1">
                    <CalendarIcon className="w-3 h-3 flex-shrink-0" />
                    <span className="break-words">{new Date(suite.created_at).toLocaleDateString()}</span>
                  </div>
                )}
                {suite.created_by && (
                  <div className="flex items-center space-x-1">
                    <UserIcon className="w-3 h-3 flex-shrink-0" />
                    <span className="break-words truncate">By: {suite.created_by}</span>
                  </div>
                )}
              </div>

              {/* Actions - Full width for easier clicking */}
              <div className="flex items-center justify-between pt-1 border-t border-vsc-panel-border">
                <div className="text-xs text-vsc-descriptionForeground">
                  Actions:
                </div>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => handleViewSuite(suite)}
                    className="flex items-center space-x-1 px-2 py-1 text-xs text-vsc-tab-inactiveForeground hover:text-vsc-tab-activeForeground hover:bg-vsc-list-hoverBackground rounded-sm transition-colors"
                    title="View suite details"
                  >
                    <EyeIcon className="h-3 w-3" />
                    <span>View</span>
                  </button>
                  <button
                    onClick={() => handleRunSuite(suite)}
                    className="flex items-center space-x-1 px-2 py-1 text-xs text-vsc-tab-inactiveForeground hover:text-vsc-tab-activeForeground hover:bg-vsc-list-hoverBackground rounded-sm transition-colors"
                    title="Run suite"
                  >
                    <PlayIcon className="h-3 w-3" />
                    <span>Run</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create Suite Modal */}
      <CreateSuiteModal
        isOpen={isCreateModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleCreateSuite}
        loading={createLoading}
      />
    </div>
  );
}

export default E2eSuitesPage; 