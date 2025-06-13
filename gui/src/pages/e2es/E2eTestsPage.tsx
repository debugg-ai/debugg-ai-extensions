import { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { E2eTestsTable } from "../../components/e2es/e2e-tests-table";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useNavigationListener } from "../../hooks/useNavigationListener";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import KeyboardShortcuts from "../More/KeyboardShortcuts";

function E2eTestsPage() {
    useNavigationListener();
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const ideMessenger = useContext(IdeMessengerContext);
    const config = useAppSelector((store) => store.config.config);
    const { disableIndexing } = config;
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

    // Placeholder for E2E tests data
    // const tests = [];
    // const loading = false;
    // const error = null;

    const handleCreateSuccess = () => {
        // Refresh the e2e tests list (placeholder)
        // dispatch(fetchE2eTests(...))
    };
    const handleCreateNewTest = () => {
        // setIsCreateDialogOpen(true);
        ideMessenger.request("ideCommand/run", {
            slashCommandName: "run-command",
            params: {
                command: "e2eTests/create",
            },
        });
    };

    return (
        <div className="overflow-y-scroll">
            <E2eTestsTable />
            {/* <PageHeader showBorder onTitleClick={() => navigate("/")} title="Testing Home" /> */}

            <div className="gap-2 divide-x-0 divide-y-2 divide-solid divide-zinc-700 px-4">
                <div className="flex justify-between items-center mb-4 mt-4">
                    {/* <h3 className="mx-auto mb-1 text-lg">E2E Test Shortcuts</h3> */}
                    {/* <button
            className="flex items-center gap-2 px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
            onClick={handleCreateNewTest}
          >
            <PlusIcon className="h-4 w-4" />
            New Test
          </button> */}
                </div>
            </div>

            <div className="gap-2 divide-x-0 divide-y-2 divide-solid divide-zinc-700 px-4 mt-6">
                <div className="py-5">
                </div>
            </div>

            {/* <div className="gap-2 divide-x-0 divide-y-2 divide-solid divide-zinc-700 px-4 mt-6">
        <div className="py-5">
          <h3 className="mb-4 mt-0 text-xl">E2E Tests Table</h3>
          <div className="border rounded p-4 text-center text-stone-500">
            E2E tests table coming soon...
          </div>
        </div>
      </div> */}

            <KeyboardShortcuts top={true} />
            {/* Placeholder for Create E2E Test Dialog */}
            {isCreateDialogOpen && (
                <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
                    <div className="bg-white dark:bg-zinc-900 rounded-lg p-8 shadow-lg min-w-[300px]">
                        <h2 className="text-xl font-bold mb-4">Create E2E Test</h2>
                        <p className="mb-4">Dialog coming soon...</p>
                        <div className="flex justify-end gap-2">
                            <button
                                className="px-4 py-2 rounded bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600"
                                onClick={() => setIsCreateDialogOpen(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
                                onClick={() => {
                                    setIsCreateDialogOpen(false);
                                    handleCreateSuccess();
                                }}
                            >
                                Create
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default E2eTestsPage; 