import { ArrowLeftIcon, ArrowPathIcon, CalendarIcon, CheckCircleIcon, ExclamationTriangleIcon, PlayCircleIcon, ServerIcon, UserIcon, XCircleIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppDispatch } from "../../redux/hooks";

// Placeholder for E2E run fetching logic
// import { fetchE2eTestById, fetchE2eRunById } from "../../redux/e2eTestsSlice";
// import { E2eRunsService } from "../../services/backend/e2e-runs-service";

function E2eRunsPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  // Assume params: /e2es/:testId/runs/:runId
  const { testId, runId } = useParams();
  // Placeholder: Replace with real Redux selectors
  // const { current: test, loading: testLoading } = useAppSelector((state) => state.e2eTests);
  // const run = useAppSelector((state) => state.e2eRuns.current);
  // const loading = useAppSelector((state) => state.e2eRuns.loading);
  // const error = useAppSelector((state) => state.e2eRuns.error);

  // Mock state for demonstration
  const [run, setRun] = useState<any>(null);
  const [test, setTest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    // Simulate async fetch
    setTimeout(() => {
      // Replace with real fetch logic
      setTest({ name: "Sample E2E Test" });
      setRun({
        timestamp: new Date().toISOString(),
        status: "completed",
        outcome: "passed",
        runType: "Standard",
        startedBy: { firstName: "Jane", lastName: "Doe", email: "jane@example.com" },
        runOnHost: { name: "localhost" },
        metrics: { executionTime: 12.34, numSteps: 5 },
        targetUrl: "https://example.com",
        key: "abc123",
        conversations: [
          {
            uuid: "conv1",
            messages: [
              { role: "user", content: "Start test" },
              { role: "assistant", content: "Test started" },
            ],
          },
        ],
        runGif: null,
      });
      setLoading(false);
    }, 800);
  }, [testId, runId]);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 600);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="flex flex-col items-center gap-4">
          <ArrowPathIcon className="h-12 w-12 animate-spin text-blue-600" />
          <p className="text-stone-500">Loading test run details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="flex items-center mb-6">
          <button className="flex items-center gap-1 text-blue-600 hover:underline" onClick={() => navigate(-1)}>
            <ArrowLeftIcon className="h-4 w-4" />
            Back to Test
          </button>
        </div>
        <div className="p-4 bg-red-100 text-red-800 rounded-md">
          <div className="flex flex-col gap-4">
            <p>Error: {error}</p>
            <button className="px-3 py-1 rounded bg-zinc-200 hover:bg-zinc-300" onClick={() => setError(null)}>
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!test || !run) {
    return (
      <div className="p-6">
        <div className="flex items-center mb-6">
          <button className="flex items-center gap-1 text-blue-600 hover:underline" onClick={() => navigate("/e2es")}> 
            <ArrowLeftIcon className="h-4 w-4" />
            Back to Tests
          </button>
        </div>
        <div className="p-4 bg-amber-100 text-amber-800 rounded-md">
          <div className="flex flex-col gap-4">
            <p>Test run not found</p>
            <button className="px-3 py-1 rounded bg-zinc-200 hover:bg-zinc-300" onClick={handleRefresh}>
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <button className="flex items-center gap-1 text-blue-600 hover:underline" onClick={() => navigate(-1)}>
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Test
        </button>
        <button 
          className="flex items-center gap-1 px-3 py-1 rounded border border-zinc-300 hover:bg-zinc-100"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          {refreshing ? (
            <>
              <ArrowPathIcon className="h-4 w-4 animate-spin" />
              Refreshing...
            </>
          ) : (
            <>
              <ArrowPathIcon className="h-4 w-4" />
              Refresh
            </>
          )}
        </button>
      </div>

      <div className="flex items-center gap-2 mb-6">
        <div>
          <h1 className="text-2xl font-bold">{test.name}</h1>
          <p className="text-stone-500">Run {run.timestamp ? new Date(run.timestamp).toLocaleString() : "Unknown"}</p>
        </div>
        <TestStatusBadge status={run.status} outcome={run.outcome} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <InfoCard 
          icon={<CalendarIcon className="h-5 w-5 text-stone-400" />} 
          title="Started" 
          value={run.timestamp ? new Date(run.timestamp).toLocaleString() : "Unknown"} 
        />
        {run.metrics && (
          <InfoCard 
            icon={<PlayCircleIcon className="h-5 w-5 text-stone-400" />} 
            title="Execution Time" 
            value={`${run.metrics.executionTime.toFixed(2)}s`} 
          />
        )}
        <InfoCard 
          icon={<UserIcon className="h-5 w-5 text-stone-400" />} 
          title="Started By" 
          value={run.startedBy.firstName ? run.startedBy.firstName + " " + run.startedBy.lastName : run.startedBy.email} 
        />
        <InfoCard 
          icon={<ServerIcon className="h-5 w-5 text-stone-400" />} 
          title="Host" 
          value={run.runOnHost?.name || "None"} 
        />
      </div>

      <div className="mb-6">
        <div className="flex gap-2 mb-4">
          <button className={`px-3 py-1 rounded ${activeTab === "overview" ? "bg-blue-600 text-white" : "bg-zinc-200"}`} onClick={() => setActiveTab("overview")}>Overview</button>
          <button className={`px-3 py-1 rounded ${activeTab === "conversations" ? "bg-blue-600 text-white" : "bg-zinc-200"}`} onClick={() => setActiveTab("conversations")}>Conversations</button>
        </div>
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="border rounded p-4">
              <h2 className="text-lg font-semibold mb-2">Run Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium mb-1">Status</h3>
                  <TestStatusBadge status={run.status} outcome={run.outcome} />
                </div>
                <div>
                  <h3 className="font-medium mb-1">Run Type</h3>
                  <p className="text-stone-500">{run.runType || "Standard"}</p>
                </div>
                <div>
                  <h3 className="font-medium mb-1">Target URL</h3>
                  {run.targetUrl ? (
                    <a href={run.targetUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      {run.targetUrl}
                    </a>
                  ) : (
                    <p className="text-stone-500">Not specified</p>
                  )}
                </div>
                <div>
                  <h3 className="font-medium mb-1">Key</h3>
                  <p className="text-stone-500">{run.key || "—"}</p>
                </div>
              </div>
              {run.metrics && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <h3 className="font-medium mb-1">Execution Time</h3>
                    <p className="text-stone-500">{run.metrics.executionTime.toFixed(2)}s</p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-1">Number of Steps</h3>
                    <p className="text-stone-500">{run.metrics.numSteps}</p>
                  </div>
                </div>
              )}
            </div>
            {/* Optionally, add run.runGif here if available */}
          </div>
        )}
        {activeTab === "conversations" && (
          <div className="space-y-6">
            {run.conversations && run.conversations.length > 0 ? (
              <div className="border rounded p-4">
                <h2 className="text-lg font-semibold mb-2">Conversations</h2>
                <div className="space-y-6">
                  {run.conversations.map((conversation: any, index: number) => (
                    <div key={conversation.uuid || index} className="border rounded-md p-4">
                      <h3 className="font-medium mb-2">Conversation {index + 1}</h3>
                      <div className="space-y-4">
                        {conversation.messages && conversation.messages.map((message: any, msgIndex: number) => (
                          <div
                            key={msgIndex}
                            className={`p-3 rounded-md ${
                              message.role === "user"
                                ? "bg-zinc-100"
                                : message.role === "assistant"
                                ? "bg-blue-50"
                                : "bg-zinc-200"
                            }`}
                          >
                            <div className="font-medium mb-1 capitalize">{message.role}</div>
                            <div className="whitespace-pre-wrap">{message.content}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-12 bg-zinc-100 rounded-md">
                <p className="text-stone-500">No conversations recorded for this test run</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TestStatusBadge({ status, outcome }: { status: string; outcome: string }) {
  if (status === "running") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs">
        <ArrowPathIcon className="h-3 w-3 animate-spin" />
        Running
      </span>
    );
  }
  if (status === "completed") {
    if (outcome === "passed") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-100 text-green-700 text-xs">
          <CheckCircleIcon className="h-3 w-3" />
          Passed
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-100 text-red-700 text-xs">
          <XCircleIcon className="h-3 w-3" />
          Failed
        </span>
      );
    }
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-100 text-red-700 text-xs">
        <ExclamationTriangleIcon className="h-3 w-3" />
        Error
      </span>
    );
  }
  return <span className="inline-flex items-center gap-1 px-2 py-1 rounded border text-xs">{status}</span>;
}

function InfoCard({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }) {
  return (
    <div className="border rounded p-4 flex items-center gap-3">
      {icon}
      <div>
        <p className="text-sm text-stone-500">{title}</p>
        <p className="font-medium">{value}</p>
      </div>
    </div>
  );
}

export default E2eRunsPage; 