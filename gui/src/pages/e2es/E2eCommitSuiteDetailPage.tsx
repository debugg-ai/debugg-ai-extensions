import {
    ArrowLeftIcon,
    ArrowPathIcon,
    CalendarIcon,
    CheckCircleIcon,
    ClockIcon,
    CodeBracketIcon,
    DocumentTextIcon,
    ExclamationTriangleIcon,
    EyeIcon,
    PlayIcon,
    UserIcon,
    XCircleIcon
} from "@heroicons/react/24/outline";
import type { E2eTest, E2eTestCommitSuite } from "core/debuggAIServer/types";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import E2eCommitSuiteErrorBoundary from "../../components/ErrorBoundary/E2eCommitSuiteErrorBoundary";
import { PlatformOnboardingCard } from "../../components/OnboardingCard/platform/PlatformOnboardingCard";
import { useAuth } from "../../context/Auth";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useNavigationListener } from "../../hooks/useNavigationListener";
import { formatUserWithPrefix } from "../../util/userDisplay";
import { e2eCommitSuiteLogger, performanceMonitor } from "../../util/logging";

// Status badge component for commit suites
interface StatusBadgeProps {
  status: string;
}

function StatusBadge({ status }: StatusBadgeProps) {
  const statusConfig = {
    running: { icon: ClockIcon, bgColor: 'bg-blue-100', textColor: 'text-blue-800', label: 'Running' },
    pending: { icon: ClockIcon, bgColor: 'bg-gray-100', textColor: 'text-gray-800', label: 'Pending' },
    completed: { icon: CheckCircleIcon, bgColor: 'bg-green-100', textColor: 'text-green-800', label: 'Completed' },
    cancelled: { icon: XCircleIcon, bgColor: 'bg-gray-100', textColor: 'text-gray-800', label: 'Cancelled' },
    failed: { icon: ExclamationTriangleIcon, bgColor: 'bg-red-100', textColor: 'text-red-800', label: 'Failed' },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
  const { icon: Icon, bgColor, textColor, label } = config;

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium ${bgColor} ${textColor}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

// Test status badge for individual tests
function TestStatusBadge({ test }: { test: E2eTest }) {
  const status = test.curRun?.status || 'pending';
  const outcome = test.curRun?.outcome;

  if (status === 'completed') {
    if (outcome === 'pass') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-xs font-medium bg-green-100 text-green-800">
          <CheckCircleIcon className="h-3 w-3" />
          Passed
        </span>
      );
    } else if (outcome === 'fail') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-xs font-medium bg-red-100 text-red-800">
          <XCircleIcon className="h-3 w-3" />
          Failed
        </span>
      );
    }
  }

  const statusConfig = {
    running: { icon: ClockIcon, bgColor: 'bg-blue-100', textColor: 'text-blue-800', label: 'Running' },
    pending: { icon: ClockIcon, bgColor: 'bg-gray-100', textColor: 'text-gray-800', label: 'Pending' },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
  const { icon: Icon, bgColor, textColor, label } = config;

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
        <div className="animate-spin rounded-full h-4 w-4 border-2 border-vsc-button-background border-t-transparent" role="progressbar"></div>
        <span className="text-xs text-vsc-descriptionForeground">Loading commit suite details...</span>
      </div>
    </div>
  );
}

// Error state component
function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="text-center py-8">
      <ExclamationTriangleIcon className="h-8 w-8 text-vsc-errorForeground mx-auto mb-2" />
      <h3 className="text-sm font-medium text-vsc-foreground mb-1">Error Loading</h3>
      <p className="text-xs text-vsc-descriptionForeground mb-3">Failed to load commit suite details</p>
      <button
        onClick={onRetry}
        className="px-3 py-1.5 text-xs font-medium text-vsc-button-foreground bg-vsc-button-background rounded-sm hover:bg-vsc-button-hoverBackground transition-colors"
      >
        Try Again
      </button>
    </div>
  );
}

// Not found state component
function NotFoundState() {
  return (
    <div className="text-center py-8">
      <DocumentTextIcon className="h-8 w-8 text-vsc-descriptionForeground mx-auto mb-2" />
      <h3 className="text-sm font-medium text-vsc-foreground mb-1">Commit Suite Not Found</h3>
      <p className="text-xs text-vsc-descriptionForeground">The requested commit suite could not be found</p>
    </div>
  );
}

