// Central manager class to handle the AI agent for E2E test runs, suites, etc.

import { DebuggAIServerClient } from "core/debuggAIServer/stubs/client";
import { E2eRun, E2eTest, E2eTestCommitSuite, E2eTestSuite } from "core/debuggAIServer/types";
import { IDE } from "core/index";
import * as vscode from 'vscode';
import E2eRemoteTestHandler from "./e2eRemoteTestHandler";
import { E2eObjectCallbacks, RepositoryInfo, Status, Step, TerminalTest, TestHandlerOptions, TestObject, TestState, handlePollUpdateFn } from "./types";


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
    public testObjectType: TestObjectType;
    public ide: IDE;

    constructor(client: DebuggAIServerClient, ide: IDE, options: AiE2eAgentOptions) {
        this.client = client;
        this.ide = ide;
        this.testObjectType = options.testObjectType;
        this.agentOptions = options;
        this.objectCallbacks = {
            createObject: this.getClientCreateFunction(this.testObjectType, options.testRunType),
            pollObject: this.getClientPollFunction(this.testObjectType, options.testRunType),
            parseStatusFromObject: this.parseStatusFromObject(this.testObjectType)
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
            this.ide,
            { ...this.agentOptions },
            { localTunnelPort: this.agentOptions.localServerPort },
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
            console.log(`📡 Polled E2E object status: ${status}`);
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

    private parseStatusFromObject(testObjectType: TestObjectType): (prevState: TestState, updatedObj: TestObject) => TestState {
        console.log(`📡 Parsing status from object: ${testObjectType}`);
        const parseFunction = (prevState: TestState, updatedObj: TestObject) => {
            switch (testObjectType) {
                case "e2e-test":
                    return this.parseUpdateForE2eTest(prevState, updatedObj);
                case "test-suite":
                    return this.parseUpdateForE2eTestSuite(prevState, updatedObj);
                case "commit-suite":
                    return this.parseUpdateForE2eCommitSuite(prevState, updatedObj);
            }
        }
        return parseFunction;
    }

    private parseUpdateForE2eTest(prevState: TestState, updatedObj: TestObject): TestState {
        const updatedRun = updatedObj.object as E2eRun;
        if (!updatedRun) return {
            ...prevState,
            testObject: updatedObj,
            status: "pending"
        };

        console.log(`📡 Polled E2E run status: ${updatedRun.status}`);

        // Create a new step from the current run data
        let currentStep: Step = {
            label: "E2E Test",
            status: "pending",
            currentState: {
                evaluationPreviousGoal: "",
                memory: "",
                nextGoal: ""
            },
            action: []
        };

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
                    currentStep = {
                        label: prevStepMessage,
                        status: stepStatus as Status,
                        details: stepMessage,
                        currentState: actionFmt.currentState,
                        action: actionFmt.action
                    };
                } else if (stepMessage) {
                    currentStep = {
                        label: stepMessage,
                        status: 'pending',
                        details: stepMessage,
                        currentState: actionFmt.currentState,
                        action: actionFmt.action
                    };
                }
            }
        }

        // Update steps using the handlePollUpdate function
        const updatedSteps = prevState.handlePollUpdate(prevState.steps, currentStep);

        return {
            ...prevState,
            testObject: updatedObj,
            status: updatedRun.status,
            completed: updatedRun.status === 'completed',
            steps: updatedSteps
        };
    }

    private parseUpdateForE2eTestSuite(prevState: TestState, updatedObj: TestObject): TestState {
        const updatedSuite = updatedObj.object as E2eTestSuite;
        if (!updatedSuite) return {
            ...prevState,
            testObject: updatedObj,
            status: "pending"
        };

        console.log(`📡 Polled E2E suite status: ${updatedSuite.completed}`);
        const status = updatedSuite.completed ? "completed" : "running";
        
        // Create a step for the suite status
        const currentStep: Step = {
            label: "E2E Test Suite",
            status: status,
            details: `Suite ${updatedSuite.completed ? "completed" : "running"}`,
            currentState: {
                evaluationPreviousGoal: "",
                memory: "",
                nextGoal: ""
            },
            action: []
        };

        // Update steps using the handlePollUpdate function
        const updatedSteps = prevState.handlePollUpdate(prevState.steps, currentStep);

        return {
            ...prevState,
            testObject: updatedObj,
            status: status,
            completed: updatedSuite.completed || false,
            steps: updatedSteps
        };
    }

    private parseUpdateForE2eCommitSuite(prevState: TestState, updatedObj: TestObject): TestState {
        const updatedCommitSuite = updatedObj.object as E2eTestCommitSuite;
        console.log(`📡 Polled E2E commit suite: ${updatedCommitSuite}`);
        if (!updatedCommitSuite) return {
            ...prevState,
        };
        
        console.log(`📡 Polled E2E commit suite status: ${updatedCommitSuite.runStatus}`);

        // Convert E2eTest objects to TerminalTest objects
        const tests: TerminalTest[] = updatedCommitSuite.tests.map(test => ({
            uuid: test.uuid,
            description: test.description || test.name,
            title: test.name,
            status: test.curRun?.status || 'pending',
            outcome: test.curRun?.outcome || 'pending',
            object: test,
            steps: test.curRun?.conversations?.[0]?.messages?.map(message => ({
                label: message.jsonContent?.currentState?.memory ?? "",
                status: message.jsonContent?.currentState?.evaluationPreviousGoal ? message.jsonContent.currentState.evaluationPreviousGoal.split(" - ")[0]?.trim().toLowerCase() : "pending",
                details: message.jsonContent?.currentState?.memory,
                currentState: message.jsonContent?.currentState,
                action: message.jsonContent?.action
            })) ?? [], // Initialize empty steps array for each test
            handlePollUpdate: handlePollUpdateFn
        }));

        // Determine overall status based on commit suite status
        const status = updatedCommitSuite.runStatus;
        const completed = status === 'completed';

        // Create a new TestState object with updated information
        return {
            testObject: updatedObj,
            testResults: null, // No results yet for commit suites
            stepNumber: prevState.stepNumber,
            completed: completed,
            status: status,
            tests: tests,
            steps: prevState.steps, // Keep existing steps
            handlePollUpdate: prevState.handlePollUpdate
        };
    }
}