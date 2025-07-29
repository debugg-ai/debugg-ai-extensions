import {
  ArrowLeftIcon,
  ArrowPathIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  FolderOpenIcon,
  PlayIcon,
  UserIcon,
  XCircleIcon
} from "@heroicons/react/24/outline";
import type { E2eTest } from "core/debuggAIServer/types";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { PlatformOnboardingCard } from "../../components/OnboardingCard/platform/PlatformOnboardingCard";
import { useAuth } from "../../context/Auth";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useNavigationListener } from "../../hooks/useNavigationListener";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { getE2eSuite, runE2eSuite } from "../../redux/thunks/e2eSuitesThunks";
import { formatUserWithPrefix } from "../../util/userDisplay";

// Status badge component for suites
interface StatusBadgeProps {
  completed?: boolean;
  completedAt?: string | null;
}

function StatusBadge({ completed, completedAt }: StatusBadgeProps) {
  if (completed === undefined && !completedAt) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
        <ClockIcon className="h-3 w-3" />
        Unknown
      </span>
    );
  }

  const isCompleted = completed || !!completedAt;
  
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium ${
      isCompleted
        ? 'bg-green-100 text-green-800'
        : 'bg-blue-100 text-blue-800'
    }`}>
      {isCompleted ? <CheckCircleIcon className="h-3 w-3" /> : <ClockIcon className="h-3 w-3" />}
      {isCompleted ? 'Completed' : 'In Progress'}
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
        <span className="text-xs text-vsc-descriptionForeground">Loading suite details...</span>
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
      <p className="text-xs text-vsc-descriptionForeground mb-3">Failed to load suite details</p>
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
      <FolderOpenIcon className="h-8 w-8 text-vsc-descriptionForeground mx-auto mb-2" />
      <h3 className="text-sm font-medium text-vsc-foreground mb-1">Suite Not Found</h3>
      <p className="text-xs text-vsc-descriptionForeground">The requested suite could not be found</p>
    </div>
  );
}

function E2eSuiteDetailPage() {
  useNavigationListener();
  const { session } = useAuth();
  const navigate = useNavigate();
  const { suiteId } = useParams<{ suiteId: string }>();
  const [searchParams] = useSearchParams();
  const suiteUuid = suiteId || searchParams.get('suiteId');
  const ideMessenger = useContext(IdeMessengerContext);
  const dispatch = useAppDispatch();
  
  // State
  const {
    suiteDetail: suite,
    loading,
    error,
  } = useAppSelector((state) => state.e2eSuites);

  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'tests'>('overview');

  // Refs for cleanup
  const mountedRef = useRef(true);

  // Fetch suite data when component mounts or suiteUuid changes
  useEffect(() => {
    if (!suiteUuid || !ideMessenger) return;

    // Dispatch the thunk - Redux will handle loading states
    dispatch(getE2eSuite(suiteUuid));
  }, [suiteUuid, ideMessenger, dispatch]);

  // Simple refresh function
  const fetchSuite = useCallback(() => {
    if (!suiteUuid || !ideMessenger) return;
    dispatch(getE2eSuite(suiteUuid));
  }, [suiteUuid, ideMessenger, dispatch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchSuite();
    // Reset refreshing state after a short delay
    setTimeout(() => setRefreshing(false), 1000);
  }, [fetchSuite]);

  // Handle back navigation
  const handleBack = useCallback(() => {
    navigate('/e2e-suites');
  }, [navigate]);

  // Handle run suite
  const handleRunSuite = useCallback(async () => {
    if (!suite) return;
    
    try {
      console.log('Running suite:', suite.uuid);
      await dispatch(runE2eSuite(suite.uuid)).unwrap();
      // Refresh the data after running
      fetchSuite();
    } catch (error) {
      console.error('Error running suite:', error);
    }
  }, [suite, dispatch, fetchSuite]);

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
            <h1 className="text-sm font-medium text-vsc-foreground mb-1">Suite Details</h1>
            <p className="text-xs text-vsc-descriptionForeground">View suite information</p>
          </div>
          
          <div className="bg-vsc-input-background border border-vsc-input-border rounded-sm p-3">
            <PlatformOnboardingCard isDialog={false} />
          </div>
        </div>
      </div>
    );
  }

  // Show empty state if loading, error, or no data
  const shouldShowLoading = loading || error || !suite;

  if (shouldShowLoading) {
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
            <h1 className="text-sm font-medium text-vsc-foreground">Suite Details</h1>
          </div>
        </div>
        {loading && <LoadingState />}
        {error && <ErrorState onRetry={fetchSuite} />}
        {!loading && !error && !suite && <NotFoundState />}
      </div>
    );
  }

  return (
    <div className="h-full bg-vsc-editor-background text-vsc-foreground flex flex-col">
      {/* Header */}
      <div className="p-2 border-b border-vsc-panel-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <button
              onClick={handleBack}
              className="p-1 text-vsc-tab-inactiveForeground hover:text-vsc-tab-activeForeground hover:bg-vsc-list-hoverBackground rounded-sm transition-colors"
              title="Back to E2E Suites"
            >
              <ArrowLeftIcon className="h-4 w-4" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="text-sm font-medium text-vsc-foreground leading-tight break-words">
                {suite.name || suite.description || 'Unnamed Suite'}
              </h1>
              <div className="flex items-center space-x-2 mt-1">
                <span className="text-xs text-vsc-descriptionForeground">
                  ID: {suite.uuid.slice(0, 8)}
                </span>
                <StatusBadge completed={suite.completed} completedAt={suite.completedAt} />
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
              onClick={handleRunSuite}
              className="flex items-center space-x-1 px-2 py-1 text-xs font-medium text-vsc-button-foreground bg-vsc-button-background rounded-sm hover:bg-vsc-button-hoverBackground transition-colors"
              title="Run suite"
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
            <span className="font-medium">Tests ({suite.tests?.length || 0})</span>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto p-2">
        {activeTab === 'overview' && (
          <div className="space-y-2">
            {/* Suite Info */}
            <div className="bg-vsc-list-inactiveSelectionBackground border border-vsc-panel-border rounded-sm p-2">
              <h3 className="text-xs font-medium text-vsc-foreground mb-2">Suite Information</h3>
              <div className="space-y-1 text-xs text-vsc-descriptionForeground">
                {suite.name && (
                  <div className="flex items-center space-x-1">
                    <DocumentTextIcon className="w-3 h-3 flex-shrink-0" />
                    <span className="break-words">Name: {suite.name}</span>
                  </div>
                )}
                {suite.description && (
                  <div className="flex items-center space-x-1">
                    <DocumentTextIcon className="w-3 h-3 flex-shrink-0" />
                    <span className="break-words">Description: {suite.description}</span>
                  </div>
                )}
                {suite.key && (
                  <div className="flex items-center space-x-1">
                    <DocumentTextIcon className="w-3 h-3 flex-shrink-0" />
                    <span className="font-mono break-words">Key: {suite.key}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Test Summary */}
            <div className="bg-vsc-list-inactiveSelectionBackground border border-vsc-panel-border rounded-sm p-2">
              <h3 className="text-xs font-medium text-vsc-foreground mb-2">Test Summary</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-vsc-descriptionForeground">Total Tests:</span>
                  <span className="ml-1 font-medium text-vsc-foreground">{suite.tests?.length || 0}</span>
                </div>
                <div>
                  <span className="text-vsc-descriptionForeground">Passed:</span>
                  <span className="ml-1 font-medium text-green-600">
                    {suite.tests?.filter(t => t?.curRun?.status === 'completed' && t?.curRun?.outcome === 'pass').length || 0}
                  </span>
                </div>
                <div>
                  <span className="text-vsc-descriptionForeground">Running:</span>
                  <span className="ml-1 font-medium text-blue-600">
                    {suite.tests?.filter(t => t?.curRun?.status === 'running').length || 0}
                  </span>
                </div>
                <div>
                  <span className="text-vsc-descriptionForeground">Failed:</span>
                  <span className="ml-1 font-medium text-red-600">
                    {suite.tests?.filter(t => t?.curRun?.status === 'completed' && t?.curRun?.outcome === 'fail').length || 0}
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
                  <span>Created: {new Date(suite.timestamp).toLocaleString()}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <CalendarIcon className="h-3 w-3 flex-shrink-0" />
                  <span>Updated: {new Date(suite.lastMod).toLocaleString()}</span>
                </div>
                {suite.completedAt && (
                  <div className="flex items-center space-x-1">
                    <CheckCircleIcon className="h-3 w-3 flex-shrink-0" />
                    <span>Completed: {new Date(suite.completedAt).toLocaleString()}</span>
                  </div>
                )}
                {suite.createdBy && (
                  <div className="flex items-center space-x-1">
                    <UserIcon className="h-3 w-3 flex-shrink-0" />
                    <span>
                      Created by: {formatUserWithPrefix(suite.createdBy)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Feature & Environment Info */}
            {(suite.feature || suite.testType || suite.userRole || suite.deviceType || suite.region) && (
              <div className="bg-vsc-list-inactiveSelectionBackground border border-vsc-panel-border rounded-sm p-2">
                <h3 className="text-xs font-medium text-vsc-foreground mb-2">Test Configuration</h3>
                <div className="space-y-1 text-xs text-vsc-descriptionForeground">
                  {suite.feature && (
                    <div>
                      <span className="text-vsc-foreground">Feature:</span>
                      <span className="ml-1">{suite.feature.name}</span>
                    </div>
                  )}
                  {suite.testType && (
                    <div>
                      <span className="text-vsc-foreground">Test Type:</span>
                      <span className="ml-1">{suite.testType.name}</span>
                    </div>
                  )}
                  {suite.userRole && (
                    <div>
                      <span className="text-vsc-foreground">User Role:</span>
                      <span className="ml-1">{suite.userRole.name}</span>
                    </div>
                  )}
                  {suite.deviceType && (
                    <div>
                      <span className="text-vsc-foreground">Device Type:</span>
                      <span className="ml-1">{suite.deviceType.name}</span>
                    </div>
                  )}
                  {suite.region && (
                    <div>
                      <span className="text-vsc-foreground">Region:</span>
                      <span className="ml-1">{suite.region.name}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'tests' && (
          <div className="space-y-2">
            {(suite.tests || []).map((test) => (
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
            
            {(!suite.tests || suite.tests.length === 0) && (
              <div className="text-center py-4 text-xs text-vsc-descriptionForeground">
                No tests found in this suite
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default E2eSuiteDetailPage;