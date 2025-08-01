import { ArrowPathIcon, PlusIcon } from "@heroicons/react/24/outline";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { E2eTestsTable } from "../../components/e2es/e2e-tests-table";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useNavigationListener } from "../../hooks/useNavigationListener";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { createE2eTest, fetchE2eTests } from "../../redux/thunks/e2eTestsThunks";

interface CreateTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { description: string; filePath?: string; repoName?: string; branchName?: string }) => Promise<void>;
  loading: boolean;
}

function CreateTestModal({ isOpen, onClose, onSubmit, loading }: CreateTestModalProps) {
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
          <h2 className="text-sm font-medium text-vsc-foreground">Create E2E Test</h2>
          <p className="text-xs text-vsc-descriptionForeground mt-1">Generate a new end-to-end test</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-vsc-foreground mb-1">
              Description *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this test should validate..."
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
              {loading ? "Creating..." : "Create Test"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function E2eTestsPage() {
  useNavigationListener();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  
  // Redux state
  const config = useAppSelector((store) => store.config.config);
  const currentFilters = useAppSelector((store) => store.e2eTests.currentFilters);
  const currentPagination = useAppSelector((store) => store.e2eTests.currentPagination);

  // Local state
  const [refreshing, setRefreshing] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  // Refs for cleanup
  const mountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      // Dispatch Redux action to ensure state is updated
      await (dispatch as any)(fetchE2eTests({
        filters: currentFilters,
        pagination: currentPagination,
        search: ""
      })).unwrap();
      setRefreshing(false);
    } catch (error) {
      console.error('Error refreshing tests:', error);
    }
  }, [dispatch, currentFilters, currentPagination]);

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

  // Handle test creation
  const handleCreateTest = useCallback(async () => {
    try {
      setCreateLoading(true);

      // Use Redux thunk to create test
      await dispatch(createE2eTest({
        description: '',
        filePath: '',
        repoName: '',
        branchName: '',
      })).unwrap();

      // Refresh the list after creation
      await (dispatch as any)(fetchE2eTests({
        filters: currentFilters,
        pagination: currentPagination,
        search: ""
      })).unwrap();

    } catch (error) {
      console.error('Error creating test:', error);
    } finally {
      setCreateLoading(false);
    }
  }, [dispatch, currentFilters, currentPagination]);

  return (
    <div className="h-full bg-vsc-editor-background text-vsc-foreground flex flex-col">
      {/* VS Code-style Header */}
      <div className="p-3 border-b border-vsc-panel-border">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-vsc-foreground">E2E Tests</h2>
            <p className="text-xs text-vsc-descriptionForeground">Manage your individual end-to-end tests</p>
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-1.5 text-vsc-tab-inactiveForeground hover:text-vsc-tab-activeForeground hover:bg-vsc-list-hoverBackground rounded-sm transition-colors disabled:opacity-50"
              title="Refresh tests"
            >
              <ArrowPathIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleCreateTest}
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

      {/* Table Content */}
      <div className="flex-1 overflow-auto">
        <E2eTestsTable />
      </div>

      {/* Create Test Modal */}
      <CreateTestModal
        isOpen={isCreateModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleCreateTest}
        loading={createLoading}
      />
    </div>
  );
}

export default E2eTestsPage; 