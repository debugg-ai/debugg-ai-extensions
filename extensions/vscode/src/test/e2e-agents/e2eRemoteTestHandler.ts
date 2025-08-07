import * as fs from 'fs';
import * as path from 'path';

import { DebuggAIServerClient } from 'core/debuggAIServer/stubs/client';
import { IDE } from 'core/index';
import * as vscode from 'vscode';

import { RemoteTestHandler } from './remoteTestHandler';
import { E2eObjectCallbacks, RemoteTestHandlerOptions, RepositoryInfo, Status, TestHandlerOptions, TestObject, TestState } from './types';


/**
 * E2E Test Handler that extends RemoteTestHandler for E2E test-specific functionality.
 * This demonstrates how to properly extend the generic TestHandler with remote capabilities.
 */
export class E2esTestHandler extends RemoteTestHandler {
    public e2eObjectCallbacks: E2eObjectCallbacks;
    public repositoryInfoPromise: Promise<RepositoryInfo | null>;
    public repositoryInfo: RepositoryInfo | null;
    public testOutputDir: string = 'tests/playwright';

    constructor(
        client: DebuggAIServerClient,
        ide: IDE,
        options: TestHandlerOptions,
        remoteOptions: RemoteTestHandlerOptions = {},
        e2eObjectCallbacks: E2eObjectCallbacks,
        repositoryInfoPromise: Promise<RepositoryInfo | null> = Promise.resolve(null)
    ) {
        super(client, ide, options, remoteOptions);
        this.e2eObjectCallbacks = e2eObjectCallbacks;
        this.repositoryInfoPromise = repositoryInfoPromise;
        this.repositoryInfo = null;
    }


    protected async initialize(): Promise<void> {
        const repositoryInfo = await this.repositoryInfoPromise;
        if (repositoryInfo) {
            this.repositoryInfo = repositoryInfo;
        }
    }

    /**
     * Get parameters for remote test creation.
     */
    protected getParams(): Record<string, any> {
        return {
            branchName: this.repositoryInfo?.branchName ?? "",
            ...this.options.testParams,
            filePath: this.repositoryInfo?.filePath ?? "",
            repoName: this.repositoryInfo?.repoName ?? "",
            repoPath: this.repositoryInfo?.repoPath ?? ""
        };
    }

    protected getDescription(): string {
        return this.options.testParams?.description ?? "E2E Test";
    }

    /**
     * Create the object that is being tested.
     */
    protected async createTestObject(): Promise<TestObject> {
        // Create E2E test suite
        const testObject = await this.e2eObjectCallbacks.createObject(this.getDescription(), this.getParams());

        if (!testObject.object) {
            return {
                uuid: testObject.uuid,
                description: 'No object created',
                object: null,
                status: "failed"
            };
        }

        // we need to pull out the tunnel information from the test object
        const tunnelKey = testObject.object.tunnelKey;
        if (tunnelKey) {
            this.remoteOptions.remoteTunnelKey = tunnelKey;
            this.remoteOptions.remoteTunnelUrl = `${testObject.object.key}.ngrok.debugg.ai`;
        }

        return testObject;
    }