function E2eCommitSuiteDetailPage() {
  useNavigationListener();
  const { session } = useAuth();
  const navigate = useNavigate();
  const { suiteId } = useParams<{ suiteId: string }>();
  const [searchParams] = useSearchParams();
  const commitSuiteId = suiteId || searchParams.get('commitSuiteId');
  const ideMessenger = useContext(IdeMessengerContext);

  // Production-ready logging helper
  const log = useCallback((message: string, data?: any) => {
    e2eCommitSuiteLogger.debug(message, { data });
  }, []);

  // State
  const [commitSuite, setCommitSuite] = useState<E2eTestCommitSuite | null>(null);
  const [loading, setLoading] = useState(true); // Start with loading true
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'tests'>('overview');

  // Log initial state
  useEffect(() => {
    log('Component initialized', {
      commitSuiteId,
      hasIdeMessenger: !!ideMessenger,
      hasSession: !!session?.account.id,
      initialStates: { loading, error, commitSuite: !!commitSuite }
    });
  }, [commitSuiteId, ideMessenger, session, loading, error, commitSuite, log]);

  // Refs for cleanup
  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  // Immediate fetch when component has all required data
  useEffect(() => {
    let isCancelled = false;
    
    log('useEffect triggered', { commitSuiteId, hasIdeMessenger: !!ideMessenger });
    
    const performFetch = async () => {
      log('performFetch started', { 
        commitSuiteId, 
        hasIdeMessenger: !!ideMessenger,
        isCancelled,
        mountedRef: mountedRef.current 
      });

      if (!commitSuiteId) {
        log('No commitSuiteId provided, setting error state');
        if (!isCancelled && mountedRef.current) {
          setLoading(false);
          setError("No commit suite ID provided");
          log('State updated: loading=false, error set');
        }
        return;
      }

      if (!ideMessenger) {
        log('No ideMessenger available, setting error state');
        if (!isCancelled && mountedRef.current) {
          setLoading(false);
          setError("IDE messenger not available");
          log('State updated: loading=false, error set');
        }
        return;
      }

      log('Starting API fetch', { commitSuiteId });
      performanceMonitor.start('fetchCommitSuite');

      try {
        if (!isCancelled && mountedRef.current) {
          log('Setting loading state to true');
          setLoading(true);
          setError(null);
          setCommitSuite(null);
        }

        log('Calling ideMessenger.getE2eCommitSuite');
        const commitSuiteData = await ideMessenger.getE2eCommitSuite(commitSuiteId);
        performanceMonitor.end('fetchCommitSuite', e2eCommitSuiteLogger);
        log('API response received', { 
          hasData: !!commitSuiteData,
          dataType: typeof commitSuiteData,
          dataKeys: commitSuiteData ? Object.keys(commitSuiteData) : [],
          testsLength: commitSuiteData?.tests?.length
        });

        if (!isCancelled && mountedRef.current) {
          log('Processing API response', { isCancelled, mounted: mountedRef.current });
          
          if (commitSuiteData) {
            const processedData = {
              ...commitSuiteData,
              tests: commitSuiteData.tests || []
            };
            log('Setting commit suite data and clearing loading', { 
              processedDataKeys: Object.keys(processedData),
              testsCount: processedData.tests.length
            });
            setCommitSuite(processedData);
            setLoading(false);
            log('State updated: commitSuite set, loading=false');
          } else {
            log('No data in response, setting error');
            setError("No data found");
            setLoading(false);
            log('State updated: error set, loading=false');
          }
        } else {
          log('Skipping state update - cancelled or unmounted', { isCancelled, mounted: mountedRef.current });
        }
      } catch (error) {
        log('API call failed', { error: error?.toString() });
        if (!isCancelled && mountedRef.current) {
          setError('Failed to load commit suite details');
          setLoading(false);
          log('State updated: error set, loading=false');
        }
      }
    };

    performFetch();

    return () => {
      log('useEffect cleanup', { commitSuiteId });
      isCancelled = true;
    };
  }, [commitSuiteId, ideMessenger, log]);

  // Simple refresh function
  const fetchCommitSuite = useCallback(async (isRefresh = false) => {
    if (!commitSuiteId || !ideMessenger) return;
    
    log('fetchCommitSuite called', { isRefresh, commitSuiteId });
    
    try {
      if (isRefresh) {
        log('Setting refreshing state');
        setRefreshing(true);
      } else {
        log('Setting loading state for retry');
        setLoading(true);
      }
      setError(null);
      setCommitSuite(null);

      log('Calling API in fetchCommitSuite');
      const commitSuiteData = await ideMessenger.getE2eCommitSuite(commitSuiteId);
      log('fetchCommitSuite API response', { 
        hasData: !!commitSuiteData,
        dataKeys: commitSuiteData ? Object.keys(commitSuiteData) : []
      });
      
      if (mountedRef.current) {
        if (commitSuiteData) {
          const processedData = {
            ...commitSuiteData,
            tests: commitSuiteData.tests || []
          };
          log('fetchCommitSuite setting data and clearing loading');
          setCommitSuite(processedData);
          setLoading(false);
        } else {
          log('fetchCommitSuite no data, setting error');
          setError('No data found');
          setLoading(false);
        }
      }
    } catch (error) {
      log('fetchCommitSuite error', { error: error?.toString() });
      if (mountedRef.current) {
        setError('Failed to refresh commit suite details');
        setLoading(false);
      }
    } finally {
      if (mountedRef.current) {
        setRefreshing(false);
      }
    }
  }, [commitSuiteId, ideMessenger, log]);



  // Cleanup on unmount
  useEffect(() => {
    return () => {
      log("Component unmounting, cleaning up...");
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [log]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    fetchCommitSuite(true);
  }, [fetchCommitSuite]);

  // Handle back navigation
  const handleBack = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    navigate('/e2e-commit-suites');
  }, [navigate]);

  // Handle run commit suite
  const handleRunCommitSuite = useCallback(async () => {
    if (!commitSuite || !ideMessenger) return;
    
    try {
      await ideMessenger.runE2eCommitSuite(commitSuite.uuid);
      // Refresh the data after running
      await fetchCommitSuite(true);
    } catch (error) {
      console.error('Error running commit suite:', error);
    }
  }, [commitSuite, ideMessenger, fetchCommitSuite]);

  // Handle view individual test
  const handleViewTest = useCallback((test: E2eTest) => {
    if (test.curRun) {
      navigate(`/e2e-runs/${test.uuid}/${test.curRun.uuid}`);
    }
  }, [navigate]);

  // Auth check
  if (!session?.account.id) {
    return (
      <div className="h-full bg-vsc-editor-background text-vsc-foreground">
        <div className="p-3">
          <div className="mb-3">
            <h1 className="text-sm font-medium text-vsc-foreground mb-1">Commit Suite Details</h1>
            <p className="text-xs text-vsc-descriptionForeground">View commit suite information</p>
          </div>
          
          <div className="bg-vsc-input-background border border-vsc-input-border rounded-sm p-3">
            <PlatformOnboardingCard isDialog={false} />
          </div>
        </div>
      </div>
    );
  }

  // Show empty state if loading, error, or no data
  const shouldShowLoading = loading || error || !commitSuite;
  
  log('Render decision', { 
    loading, 
    hasError: !!error, 
    hasCommitSuite: !!commitSuite,
    shouldShowLoading,
    errorMessage: error
  });

  if (shouldShowLoading) {
    log('Rendering loading/error state', { loading, error: error, hasCommitSuite: !!commitSuite });
    return (
      <div className="h-full bg-vsc-editor-background text-vsc-foreground">
        <div className="p-3 border-b border-vsc-panel-border">
          <div className="flex items-center gap-2">
            <button
              onClick={handleBack}
              className="p-1 text-vsc-foreground hover:text-vsc-foreground hover:bg-vsc-list-hoverBackground rounded-sm transition-colors"
              title="Back"
            >
              <ArrowLeftIcon className="h-3 w-3" />
            </button>
            <h1 className="text-sm font-medium text-vsc-foreground">Commit Suite Details</h1>
          </div>
        </div>
        {loading && <LoadingState />}
        {error && <ErrorState onRetry={() => fetchCommitSuite()} />}
        {!loading && !error && !commitSuite && <NotFoundState />}
      </div>
    );
  }

  log('Rendering main content', { 
    commitSuiteUuid: commitSuite?.uuid,
    testsCount: commitSuite?.tests?.length
  });

  return (
    <div className="h-full bg-vsc-editor-background text-vsc-foreground flex flex-col">
      {/* Header */}
      <div className="p-2 border-b border-vsc-panel-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <button
              onClick={handleBack}
              className="p-1 text-vsc-tab-inactiveForeground hover:text-vsc-tab-activeForeground hover:bg-vsc-list-hoverBackground rounded-sm transition-colors"
              title="Back to Commit Suites"
            >
              <ArrowLeftIcon className="h-4 w-4" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="text-sm font-medium text-vsc-foreground leading-tight break-words">
                {commitSuite.description}
              </h1>
              <div className="flex items-center space-x-2 mt-1">
                <span className="text-xs text-vsc-descriptionForeground">
                  ID: {commitSuite.uuid.slice(0, 8)}
                </span>
                <StatusBadge status={commitSuite.runStatus} />
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-1 text-vsc-tab-inactiveForeground hover:text-vsc-tab-activeForeground hover:bg-vsc-list-hoverBackground rounded-sm transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <ArrowPathIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleRunCommitSuite}
              className="flex items-center space-x-1 px-2 py-1 text-xs font-medium text-vsc-button-foreground bg-vsc-button-background rounded-sm hover:bg-vsc-button-hoverBackground transition-colors"
              title="Run commit suite"
            >
              <PlayIcon className="h-3 w-3" />
              <span>Run</span>
            </button>
          </div>
        </div>
        
        {refreshing && (
          <div className="text-xs text-vsc-textLink-foreground mb-2">Refreshing...</div>
        )}

        {/* Tabs */}
        <div className="flex space-x-1">
          <button
            className={`flex items-center space-x-1 px-2 py-1 text-xs rounded-sm transition-all duration-150 ${
              activeTab === 'overview'
                ? 'bg-vsc-tab-activeBackground text-vsc-tab-activeForeground border border-vsc-tab-activeBorder'
                : 'text-vsc-tab-inactiveForeground hover:text-vsc-tab-activeForeground hover:bg-vsc-tab-hoverBackground'
            }`}
            onClick={() => setActiveTab('overview')}
          >
            <DocumentTextIcon className="h-4 w-4" />
            <span className="font-medium">Overview</span>
          </button>
          <button
            className={`flex items-center space-x-1 px-2 py-1 text-xs rounded-sm transition-all duration-150 ${
              activeTab === 'tests'
                ? 'bg-vsc-tab-activeBackground text-vsc-tab-activeForeground border border-vsc-tab-activeBorder'
                : 'text-vsc-tab-inactiveForeground hover:text-vsc-tab-activeForeground hover:bg-vsc-tab-hoverBackground'
            }`}
            onClick={() => setActiveTab('tests')}
          >
            <ClockIcon className="h-4 w-4" />
            <span className="font-medium">Tests ({commitSuite.tests?.length || 0})</span>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto p-2">
        {activeTab === 'overview' && (
          <div className="space-y-2">
            {/* Commit Info */}
            <div className="bg-vsc-list-inactiveSelectionBackground border border-vsc-panel-border rounded-sm p-2">
              <h3 className="text-xs font-medium text-vsc-foreground mb-2">Commit Information</h3>
              <div className="space-y-1 text-xs text-vsc-descriptionForeground">
                {commitSuite.commitHash && (
                  <div className="flex items-center space-x-1">
                    <CodeBracketIcon className="w-3 h-3 flex-shrink-0" />
                    <span className="font-mono break-words">
                      {commitSuite.commitHashShort} ({commitSuite.commitHash})
                    </span>
                  </div>
                )}
                <div className="flex items-center space-x-1">
                  <DocumentTextIcon className="w-3 h-3 flex-shrink-0" />
                  <span>Project: {commitSuite.projectName}</span>
                </div>
              </div>
            </div>

            {/* Changes Summary */}
            {commitSuite.summarizedChanges && (
              <div className="bg-vsc-list-inactiveSelectionBackground border border-vsc-panel-border rounded-sm p-2">
                <h3 className="text-xs font-medium text-vsc-foreground mb-2">Changes Summary</h3>
                <div className="text-xs text-vsc-descriptionForeground leading-relaxed break-words">
                  {commitSuite.summarizedChanges}
                </div>
              </div>
            )}

            {/* Test Summary */}
            <div className="bg-vsc-list-inactiveSelectionBackground border border-vsc-panel-border rounded-sm p-2">
              <h3 className="text-xs font-medium text-vsc-foreground mb-2">Test Summary</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-vsc-descriptionForeground">Total Tests:</span>
                  <span className="ml-1 font-medium text-vsc-foreground">{commitSuite.tests.length}</span>
                </div>
                <div>
                  <span className="text-vsc-descriptionForeground">Passed:</span>
                  <span className="ml-1 font-medium text-green-600">
                    {commitSuite.tests?.filter(t => t?.curRun?.status === 'completed' && t?.curRun?.outcome === 'pass').length || 0}
                  </span>
                </div>
                <div>
                  <span className="text-vsc-descriptionForeground">Running:</span>
                  <span className="ml-1 font-medium text-blue-600">
                    {commitSuite.tests?.filter(t => t?.curRun?.status === 'running').length || 0}
                  </span>
                </div>
                <div>
                  <span className="text-vsc-descriptionForeground">Failed:</span>
                  <span className="ml-1 font-medium text-red-600">
                    {commitSuite.tests?.filter(t => t?.curRun?.status === 'completed' && t?.curRun?.outcome === 'fail').length || 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="bg-vsc-list-inactiveSelectionBackground border border-vsc-panel-border rounded-sm p-2">
              <h3 className="text-xs font-medium text-vsc-foreground mb-2">Timeline</h3>
              <div className="space-y-1 text-xs text-vsc-descriptionForeground">
                <div className="flex items-center space-x-1">
                  <CalendarIcon className="h-3 w-3 flex-shrink-0" />
                  <span>Created: {new Date(commitSuite.timestamp).toLocaleString()}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <CalendarIcon className="h-3 w-3 flex-shrink-0" />
                  <span>Updated: {new Date(commitSuite.lastMod).toLocaleString()}</span>
                </div>
                {commitSuite.createdBy && (
                  <div className="flex items-center space-x-1">
                    <UserIcon className="h-3 w-3 flex-shrink-0" />
                    <span>
                      {formatUserWithPrefix(commitSuite.createdBy)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tests' && (
          <div className="space-y-2">
            {(commitSuite.tests || []).map((test) => (
              <div
                key={test.uuid}
                className="bg-vsc-list-inactiveSelectionBackground border border-vsc-panel-border rounded-sm p-2 hover:bg-vsc-list-hoverBackground transition-colors"
              >
                <div className="mb-2">
                  <h4 className="text-xs font-medium text-vsc-foreground leading-tight break-words">
                    {test.name}
                  </h4>
                  {test.description && (
                    <p className="text-xs text-vsc-descriptionForeground mt-1 break-words">
                      {test.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <TestStatusBadge test={test} />
                    {test.testScript && (
                      <span className="text-xs text-vsc-descriptionForeground font-mono">
                        {test.testScript}
                      </span>
                    )}
                  </div>
                  
                  {test.curRun && (
                    <button
                      onClick={() => handleViewTest(test)}
                      className="flex items-center space-x-1 px-2 py-1 text-xs text-vsc-tab-inactiveForeground hover:text-vsc-tab-activeForeground hover:bg-vsc-list-hoverBackground rounded-sm transition-colors"
                      title="View test details"
                    >
                      <EyeIcon className="h-3 w-3" />
                      <span>View</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
            
            {(!commitSuite.tests || commitSuite.tests.length === 0) && (
              <div className="text-center py-4 text-xs text-vsc-descriptionForeground">
                No tests found in this commit suite
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Wrap with error boundary for better error handling
function E2eCommitSuiteDetailPageWithBoundary() {
  return (
    <E2eCommitSuiteErrorBoundary>
      <E2eCommitSuiteDetailPage />
    </E2eCommitSuiteErrorBoundary>
  );
}

export default E2eCommitSuiteDetailPageWithBoundary; 