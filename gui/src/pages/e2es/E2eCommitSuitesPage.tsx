import {
  ArrowPathIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  CodeBracketIcon,
  EyeIcon,
  PlayIcon,
  PlusIcon,
  UserIcon
} from "@heroicons/react/24/outline";
import type { E2eTestCommitSuite } from "core/debuggAIServer/types";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Pagination } from "../../components/Pagination";
import type { PaginationInfo } from "../../components/Pagination";
import { PlatformOnboardingCard } from "../../components/OnboardingCard/platform/PlatformOnboardingCard";
import { useAuth } from "../../context/Auth";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useNavigationListener } from "../../hooks/useNavigationListener";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { setCurrentPagination } from "../../redux/slices/e2eCommitSuitesSlice";
import { createE2eCommitSuiteWithIdeInput, fetchE2eCommitSuites, runE2eCommitSuite } from "../../redux/thunks/e2eCommitSuitesThunks";
import { formatUserWithPrefix } from "../../util/userDisplay";


// Loading State Component
function LoadingState() {
  return (
    <div className="p-4 text-center">
      <div className="text-xs text-vsc-descriptionForeground">Loading commit suites...</div>
    </div>
  );
}

// Empty State Component
function EmptyState({ onCreateCommitSuite }: { onCreateCommitSuite: () => void }) {
  return (
    <div className="p-4 text-center">
      <CodeBracketIcon className="h-8 w-8 text-vsc-descriptionForeground mx-auto mb-2" />
      <p className="text-xs text-vsc-descriptionForeground mb-3">No E2E commit suites found</p>
      <button
        onClick={onCreateCommitSuite}
        className="flex items-center space-x-1 px-2 py-1 text-xs font-medium text-vsc-button-foreground bg-vsc-button-background rounded-sm hover:bg-vsc-button-hoverBackground transition-colors mx-auto"
      >
        <PlusIcon className="h-4 w-4" />
        <span>Create Commit Suite</span>
      </button>
    </div>
  );
}

