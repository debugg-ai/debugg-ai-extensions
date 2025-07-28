import {
  ArrowLeftIcon,
  ArrowPathIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  ServerIcon,
  UserIcon,
  XCircleIcon
} from "@heroicons/react/24/outline";
import type { E2eRun, E2eRunOutcome, E2eRunStatus, E2eTest } from "core/debuggAIServer/types";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { IdeMessengerContext } from "../../context/IdeMessenger";

// Default empty states
const EMPTY_TEST: E2eTest = {
  id: '',
  uuid: '',
  project: 0,
  projectName: '',
  name: '',
  description: '',
  testScript: '',
  createdBy: 0,
  curRun: null,
  host: null,
  tunnelKey: null,
  agent: null,
  agentTaskDescription: null,
  timestamp: '',
  lastMod: '',
};

const EMPTY_RUN: E2eRun = {
  id: 0,
  uuid: '',
  timestamp: '',
  lastMod: '',
  key: '',
  runType: 'run',
  test: EMPTY_TEST,
  status: 'pending',
  outcome: 'pending',
  conversations: [],
  startedBy: 0,
  runOnHost: 0,
  targetUrl: '',
  runGif: null,
  runScript: null,
  runJson: null,
  metrics: null,
  tunnelKey: null,
};

// Status badge component
interface StatusBadgeProps {
  status: E2eRunStatus;
  outcome?: E2eRunOutcome | null;
}

function StatusBadge({ status, outcome }: StatusBadgeProps) {
  if (status === 'completed') {
    if (outcome === 'pass') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-xs font-medium bg-vsc-testing-iconPassed text-white">
          <CheckCircleIcon className="h-3 w-3" />
          Passed
        </span>
      );
    } else if (outcome === 'fail') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-xs font-medium bg-vsc-testing-iconFailed text-white">
          <XCircleIcon className="h-3 w-3" />
          Failed
        </span>
      );
    }
  }

  const statusConfig = {
    running: { icon: ClockIcon, bgColor: 'bg-vsc-notificationsInfoIcon-foreground', textColor: 'text-white', label: 'Running' },
    pending: { icon: ClockIcon, bgColor: 'bg-vsc-testing-iconQueued', textColor: 'text-black', label: 'Pending' },
    completed: { icon: CheckCircleIcon, bgColor: 'bg-vsc-testing-iconPassed', textColor: 'text-white', label: 'Completed' },
    cancelled: { icon: XCircleIcon, bgColor: 'bg-vsc-descriptionForeground', textColor: 'text-white', label: 'Cancelled' },
    failed: { icon: ExclamationTriangleIcon, bgColor: 'bg-vsc-testing-iconFailed', textColor: 'text-white', label: 'Failed' },
  };

  const config = statusConfig[status] || statusConfig.pending;
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
        <span className="text-xs text-vsc-descriptionForeground">Loading test run details...</span>
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
      <p className="text-xs text-vsc-descriptionForeground mb-3">Failed to load test run details</p>
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
      <h3 className="text-sm font-medium text-vsc-foreground mb-1">Test Run Not Found</h3>
      <p className="text-xs text-vsc-descriptionForeground">The requested test run could not be found</p>
    </div>
  );
}

// Empty state selector
function EmptyState({ loading, error, onRetry }: { loading: boolean; error: string | null; onRetry: () => void }) {
  if (loading) return <LoadingState />;
  if (error) return <ErrorState onRetry={onRetry} />;
  return <NotFoundState />;
}

