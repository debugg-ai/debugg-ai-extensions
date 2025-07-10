import { DebuggAIServerClient } from 'core/debuggAIServer/stubs/client';
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

    constructor(
        client: DebuggAIServerClient,
        options: TestHandlerOptions,
        remoteOptions: RemoteTestHandlerOptions = {},
        e2eObjectCallbacks: E2eObjectCallbacks,
        repositoryInfoPromise: Promise<RepositoryInfo | null> = Promise.resolve(null)
    ) {
        super(client, options, remoteOptions);
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
            ...this.options.testParams,
            filePath: this.repositoryInfo?.filePath ?? "",
            repoName: this.repositoryInfo?.repoName ?? "",
            branchName: this.repositoryInfo?.branchName ?? "",
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

        // we need to pull out the tunnel information from the test object
        const tunnelKey = testObject.object.tunnelKey;
        if (tunnelKey) {
            this.remoteOptions.remoteTunnelKey = tunnelKey;
            this.remoteOptions.remoteTunnelUrl = `${tunnelKey}.ngrok.debugg.ai`;
        }

        return testObject;
    }

    /**
     * Poll for updates on the test object.
     */
    protected async pollForUpdates(): Promise<TestState> {
        const obj = await this.getTestObject();
        if (!obj) {
            return this.testState;
        }

        const polledUpdate = await this.e2eObjectCallbacks.pollObject(obj.uuid);
        if (!polledUpdate) {
            return this.testState;
        }
        this.setTestObject(polledUpdate);

        // Calculate / derive the new state...
        // we need: status, current step, parsed text update
        const step = this.e2eObjectCallbacks.parseStatusFromObject(this.testState, polledUpdate);

        // Update the state for listeners
        this.testState.steps = this.testState.handlePollUpdate(this.testState.steps, step);
        this.testState.stepNumber = this.testState.steps.length;
        this.testState.status = step.status;

        if (this.testState.status === "completed" || this.testState.status === "failed") {
            this.handleCompletion(this.testState);
        }
        return this.testState;
    }

    /**
     * Handle E2E test completion.
     */
    protected async handleCompletion(state: TestState): Promise<void> {
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
        await super.handleCompletion(updatedState);

        // E2E-specific completion logic
        if (this.testState.status === "success") {
            vscode.window.showInformationMessage(`E2E test suite completed successfully!`);
        } else {
            vscode.window.showWarningMessage(`E2E test suite completed with issues.`);
        }
    }

}

export default E2esTestHandler; 