// Main component
function E2eCommitSuitesPage() {
  useNavigationListener();
  const { session } = useAuth();
  const navigate = useNavigate();
  const ideMessenger = useContext(IdeMessengerContext);
  const dispatch = useAppDispatch();
  
  // Redux state
  const commitSuites = useAppSelector((store) => store.e2eCommitSuites.items);
  const commitSuitesList = useAppSelector((store) => store.e2eCommitSuites.commitSuitesList);
  const loading = useAppSelector((store) => store.e2eCommitSuites.loading);
  const error = useAppSelector((store) => store.e2eCommitSuites.error);
  const currentFilters = useAppSelector((store) => store.e2eCommitSuites.currentFilters);
  const currentPagination = useAppSelector((store) => store.e2eCommitSuites.currentPagination);

  // Local state for UI controls
  const [refreshing, setRefreshing] = useState(false);

  // Refs for cleanup
  const mountedRef = useRef(true);

  // Fetch commit suites data
  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      (dispatch as any)(fetchE2eCommitSuites({
        filters: currentFilters,
        pagination: currentPagination,
        search: ""
      }));
    } catch (error) {
      console.error('Error refreshing commit suites:', error);
    } finally {
      if (mountedRef.current) {
        setRefreshing(false);
      }
    }
  }, [dispatch, currentFilters, currentPagination]);

  // Initial data fetch
  useEffect(() => {
    if (ideMessenger) {
      (dispatch as any)(fetchE2eCommitSuites({
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

  // Create commit suite handler - delegates to IDE
  const handleCreateCommitSuite = useCallback(async () => {
    if (!mountedRef.current) return;

    try {
      await dispatch(createE2eCommitSuiteWithIdeInput()).unwrap();
      // Refresh the list after creation
      await handleRefresh();
    } catch (error) {
      console.error('Error creating commit suite:', error);
    }
  }, [dispatch, handleRefresh]);

  const handleRunCommitSuite = useCallback(async (suite: E2eTestCommitSuite) => {
    try {
      console.log('Running commit suite:', suite.uuid);
      await dispatch(runE2eCommitSuite(suite.uuid)).unwrap();
    } catch (error) {
      console.error('Error running commit suite:', error);
    }
  }, [dispatch]);

  const handleViewCommitSuite = useCallback((suite: E2eTestCommitSuite) => {
    navigate(`/e2e-commit-suites/${suite.uuid}`);
  }, [navigate]);

  // Pagination handlers
  const handlePageChange = useCallback((page: number) => {
    const newPagination = { ...currentPagination, page };
    dispatch(setCurrentPagination(newPagination));
  }, [dispatch, currentPagination]);

  const handlePageSizeChange = useCallback((pageSize: number) => {
    const newPagination = { page: 1, pageSize }; // Reset to first page when changing page size
    dispatch(setCurrentPagination(newPagination));
  }, [dispatch]);

  if (!session?.account.id) {
    return (
      <div className="h-full bg-vsc-editor-background text-vsc-foreground">
        <div className="p-3">
          <div className="mb-3">
            <h1 className="text-sm font-medium text-vsc-foreground mb-1">E2E Commit Suites</h1>
            <p className="text-xs text-vsc-descriptionForeground">Tests for commit changes</p>
          </div>
          
          <div className="bg-vsc-input-background border border-vsc-input-border rounded-sm p-3">
            <PlatformOnboardingCard isDialog={false} />
          </div>
        </div>
      </div>
    );
  }

  // Render loading state
  if (loading && commitSuites.length === 0) {
    return (
      <div className="h-full bg-vsc-editor-background text-vsc-foreground flex flex-col">
        <div className="p-3 border-b border-vsc-panel-border">
          <h2 className="text-sm font-medium text-vsc-foreground">E2E Commit Suites</h2>
          <p className="text-xs text-vsc-descriptionForeground">Tests for commit changes</p>
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
          <h2 className="text-sm font-medium text-vsc-foreground">E2E Commit Suites</h2>
          <p className="text-xs text-vsc-descriptionForeground">Tests for commit changes</p>
        </div>
        <div className="p-4 text-center text-vsc-errorForeground">Error: {error}</div>
      </div>
    );
  }

  // Render empty state
  if (commitSuites.length === 0) {
    return (
      <div className="h-full bg-vsc-editor-background text-vsc-foreground flex flex-col">
        <div className="p-3 border-b border-vsc-panel-border">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-vsc-foreground">E2E Commit Suites</h2>
              <p className="text-xs text-vsc-descriptionForeground">Tests for commit changes</p>
            </div>
            <button
              onClick={handleCreateCommitSuite}
              className="flex items-center space-x-1 px-2 py-1 text-xs font-medium text-vsc-button-foreground bg-vsc-button-background rounded-sm hover:bg-vsc-button-hoverBackground transition-colors"
            >
              <PlusIcon className="h-4 w-4" />
              <span>Create</span>
            </button>
          </div>
        </div>
        <EmptyState onCreateCommitSuite={handleCreateCommitSuite} />
      </div>
    );
  }

  return (
    <div className="h-full bg-vsc-editor-background text-vsc-foreground flex flex-col">
      {/* Compact Header */}
      <div className="p-3 border-b border-vsc-panel-border">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-vsc-foreground">E2E Commit Suites</h2>
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
              onClick={handleCreateCommitSuite}
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

      {/* Commit Suites List - Optimized for narrow panel */}
      <div className="flex-1 overflow-auto">
        <div className="p-1 space-y-1">
          {commitSuites.map((suite) => (
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
                                {suite.runStatus && (
                  <div className="flex items-center">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${
                      suite.runStatus === 'completed'
                        ? 'bg-green-100 text-green-800'
                        : suite.runStatus === 'running'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {suite.runStatus === 'completed' && <CheckCircleIcon className="w-3 h-3 mr-1" />}
                      {suite.runStatus === 'running' && <ClockIcon className="w-3 h-3 mr-1" />}
                      {suite.runStatus === 'pending' && <ClockIcon className="w-3 h-3 mr-1" />}
                      {suite.runStatus}
                    </span>
                  </div>
                )}
              </div>

              {/* Suite Details - More compact layout */}
              <div className="space-y-0.5 text-xs text-vsc-descriptionForeground mb-2">
                {suite.commitHash && (
                  <div className="flex items-center space-x-1">
                    <CodeBracketIcon className="w-3 h-3 flex-shrink-0" />
                    <span className="break-words">Commit: {suite.commitHash.slice(0, 8)}</span>
                  </div>
                )}
                {suite.timestamp && (
                  <div className="flex items-center space-x-1">
                    <CalendarIcon className="w-3 h-3 flex-shrink-0" />
                    <span className="break-words">{new Date(suite.timestamp).toLocaleDateString()}</span>
                  </div>
                )}
                {suite.createdBy && (
                  <div className="flex items-center space-x-1">
                    <UserIcon className="w-3 h-3 flex-shrink-0" />
                    <span className="break-words truncate">
                      {formatUserWithPrefix(suite.createdBy)}
                    </span>
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
                    onClick={() => handleViewCommitSuite(suite)}
                    className="flex items-center space-x-1 px-2 py-1 text-xs text-vsc-tab-inactiveForeground hover:text-vsc-tab-activeForeground hover:bg-vsc-list-hoverBackground rounded-sm transition-colors"
                    title="View commit suite details"
                  >
                    <EyeIcon className="h-3 w-3" />
                    <span>View</span>
                  </button>
                  <button
                    onClick={() => handleRunCommitSuite(suite)}
                    className="flex items-center space-x-1 px-2 py-1 text-xs text-vsc-tab-inactiveForeground hover:text-vsc-tab-activeForeground hover:bg-vsc-list-hoverBackground rounded-sm transition-colors"
                    title="Run commit suite"
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

      {/* Pagination */}
      {commitSuites.length > 0 && commitSuitesList && (
        <Pagination
          pagination={{
            page: currentPagination.page,
            pageSize: currentPagination.pageSize,
            total: commitSuitesList.count || 0,
            hasNext: commitSuitesList.next !== null,
            hasPrevious: commitSuitesList.previous !== null,
          }}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          compact={true}
          showPageInfo={true}
          showPageSizeSelector={true}
        />
      )}

    </div>
  );
}

export default E2eCommitSuitesPage; 