    /**
     * Poll for updates on the test object.
     */
    protected async pollForUpdates(): Promise<TestState> {
        try {
            const obj = await this.getTestObject();
            if (!obj) {
                const errorMsg = "❌ Test object is null or undefined during polling. Cannot continue.";
                console.error(errorMsg);
                throw new Error(errorMsg);
            }

            const polledUpdate = await this.e2eObjectCallbacks.pollObject(obj.uuid);
            if (!polledUpdate) {
                const errorMsg = "❌ Failed to poll for test updates. Server may be unreachable.";
                console.error(errorMsg);
                throw new Error(errorMsg);
            }
            console.log(`📡 Polled E2E test object successfully`);
            this.setTestObject(polledUpdate);
            console.log(`📡 Updated test object successfully`);

            console.log(`📡 Polled udpate: ${polledUpdate}`);
            // Calculate / derive the new state...
            // we need: status, current step, parsed text update

            console.log(`📡 Parsing status from object: ${this.testState}`);
            const testState = this.e2eObjectCallbacks.parseStatusFromObject(this.testState, polledUpdate);

            if (!testState) {
                console.log(`📡 No new step found. Returning current state.`);
                return this.testState;
            }
            console.log(`📡 New state created from poll. Updating state.`);

            this.testState = testState;
            
            // Check for error status and handle it
            if (this.testState.status === "error") {
                const errorMsg = `❌ Test entered error state. Terminating test run.`;
                console.error(errorMsg);
                await this.cleanupError("Test entered error state");
                throw new Error(errorMsg);
            }

            if (this.testState.status === "completed" || this.testState.status === "failed") {
                console.log(`📡 E2E test completed. Handling completion.`);
                this.handleCompletion(this.testState, `http://localhost:${this.remoteOptions.localTunnelPort}`);
            }
            return this.testState;
        } catch (error) {
            const errorMsg = `❌ Error during polling: ${error instanceof Error ? error.message : String(error)}`;
            console.error(errorMsg);
            
            // Mark test as failed and stop polling
            this.testState = {
                ...this.testState,
                status: "error",
                completed: true
            };
            
            // Ensure cleanup occurs
            await this.cleanupError(error instanceof Error ? error.message : String(error));
            throw error;
        }
    }

    /**
     * Handle E2E test completion.
     */
    protected async handleCompletion(state: TestState, originalBaseUrl?: string): Promise<void> {
        // Add completion step
        const updatedState = {
            ...state,
            steps: [...state.steps, {
                label: "E2E Completed",
                status: "success" as Status,
                details: "All tests finished",
                currentState: {
                    evaluationPreviousGoal: "",
                    memory: "",
                    nextGoal: ""
                },
                action: []
            }]
        };

        // Use parent completion handler
        await super.handleCompletion(updatedState, originalBaseUrl);

        // E2E-specific completion logic
        if (this.testState.status === "success" || this.testState.status === "completed") {
            vscode.window.showInformationMessage(`E2E test suite completed successfully!`);
        } else {
            vscode.window.showWarningMessage(`E2E test suite completed with issues.`);
        }
    }

    /**
     * Ensure the test output directory exists
     */
    private async ensureTestOutputDir(workspaceDirs: string[]): Promise<void> {
        try {
            // const workspaceDirs = await this.ide.getWorkspaceDirs();
            if (workspaceDirs.length > 0) {
                const workspaceDir = workspaceDirs[0] ? workspaceDirs[0].replace("file://", "") : "";
                const fullPath = path.join(workspaceDir, this.testOutputDir);
                await fs.promises.mkdir(fullPath, { recursive: true });
            }
        } catch (error) {
            console.error('[E2eTestHandler] Error creating test output directory:', error);
        }
    }


    /**
     * Save a test file to the test output directory
     */
    public async saveTestFile(workspaceDirs: string[], testFile: { name: string, content: string, testName?: string }): Promise<string | null> {
        try {
            console.log("Saving test file - ", testFile.name);
            console.log("Workspace dirs - ", workspaceDirs);
            const wrkDir = workspaceDirs[0] ? workspaceDirs[0].replace("file://", "") : "";
            console.log("UpdatedWorkspace dir - ", wrkDir);

            // Decode the workspace directory
            const decodedWrkDir = decodeURIComponent(wrkDir);
            console.log("Decoded string url - ", decodedWrkDir);

            await this.ensureTestOutputDir([decodedWrkDir]);

            let filePath = "";
            if (testFile.testName) {
                filePath = path.join(decodedWrkDir, this.testOutputDir, testFile.testName, testFile.name);
                await fs.promises.mkdir(path.join(decodedWrkDir, this.testOutputDir, testFile.testName), { recursive: true });
            } else {
                filePath = path.join(decodedWrkDir, this.testOutputDir, testFile.name);
            }

            // Ensure the file has a proper extension
            if (!path.extname(testFile.name)) {
                testFile.name += '.js'; // Default to JavaScript
            }

            await fs.promises.writeFile(filePath, testFile.content, 'utf8');

            console.log(`[E2eTestHandler] Saved test file: ${testFile.name} to ${filePath}`);
            return filePath;

        } catch (error) {
            console.error('[E2eTestHandler] Error saving test file:', error);
            return null;
        }
    }

}

export default E2esTestHandler; 