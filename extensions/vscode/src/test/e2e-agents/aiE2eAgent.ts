// Central manager class to handle the AI agent for E2E test runs, suites, etc.

import { DebuggAIServerClient } from "core/debuggAIServer/stubs/client";
import { E2eRun, E2eTest, E2eTestCommitSuite, E2eTestSuite } from "core/debuggAIServer/types";
import { IDE } from "core/index";
import * as http from 'http';
import * as vscode from 'vscode';

import E2eRemoteTestHandler from "./e2eRemoteTestHandler";
import { E2eObjectCallbacks, RepositoryInfo, Status, TerminalTest, TestHandlerOptions, TestObject, TestState, handlePollUpdateFn } from "./types";

// Type guard functions for safe casting
function isE2eTest(obj: any): obj is E2eTest {
    return obj && typeof obj === 'object' && 'uuid' in obj && 'name' in obj && 'testScript' in obj;
}

function isE2eTestSuite(obj: any): obj is E2eTestSuite {
    return obj && typeof obj === 'object' && 'uuid' in obj && 'name' in obj && typeof obj.completed === 'boolean';
}

function isE2eTestCommitSuite(obj: any): obj is E2eTestCommitSuite {
    return obj && typeof obj === 'object' && 'uuid' in obj && 'runStatus' in obj && 'tests' in obj && Array.isArray(obj.tests);
}