function E2eRunsPage() {
  const navigate = useNavigate();
  const { testId, runId } = useParams<{ testId: string; runId: string }>();
  const ideMessenger = useContext(IdeMessengerContext);

  // State with proper default empty states
  const [run, setRun] = useState<E2eRun | null>(null);
  const [test, setTest] = useState<E2eTest | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'conversations'>('overview');

  // Refs for cleanup and request cancellation
  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  // Fetch test and run data
  const fetchData = useCallback(async (isRefresh = false) => {
    if (!testId || !runId) return;

    // Cancel any ongoing requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      if (!isRefresh) {
        setTest(null);
        setRun(null);
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);

      // TODO: Replace with real API calls when ideMessenger protocol is available
      // const testResult = await ideMessenger?.request('e2eTests/getE2eTest', { uuid: testId }, { signal });
      // const runResult = await ideMessenger?.request('e2eRuns/getE2eRun', { uuid: runId }, { signal });

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
                 const mockRun: E2eRun = {
           id: parseInt(runId),
           uuid: runId,
           timestamp: '2024-01-01T10:30:00Z',
           lastMod: '2024-01-01T11:00:00Z',
           key: 'test-run-key',
           runType: 'run',
           test: null,
           status: 'completed',
           outcome: 'pass',
           conversations: [
             {
               uuid: 'conv-1',
               creatorUuid: 'user-1',
               user: 1,
               company: 1,
               messages: [
                 { 
                   uuid: 'msg-1',
                   sender: 'user-1',
                   role: 'user', 
                   content: 'Start test execution',
                   cleanedTickedContent: null,
                   jsonContent: null,
                   timestamp: '2024-01-01T10:30:00Z',
                   lastMod: '2024-01-01T10:30:00Z'
                 },
                 { 
                   uuid: 'msg-2',
                   sender: 'assistant',
                   role: 'assistant', 
                   content: 'Navigating to login page...',
                   cleanedTickedContent: null,
                   jsonContent: null,
                   timestamp: '2024-01-01T10:31:00Z',
                   lastMod: '2024-01-01T10:31:00Z'
                 },
                 { 
                   uuid: 'msg-3',
                   sender: 'assistant',
                   role: 'assistant', 
                   content: 'Entering credentials...',
                   cleanedTickedContent: null,
                   jsonContent: null,
                   timestamp: '2024-01-01T10:32:00Z',
                   lastMod: '2024-01-01T10:32:00Z'
                 },
                 { 
                   uuid: 'msg-4',
                   sender: 'assistant',
                   role: 'assistant', 
                   content: 'Test completed successfully!',
                   cleanedTickedContent: null,
                   jsonContent: null,
                   timestamp: '2024-01-01T10:33:00Z',
                   lastMod: '2024-01-01T10:33:00Z'
                 }
               ],
               timestamp: '2024-01-01T10:30:00Z',
               lastMod: '2024-01-01T10:33:00Z'
             }
           ],
           startedBy: 1,
           runOnHost: 1,
           targetUrl: 'https://app.example.com',
           runGif: null,
           runScript: null,
           runJson: null,
           metrics: {
             executionTime: 25.7,
             numSteps: 8
           },
           tunnelKey: null,
         };

         const mockTest: E2eTest = {
           id: testId,
           uuid: testId,
           timestamp: '2024-01-01T10:00:00Z',
           lastMod: '2024-01-01T12:00:00Z',
           project: 1,
           projectName: 'Sample Project',
           name: 'Sample E2E Test',
           description: 'A comprehensive test for authentication flow',
           testScript: '/tests/auth.spec.ts',
           createdBy: 1,
           curRun: mockRun,
           host: null,
           tunnelKey: null,
           agent: null,
           agentTaskDescription: null,
         };

        setTest(mockTest);
        setRun(mockRun);
      }
    } catch (error) {
      if (mountedRef.current && !signal.aborted) {
        console.error('Error fetching data:', error);
        setError('Failed to load test run details');
        setTest(null);
        setRun(null);
      }
    } finally {
      if (mountedRef.current && !signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [testId, runId, ideMessenger]);

  // Initial data fetch
  useEffect(() => {
    fetchData();
    
    // Cleanup function
    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchData]);

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
    fetchData(true);
  }, [fetchData]);

  // Handle back navigation
  const handleBack = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    navigate(-1);
  }, [navigate]);

  // Show empty state if loading, error, or no data
  if (loading || error || !test || !run) {
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
            <h1 className="text-sm font-medium text-vsc-foreground">Test Run Details</h1>
          </div>
        </div>
        <EmptyState loading={loading} error={error} onRetry={() => fetchData()} />
      </div>
    );
  }

  return (
    <div className="h-full bg-vsc-editor-background text-vsc-foreground flex flex-col">
      {/* VS Code-style Header */}
      <div className="p-2 border-b border-vsc-panel-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <button
              onClick={handleBack}
              className="p-1 text-vsc-tab-inactiveForeground hover:text-vsc-tab-activeForeground hover:bg-vsc-list-hoverBackground rounded-sm transition-colors"
              title="Back to Test"
            >
              <ArrowLeftIcon className="h-4 w-4" />
            </button>
            <div>
              <h1 className="text-sm font-medium text-vsc-foreground leading-tight">{test.name || "Unnamed Test"}</h1>
              <p className="text-xs text-vsc-descriptionForeground">
                Run started {new Date(run.timestamp || Date.now()).toLocaleString()}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-1">
            <StatusBadge status={run.status} outcome={run.outcome} />
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-1 text-vsc-tab-inactiveForeground hover:text-vsc-tab-activeForeground hover:bg-vsc-list-hoverBackground rounded-sm transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <ArrowPathIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        {refreshing && (
          <div className="text-xs text-vsc-textLink-foreground mb-2">Refreshing...</div>
        )}

        {/* Compact Icon-based Tabs */}
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
              activeTab === 'conversations'
                ? 'bg-vsc-tab-activeBackground text-vsc-tab-activeForeground border border-vsc-tab-activeBorder'
                : 'text-vsc-tab-inactiveForeground hover:text-vsc-tab-activeForeground hover:bg-vsc-tab-hoverBackground'
            }`}
            onClick={() => setActiveTab('conversations')}
          >
            <ClockIcon className="h-4 w-4" />
            <span className="font-medium">Conversations</span>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto p-3">
        {activeTab === 'overview' && (
          <div className="space-y-3">
            {/* Test Info */}
            <div className="bg-vsc-input-background border border-vsc-input-border rounded-sm p-2">
              <h3 className="text-xs font-medium text-vsc-foreground mb-1">Test Information</h3>
              <div className="space-y-1 text-xs text-vsc-descriptionForeground">
                <div>{test.description || "No description available"}</div>
                <div className="flex items-center gap-1">
                  <DocumentTextIcon className="h-3 w-3" />
                  <span className="font-mono">{test.testScript || "No script path"}</span>
                </div>
              </div>
            </div>

            {/* Run Metrics */}
            <div className="bg-vsc-input-background border border-vsc-input-border rounded-sm p-2">
              <h3 className="text-xs font-medium text-vsc-foreground mb-1">Execution Details</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1">
                  <ClockIcon className="h-3 w-3 text-vsc-descriptionForeground" />
                  <span className="text-vsc-descriptionForeground">
                    {run.metrics?.executionTime ? `${run.metrics.executionTime.toFixed(2)}s` : 'N/A'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <DocumentTextIcon className="h-3 w-3 text-vsc-descriptionForeground" />
                  <span className="text-vsc-descriptionForeground">
                    {run.metrics?.numSteps || 0} steps
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <UserIcon className="h-3 w-3 text-vsc-descriptionForeground" />
                  <span className="text-vsc-descriptionForeground">User {run.startedBy}</span>
                </div>
                <div className="flex items-center gap-1">
                  <ServerIcon className="h-3 w-3 text-vsc-descriptionForeground" />
                  <span className="text-vsc-descriptionForeground">Host {run.runOnHost}</span>
                </div>
              </div>
              {run.targetUrl && (
                <div className="mt-2 pt-2 border-t border-vsc-input-border">
                  <div className="text-xs text-vsc-descriptionForeground">Target URL:</div>
                  <div className="text-xs text-vsc-textLink-foreground font-mono break-all">{run.targetUrl}</div>
                </div>
              )}
            </div>

            {/* Timeline */}
            <div className="bg-vsc-input-background border border-vsc-input-border rounded-sm p-2">
              <h3 className="text-xs font-medium text-vsc-foreground mb-1">Timeline</h3>
              <div className="space-y-1 text-xs text-vsc-descriptionForeground">
                <div className="flex items-center gap-1">
                  <CalendarIcon className="h-3 w-3" />
                  <span>Created: {new Date(test.timestamp || Date.now()).toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1">
                  <CalendarIcon className="h-3 w-3" />
                  <span>Started: {new Date(run.timestamp || Date.now()).toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1">
                  <CalendarIcon className="h-3 w-3" />
                  <span>Updated: {new Date(run.lastMod || Date.now()).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'conversations' && (
          <div className="space-y-2">
            {run.conversations?.map((conversation, idx) => (
              <div key={conversation.uuid} className="bg-vsc-input-background border border-vsc-input-border rounded-sm p-2">
                <h3 className="text-xs font-medium text-vsc-foreground mb-2">Conversation {idx + 1}</h3>
                <div className="space-y-1">
                  {conversation.messages.map((message, msgIdx) => (
                    <div
                      key={msgIdx}
                      className={`p-1.5 rounded-sm text-xs ${
                        message.role === 'user'
                          ? 'bg-vsc-button-background text-white'
                          : 'bg-vsc-button-secondaryBackground text-vsc-foreground'
                      }`}
                    >
                      <div className="font-medium text-xs opacity-70 mb-0.5">
                        {message.role === 'user' ? 'User' : 'Assistant'}
                      </div>
                      <div className="leading-relaxed">{message.content}</div>
                    </div>
                  ))}
                </div>
              </div>
            )) || (
              <div className="text-center py-4 text-xs text-vsc-descriptionForeground">
                No conversations available for this run
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default E2eRunsPage; 