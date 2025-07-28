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
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { fetchE2eSuites } from "../../redux/thunks/e2eSuitesThunks";

interface CreateSuiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { description: string; filePath?: string; repoName?: string; branchName?: string }) => Promise<void>;
  loading: boolean;
}

function CreateSuiteModal({ isOpen, onClose, onSubmit, loading }: CreateSuiteModalProps) {
  const [description, setDescription] = useState("");
  const [filePath, setFilePath] = useState("");
  const [repoName, setRepoName] = useState("");
  const [branchName, setBranchName] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;
    
    await onSubmit({
      description: description.trim(),
      filePath: filePath.trim() || undefined,
      repoName: repoName.trim() || undefined,
      branchName: branchName.trim() || undefined,
    });
    
    // Reset form
    setDescription("");
    setFilePath("");
    setRepoName("");
    setBranchName("");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-vsc-editor-background border border-vsc-panel-border rounded-sm max-w-md w-full max-h-[80vh] overflow-auto">
        <div className="p-4 border-b border-vsc-panel-border">
          <h2 className="text-sm font-medium text-vsc-foreground">Create Test Suite</h2>
          <p className="text-xs text-vsc-descriptionForeground mt-1">Generate a new test suite collection</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-vsc-foreground mb-1">
              Description *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this test suite should validate..."
              className="w-full px-2 py-1.5 text-xs bg-vsc-input-background border border-vsc-input-border text-vsc-foreground rounded-sm focus:outline-none focus:ring-1 focus:ring-vsc-button-background resize-none"
              rows={3}
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
              placeholder="/path/to/test/file"
              className="w-full px-2 py-1.5 text-xs bg-vsc-input-background border border-vsc-input-border text-vsc-foreground rounded-sm focus:outline-none focus:ring-1 focus:ring-vsc-button-background font-mono"
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
              className="w-full px-2 py-1.5 text-xs bg-vsc-input-background border border-vsc-input-border text-vsc-foreground rounded-sm focus:outline-none focus:ring-1 focus:ring-vsc-button-background"
            />
          </div>
          
          <div>
            <label className="block text-xs font-medium text-vsc-foreground mb-1">
              Branch
            </label>
            <input
              type="text"
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              placeholder="main"
              className="w-full px-2 py-1.5 text-xs bg-vsc-input-background border border-vsc-input-border text-vsc-foreground rounded-sm focus:outline-none focus:ring-1 focus:ring-vsc-button-background"
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
              className="flex-1 px-3 py-1.5 text-xs font-medium text-vsc-button-foreground bg-vsc-button-background rounded-sm hover:bg-vsc-button-hoverBackground disabled:opacity-50 transition-colors"
            >
              {loading ? "Creating..." : "Create Suite"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Main component
function E2eSuites() {
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
      await dispatch(fetchE2eSuites({ filters: currentFilters, pagination: currentPagination }));
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
    dispatch(fetchE2eSuites({ filters: currentFilters, pagination: currentPagination }));
  }, [dispatch, currentFilters, currentPagination]);

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

  // Handle suite creation
  const handleCreateSuite = useCallback(async (data: { description: string; filePath?: string; repoName?: string; branchName?: string }) => {
    if (!mountedRef.current) return;

    try {
      setCreateLoading(true);

      // Use IDE messenger to create suite
      if (ideMessenger) {
        await ideMessenger.request('ideCommand/run', {
          slashCommandName: 'run-command',
          params: {
            command: 'e2eSuites/create',
            description: data.description,
            filePath: data.filePath,
            repoName: data.repoName,
            branchName: data.branchName,
          },
        });
      }

      if (mountedRef.current) {
        setIsCreateModalOpen(false);
        handleRefresh(); // Refresh the list after creation
      }
    } catch (error) {
      console.error('Error creating suite:', error);
    } finally {
      if (mountedRef.current) {
        setCreateLoading(false);
      }
    }
  }, [ideMessenger, handleRefresh]);

  // Handle suite actions
  const handleViewSuite = useCallback((suite: E2eTestSuite) => {
    navigate(`/e2es/suites/${suite.uuid}`);
  }, [navigate]);

  const handleRunSuite = useCallback((suite: E2eTestSuite) => {
    console.log('Running suite:', suite.uuid);
    // TODO: Implement suite run logic with ideMessenger
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon className="h-4 w-4 text-green-500" />;
      case 'running':
        return <ClockIcon className="h-4 w-4 text-blue-500" />;
      case 'failed':
        return <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />;
      default:
        return <ClockIcon className="h-4 w-4 text-gray-500" />;
    }
  };

  if (loading && !refreshing) {
    return (
      <div className="h-full bg-vsc-editor-background text-vsc-foreground flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-vsc-button-background"></div>
          <p className="text-xs text-vsc-descriptionForeground mt-2">Loading test suites...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full bg-vsc-editor-background text-vsc-foreground flex items-center justify-center">
        <div className="text-center">
          <ExclamationTriangleIcon className="h-8 w-8 text-red-500 mx-auto" />
          <p className="text-sm text-vsc-foreground mt-2">Error loading test suites</p>
          <p className="text-xs text-vsc-descriptionForeground">{error}</p>
          <button
            onClick={handleRefresh}
            className="mt-3 px-3 py-1.5 text-xs bg-vsc-button-background text-vsc-button-foreground rounded-sm hover:bg-vsc-button-hoverBackground"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-vsc-editor-background text-vsc-foreground flex flex-col">
      {/* VS Code-style Header */}
      <div className="p-3 border-b border-vsc-panel-border">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-vsc-foreground">Test Suites</h2>
            <p className="text-xs text-vsc-descriptionForeground">Organized collections of related tests</p>
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

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {suites.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <FolderOpenIcon className="h-12 w-12 text-vsc-descriptionForeground mx-auto mb-3" />
              <p className="text-sm text-vsc-foreground mb-1">No test suites found</p>
              <p className="text-xs text-vsc-descriptionForeground mb-4">Create your first test suite to get started</p>
              <button
                onClick={handleOpenModal}
                className="px-3 py-1.5 text-xs bg-vsc-button-background text-vsc-button-foreground rounded-sm hover:bg-vsc-button-hoverBackground"
              >
                Create Test Suite
              </button>
            </div>
          </div>
        ) : (
          <div className="p-3">
            <div className="space-y-2">
              {suites.map((suite) => (
                <div
                  key={suite.uuid}
                  className="p-3 bg-vsc-list-inactiveSelectionBackground border border-vsc-panel-border rounded-sm hover:bg-vsc-list-hoverBackground transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <FolderOpenIcon className="h-4 w-4 text-vsc-symbolIcon-namespaceForeground flex-shrink-0" />
                        <h3 className="text-sm font-medium text-vsc-foreground truncate">
                          {suite.name || suite.description}
                        </h3>
                        {getStatusIcon(suite.completed ? 'completed' : 'pending')}
                      </div>
                      
                      {suite.description && suite.name && (
                        <p className="text-xs text-vsc-descriptionForeground mt-1 line-clamp-2">
                          {suite.description}
                        </p>
                      )}
                      
                      <div className="flex items-center space-x-4 mt-2 text-xs text-vsc-descriptionForeground">
                        <div className="flex items-center space-x-1">
                          <UserIcon className="h-3 w-3" />
                          <span>Created by User {suite.createdBy}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <CalendarIcon className="h-3 w-3" />
                          <span>{formatDate(suite.timestamp)}</span>
                        </div>
                        {suite.tests && (
                          <div className="flex items-center space-x-1">
                            <span>{suite.tests.length} tests</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-1 ml-3">
                      <button
                        onClick={() => handleViewSuite(suite)}
                        className="p-1 text-vsc-tab-inactiveForeground hover:text-vsc-tab-activeForeground hover:bg-vsc-list-hoverBackground rounded-sm transition-colors"
                        title="View suite details"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleRunSuite(suite)}
                        className="p-1 text-vsc-tab-inactiveForeground hover:text-vsc-tab-activeForeground hover:bg-vsc-list-hoverBackground rounded-sm transition-colors"
                        title="Run test suite"
                      >
                        <PlayIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
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

export default E2eSuites;