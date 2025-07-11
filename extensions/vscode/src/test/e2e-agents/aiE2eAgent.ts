// Central manager class to handle the AI agent for E2E test runs, suites, etc.

import { DebuggAIServerClient } from "core/debuggAIServer/stubs/client";
import { E2eRun, E2eTest, E2eTestCommitSuite, E2eTestSuite } from "core/debuggAIServer/types";
import * as vscode from 'vscode';
import E2eRemoteTestHandler from "./e2eRemoteTestHandler";
import { E2eObjectCallbacks, RepositoryInfo, Status, Step, TestHandlerOptions, TestObject, TestState } from "./types";


export type TestObjectType = "e2e-test" | "test-suite" | "commit-suite";
export type TestRunType = "run" | "generate";  // run = run a test, generate = generate new tests

export interface AiE2eAgentOptions extends TestHandlerOptions {
    testObjectType: TestObjectType;
    testRunType: TestRunType;  // run = run a test, generate = generate new tests
    remote: boolean;
    localServerPort: number;
    repositoryInfo?: RepositoryInfo;
}


export class AiE2eAgent {
    private client: DebuggAIServerClient;
    private agentOptions: AiE2eAgentOptions;
    private objectCallbacks: E2eObjectCallbacks;
    public testHandler: E2eRemoteTestHandler;

    constructor(client: DebuggAIServerClient, options: AiE2eAgentOptions) {
        this.client = client;
        this.agentOptions = options;
        this.objectCallbacks = {
            createObject: this.getClientCreateFunction(options.testObjectType, options.testRunType),
            pollObject: this.getClientPollFunction(options.testObjectType, options.testRunType),
            parseStatusFromObject: this.parseStatusFromObject
        };
        this.testHandler = this.setupTestHandler();
    }

    /**
     * Setup the test handler.
     * 
     * Because we want to be flexible in the object and test types
     * this class manages, we need to pass in a callback to create the object.
     */
    private setupTestHandler(): E2eRemoteTestHandler {
        const handler = new E2eRemoteTestHandler(
            this.client, 
            {...this.agentOptions}, 
            {localTunnelPort: this.agentOptions.localServerPort}, 
            this.objectCallbacks,
            this.setupRepositoryInfo()
        );
        return handler;
    }

    private getClientCreateFunction(testObjectType: TestObjectType, testRunType: TestRunType): (description?: string, params?: Record<string, any>) => Promise<TestObject> {
        const client = this.client.e2es;
        let func;
        if (!client) {
            throw new Error("Client not found");
        }
        switch (testObjectType) {
            case "e2e-test":
                func = client?.createE2eTest;
            case "test-suite":
                func = client?.createE2eTestSuite;
            case "commit-suite":
                func = client?.createE2eCommitSuite;
        }
        return async (description?: string, params?: Record<string, any>) => {
            const result = await func?.(description ?? "", params);
            if (!result) {
                throw new Error("Failed to create object");
            }
            let status = "running";
            switch (testObjectType) {
                case "commit-suite":
                    status = (result as unknown as E2eTestCommitSuite).runStatus;
                    break;
            }
            return {
                uuid: result.uuid,
                description: result.description,
                status: result.runStatus,
                object: result
            };
        }
    }

    private getClientPollFunction(testObjectType: TestObjectType, testRunType: TestRunType): (uuid: string, params?: Record<string, any>) => Promise<TestObject> {
        const client = this.client.e2es;
        let func;
        if (!client) {
            throw new Error("Client not found");
        }
        switch (testObjectType) {
            case "e2e-test":
                func = client?.getE2eTest;
            case "test-suite":
                func = client?.getE2eTestSuite;
            case "commit-suite":
                func = client?.getE2eCommitSuite;
        }
        return async (uuid: string, params?: Record<string, any>) => {
            const result = await func?.(uuid, params);
            if (!result) {
                throw new Error("Failed to poll object");
            }
            let status = "success";
            switch (testObjectType) {
                case "e2e-test":
                    status = (result as unknown as E2eTest).curRun?.status ?? "running";
                case "test-suite":
                    status = (result as unknown as E2eTestSuite).completed ? "completed" : "running";
                case "commit-suite":
                    status = (result as unknown as E2eTestCommitSuite).runStatus;
            }
            return {
                uuid: result.uuid,
                description: result.description,
                status: status as Status,
                object: result
            };
        }
    }