function isE2eRun(obj: any): obj is E2eRun {
    return obj && typeof obj === 'object' && 'uuid' in obj && 'status' in obj && 'outcome' in obj;
}


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
    public testHandler: E2eRemoteTestHandler | null;
    public testObjectType: TestObjectType;
    public ide: IDE;
    private serviceActive: boolean = false;

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
        this.testHandler = null; // Will be set up after service check
    }

    /**
     * Check if the local service is active on the specified port
     */
    private async checkServiceActive(port: number): Promise<boolean> {
        return new Promise((resolve) => {
            const request = http.request({
                hostname: 'localhost',
                port: port,
                method: 'GET',
                timeout: 5000, // 5 second timeout
            }, (response) => {
                // If we get any response, the service is active
                resolve(true);
            });

            request.on('error', (error) => {
                // Service is not active or not responding
                console.log(`Service check on port ${port} failed:`, error.message);
                resolve(false);
            });

            request.on('timeout', () => {
                console.log(`Service check on port ${port} timed out`);
                request.destroy();
                resolve(false);
            });

            request.end();
        });
    }

    /**
     * Initialize the agent by checking service status and setting up test handler
     */
    async initialize(): Promise<boolean> {
        // Check if the local service is active
        console.log(`🔍 Checking if service is active on port ${this.agentOptions.localServerPort}...`);
        this.serviceActive = await this.checkServiceActive(this.agentOptions.localServerPort);

        if (!this.serviceActive) {
            const errorMessage = `❌ Service is not active on port ${this.agentOptions.localServerPort}. Please start your application server before running E2E tests.`;
            console.error(errorMessage);
            throw new Error(errorMessage);
        }

        console.log(`✅ Service is active on port ${this.agentOptions.localServerPort}`);

        // Now set up the test handler since service is active
        this.testHandler = this.setupTestHandler();
        return true;
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

    /**
     * Run the E2E test after ensuring service is active
     */
    async run(): Promise<void> {
        if (!this.serviceActive) {
            const initialized = await this.initialize();
            if (!initialized) {
                return; // Service check failed, don't proceed
            }
        }

        if (!this.testHandler) {
            throw new Error('Test handler not initialized. Please call initialize() first.');
        }

        await this.testHandler.run();
    }

    /**
     * Check if the agent is ready to run tests
     */
    isReady(): boolean {
        return this.serviceActive && this.testHandler !== null;
    }

    /**
     * Check if test is currently running
     */
    isTestRunning(): boolean {
        return this.testHandler?.isTestRunning() ?? false;
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
                break;
            case "test-suite":
                func = client?.createE2eTestSuite;
                break;
            case "commit-suite":
                func = client?.createE2eCommitSuite;
                break;
            default:
                throw new Error(`Unknown test object type: ${testObjectType}`);
        }
        return async (description?: string, params?: Record<string, any>) => {
            try {
                if (!func) {
                    throw new Error(`No create function available for test object type: ${testObjectType}`);
                }
                const result = await func(description ?? "", params);
                if (!result) {
                    throw new Error(`Failed to create ${testObjectType}: No result returned from server`);
                }
                if (!result.uuid) {
                    throw new Error(`Failed to create ${testObjectType}: Missing UUID in response`);
                }

                let status = "running";
                switch (testObjectType) {
                    case "commit-suite":
                        if (isE2eTestCommitSuite(result)) {
                            status = result.runStatus;
                        } else {
                            console.warn("Expected E2eTestCommitSuite but received different type");
                            status = "error";
                        }
                        break;
                    case "e2e-test":
                        status = "running";
                        break;
                    case "test-suite":
                        // For these types, default to "running" status on creation
                        status = "running";
                        break;
                    default:
                        status = "running";
                        break;
                }

                return {
                    uuid: result.uuid,
                    description: result.description || (result as any).name || "",
                    status: status as Status,
                    object: result
                };
            } catch (error) {
                console.error(`Error creating ${testObjectType}:`, error);
                throw error;
            }
        };
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
                break;
            case "test-suite":
                func = client?.getE2eTestSuite;
                break;
            case "commit-suite":
                func = client?.getE2eCommitSuite;
                break;
            default:
                throw new Error(`Unknown test object type: ${testObjectType}`);
        }
        return async (uuid: string, params?: Record<string, any>) => {
            try {
                if (!func) {
                    throw new Error(`No poll function available for test object type: ${testObjectType}`);
                }
                if (!uuid) {
                    throw new Error(`UUID is required to poll ${testObjectType}`);
                }

                const result = await func(uuid, params);
                if (!result) {
                    throw new Error(`Failed to poll ${testObjectType} with UUID ${uuid}: No result returned from server`);
                }
                if (!result.uuid) {
                    throw new Error(`Failed to poll ${testObjectType}: Missing UUID in response`);
                }

                let status = "running";
                switch (testObjectType) {
                    case "e2e-test":
                        if (isE2eTest(result)) {
                            status = result.curRun?.status ?? "running";
                        } else {
                            console.warn("Expected E2eTest but received different type");
                            status = "error";
                        }
                        break;
                    case "test-suite":
                        if (isE2eTestSuite(result)) {
                            status = result.completed ? "completed" : "running";
                        } else {
                            console.warn("Expected E2eTestSuite but received different type");
                            status = "error";
                        }
                        break;
                    case "commit-suite":
                        if (isE2eTestCommitSuite(result)) {
                            status = result.runStatus;
                        } else {
                            console.warn("Expected E2eTestCommitSuite but received different type");
                            status = "error";
                        }
                        break;
                    default:
                        status = "running";
                        break;
                }
                console.log(`📡 Polled E2E object status: ${status}`);
                return {
                    uuid: result.uuid,
                    description: result.description || (result as any).name || "",
                    status: status as Status,
                    object: result
                };
            } catch (error) {
                console.error(`Error polling ${testObjectType} with UUID ${uuid}:`, error);
                throw error;
            }
        };
    }

    /**
     * Set up repository information.
     */
    private async setupRepositoryInfo(): Promise<RepositoryInfo> {
        try {

            if (!this.agentOptions.repositoryInfo) {
                this.agentOptions.repositoryInfo = {
                    repoName: "",
                    repoPath: "",
                    branchName: "",
                    filePath: ""
                };
            }
            const workspaceDirs = await this.ide.getWorkspaceDirs();
            if (workspaceDirs.length === 0) {
                throw new Error("No workspace directories found. Please open a workspace in the editor to run E2E tests.");
            }
            const workspaceDir = workspaceDirs[0] ? workspaceDirs[0].replace("file://", "") : "";
            let filePath = "";
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                console.info("No file open. Using workspace directory instead.");
                filePath = workspaceDir;
            } else {
                filePath = editor.document.uri.fsPath;
                if (!filePath) {
                    console.info("No file path found for file. Using workspace directory instead.");
                    filePath = workspaceDir;
                }
            }

            const { repoName, repoPath, branchName } = await this.client.getRepoInfo(filePath);
            if (!repoName || !repoPath || !branchName) {
                throw new Error(`File "${filePath}" is not associated with a Git repository or repository information could not be retrieved.`);
            }

            this.agentOptions.repositoryInfo.repoName = repoName;
            this.agentOptions.repositoryInfo.repoPath = repoPath;
            this.agentOptions.repositoryInfo.branchName = branchName;
            this.agentOptions.repositoryInfo.filePath = filePath;

            console.log(`📁 Repository info: ${repoName} (${branchName}) at ${repoPath}`);
            return this.agentOptions.repositoryInfo;
        } catch (error) {
            console.error("Error setting up repository information:", error);
            throw error;
        }
    }

    private parseStatusFromObject(testObjectType: TestObjectType): (prevState: TestState, updatedObj: TestObject) => TestState {
        console.log(`📡 Parsing status from object: ${testObjectType}`);
        const parseFunction = (prevState: TestState, updatedObj: TestObject) => {
            try {
                if (!updatedObj) {
                    console.warn("Received null or undefined test object");
                    return {
                        ...prevState,
                        status: "error" as Status
                    };
                }

                switch (testObjectType) {
                    case "e2e-test":
                        return this.parseUpdateForE2eTest(prevState, updatedObj);
                    case "test-suite":
                        return this.parseUpdateForE2eTestSuite(prevState, updatedObj);
                    case "commit-suite":
                        return this.parseUpdateForE2eCommitSuite(prevState, updatedObj);
                    default:
                        console.error(`Unknown test object type in parsing: ${testObjectType}`);
                        return {
                            ...prevState,
                            status: "error" as Status
                        };
                }
            } catch (error) {
                console.error(`Error parsing status for ${testObjectType}:`, error);
                return {
                    ...prevState,
                    status: "error" as Status
                };
            }
        };
        return parseFunction;
    }

    private parseUpdateForE2eTest(prevState: TestState, updatedObj: TestObject): TestState {
        // Handle both E2eTest and E2eRun objects
        let updatedRun: E2eRun | null = null;

        if (isE2eRun(updatedObj.object)) {
            // Direct E2eRun object
            updatedRun = updatedObj.object;
        } else if (isE2eTest(updatedObj.object)) {
            // E2eTest object - extract the current run
            updatedRun = updatedObj.object.curRun || null;
            if (!updatedRun) {
                console.log("E2eTest received but no current run available yet");
                return {
                    ...prevState,
                    testObject: updatedObj,
                    status: "pending" as Status
                };
            }
        } else {
            const errorMsg = `Expected E2eRun or E2eTest but received different type in parseUpdateForE2eTest. Received object with keys: ${Object.keys(updatedObj.object || {}).join(', ')}`;
            console.error(errorMsg);
            throw new Error(errorMsg);
        }

        console.log(`📡 Polled E2E run status: ${updatedRun.status}`);

        const test = updatedObj.object as E2eTest;
        // Convert E2eTest objects to TerminalTest objects
        const tests: TerminalTest = {
            uuid: test.uuid,
            description: test.description || test.name || "",
            title: test.name || "",
            status: test.curRun?.status || 'pending',
            outcome: test.curRun?.outcome || 'pending',
            object: test,
            steps: test.curRun?.conversations?.[0]?.messages?.map(message => ({
                label: message.jsonContent?.currentState?.memory ?? "",
                status: message.jsonContent?.currentState?.evaluationPreviousGoal ?
                    message.jsonContent.currentState.evaluationPreviousGoal.split(" - ")[0]?.trim().toLowerCase() as Status :
                    "pending",
                details: message.jsonContent?.currentState?.memory,
                currentState: message.jsonContent?.currentState || {
                    evaluationPreviousGoal: "",
                    memory: "",
                    nextGoal: ""
                },
                action: message.jsonContent?.action || []
            })) ?? [], // Initialize empty steps array for each test
            handlePollUpdate: handlePollUpdateFn
        };

        const status = updatedRun?.status || prevState.status;
        const completed = status === 'completed';

        // Create a new TestState object with updated information
        return {
            testObject: updatedObj,
            testResults: null, // No results yet for commit suites
            stepNumber: prevState.stepNumber,
            completed: completed,
            status: status as Status,
            tests: [tests],
            steps: prevState.steps, // Keep existing steps
            handlePollUpdate: prevState.handlePollUpdate
        };
    }

    private parseUpdateForE2eTestSuite(prevState: TestState, updatedObj: TestObject): TestState {
        if (!isE2eTestSuite(updatedObj.object)) {
            const errorMsg = `Expected E2eTestSuite but received different type in parseUpdateForE2eTestSuite. Received object with keys: ${Object.keys(updatedObj.object || {}).join(', ')}`;
            console.error(errorMsg);
            throw new Error(errorMsg);
        }
        const updatedSuite = updatedObj.object;

        console.log(`📡 Polled E2E suite status: ${updatedSuite.completed}`);
        const status = updatedSuite.completed ? "completed" : "running";

        // Convert E2eTest objects to TerminalTest objects
        const tests: TerminalTest[] = (updatedSuite.tests || []).map(test => ({
            uuid: test.uuid,
            description: test.description || test.name || "",
            title: test.name || "",
            status: test.curRun?.status || 'pending',
            outcome: test.curRun?.outcome || 'pending',
            object: test,
            steps: test.curRun?.conversations?.[0]?.messages?.map(message => ({
                label: message.jsonContent?.currentState?.memory ?? "",
                status: message.jsonContent?.currentState?.evaluationPreviousGoal ?
                    message.jsonContent.currentState.evaluationPreviousGoal.split(" - ")[0]?.trim().toLowerCase() as Status :
                    "pending",
                details: message.jsonContent?.currentState?.memory,
                currentState: message.jsonContent?.currentState || {
                    evaluationPreviousGoal: "",
                    memory: "",
                    nextGoal: ""
                },
                action: message.jsonContent?.action || []
            })) ?? [], // Initialize empty steps array for each test
            handlePollUpdate: handlePollUpdateFn
        }));

        // Create a new TestState object with updated information
        return {
            testObject: updatedObj,
            testResults: null, // No results yet for commit suites
            stepNumber: prevState.stepNumber,
            completed: updatedSuite.completed ?? false,
            status: status as Status,
            tests: tests,
            steps: prevState.steps, // Keep existing steps
            handlePollUpdate: prevState.handlePollUpdate
        };

    }

    private parseUpdateForE2eCommitSuite(prevState: TestState, updatedObj: TestObject): TestState {
        if (!isE2eTestCommitSuite(updatedObj.object)) {
            const errorMsg = `Expected E2eTestCommitSuite but received different type in parseUpdateForE2eCommitSuite. Received object with keys: ${Object.keys(updatedObj.object || {}).join(', ')}`;
            console.error(errorMsg);
            throw new Error(errorMsg);
        }
        const updatedCommitSuite = updatedObj.object;
        console.log(`📡 Polled E2E commit suite: ${updatedCommitSuite.uuid}`);

        console.log(`📡 Polled E2E commit suite status: ${updatedCommitSuite.runStatus}`);

        // Convert E2eTest objects to TerminalTest objects
        const tests: TerminalTest[] = (updatedCommitSuite.tests || []).map(test => ({
            uuid: test.uuid,
            description: test.description || test.name || "",
            title: test.name || "",
            status: test.curRun?.status || 'pending',
            outcome: test.curRun?.outcome || 'pending',
            object: test,
            steps: test.curRun?.conversations?.[0]?.messages?.map(message => ({
                label: message.jsonContent?.currentState?.memory ?? "",
                status: message.jsonContent?.currentState?.evaluationPreviousGoal ?
                    message.jsonContent.currentState.evaluationPreviousGoal.split(" - ")[0]?.trim().toLowerCase() as Status :
                    "pending",
                details: message.jsonContent?.currentState?.memory,
                currentState: message.jsonContent?.currentState || {
                    evaluationPreviousGoal: "",
                    memory: "",
                    nextGoal: ""
                },
                action: message.jsonContent?.action || []
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
            status: status as Status,
            tests: tests,
            steps: prevState.steps, // Keep existing steps
            handlePollUpdate: prevState.handlePollUpdate
        };
    }
}