    /**
     * Set up repository information.
     */
    private async setupRepositoryInfo(): Promise<RepositoryInfo> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            throw new Error("No file open.");
        }

        if (!this.agentOptions.repositoryInfo) {
            this.agentOptions.repositoryInfo = {
                repoName: "",
                repoPath: "",
                branchName: "",
                filePath: ""
            };
        }
        const filePath = editor.document.uri.fsPath;

        const { repoName, repoPath, branchName } = await this.client.getRepoInfo(filePath);
        if (!repoName || !repoPath || !branchName) {
            throw new Error("File not found or not associated with a repo.");
        }

        this.agentOptions.repositoryInfo.repoName = repoName;
        this.agentOptions.repositoryInfo.repoPath = repoPath;
        this.agentOptions.repositoryInfo.branchName = branchName;
        this.agentOptions.repositoryInfo.filePath = filePath;
        return this.agentOptions.repositoryInfo;
    }

    private parseStatusFromObject(prevState: TestState, updatedObj: TestObject): Step {
        switch (this.agentOptions?.testObjectType) {
            case "e2e-test":
                return this.parseUpdateForE2eTest(prevState, updatedObj);
            case "test-suite":
                return this.parseUpdateForE2eTestSuite(prevState, updatedObj);
            case "commit-suite":
                return this.parseUpdateForE2eCommitSuite(prevState, updatedObj);
        }
    }

    private parseUpdateForE2eTest(prevState: TestState, updatedObj: TestObject): Step {
        const updatedRun = updatedObj.object as E2eRun;
        if (!updatedRun) return {
            label: "E2E Test",
            status: "pending",
            details: "No test object",
            currentState: {
                evaluationPreviousGoal: "",
                memory: "",
                nextGoal: ""
            },
            action: []
        };

        console.log(`📡 Polled E2E run status: ${updatedRun.status}`);

        // Update with the latest step status
        let prevStepMessage = "";
        const lastStep = prevState.stepNumber;  // Haven't updated yet, so this is the last step

        if (lastStep > 0) {
            // Need to check for the last step info to see if it was successful or not
            const prevStep = updatedRun.conversations?.[0]?.messages?.[lastStep - 1];
            if (prevStep) {
                const prevStepMessageContent = prevStep.jsonContent;
                if (prevStepMessageContent) {
                    const prevActionFmt = prevStepMessageContent as Step;
                    prevStepMessage = prevActionFmt.currentState.memory;
                }
            }
        }
        // Process the current step
        const stepMessage = updatedRun.conversations?.[0]?.messages?.[lastStep];
        if (stepMessage) {
            const stepMessageContent = stepMessage.jsonContent;
            if (stepMessageContent) {
                const actionFmt = stepMessageContent as Step;
                const stepMessage = actionFmt.currentState.memory;
                const stepStatus = actionFmt.currentState.evaluationPreviousGoal ? actionFmt.currentState.evaluationPreviousGoal.split(" - ")[0]?.trim().toLowerCase() : "pending";
                if (stepStatus && prevStepMessage) {
                    // formatter.updateStep(prevStepMessage, stepStatus as any);
                    return {
                        label: prevStepMessage,
                        status: stepStatus as Status,
                        details: stepMessage,
                        currentState: actionFmt.currentState,
                        action: actionFmt.action
                    };
                }
                if (stepMessage) {
                    // formatter.updateStep(stepMessage, 'pending');
                    return {
                        label: stepMessage,
                        status: 'pending',
                        details: stepMessage,
                        currentState: actionFmt.currentState,
                        action: actionFmt.action
                    };
                }
            }
        }
        return {
            label: "E2E Test",
            status: "pending",
            currentState: {
                evaluationPreviousGoal: "",
                memory: "",
                nextGoal: ""
            },
            action: []
        };
    }

    private parseUpdateForE2eTestSuite(prevState: TestState, updatedObj: TestObject): Step {
        const updatedSuite = updatedObj.object as E2eTestSuite;
        if (!updatedSuite) return {
            label: "E2E Test Suite",
            status: "pending",
            currentState: {
                evaluationPreviousGoal: "",
                memory: "",
                nextGoal: ""
            },
            action: []
        };

        console.log(`📡 Polled E2E suite status: ${updatedSuite.completed}`);
        return {
            label: "E2E Test Suite",
            status: "pending",
            currentState: {
                evaluationPreviousGoal: "",
                memory: "",
                nextGoal: ""
            },
            action: []
        };
    }

    private parseUpdateForE2eCommitSuite(prevState: TestState, updatedObj: TestObject): Step {
        const updatedCommitSuite = updatedObj.object as E2eTestCommitSuite;
        if (!updatedCommitSuite) return {
            label: "E2E Test Commit Suite",
            status: "pending",
            details: "No commit suite object",
            currentState: {
                evaluationPreviousGoal: "",
                memory: "",
                nextGoal: ""
            },
            action: []
        };
        console.log(`📡 Polled E2E commit suite status: ${updatedCommitSuite.tests.every(test => test.curRun?.status === "completed")}`);
        return {
            label: "E2E Test Commit Suite",
            status: updatedCommitSuite.runStatus,
            details: updatedCommitSuite.description,
            currentState: {
                evaluationPreviousGoal: "",
                memory: "",
                nextGoal: ""
            },
            action: []
        };
    }
}