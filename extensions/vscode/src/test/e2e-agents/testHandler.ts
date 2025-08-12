// src/E2eTestRunner.ts
import { DebuggAIServerClient } from 'core/debuggAIServer/stubs/client';
import { fetchAndOpenGif, fetchAndOpenJson, fetchAndOpenScript } from 'core/e2es/recordingHandler';
import { IDE } from 'core/index';
import * as vscode from 'vscode';

import { TerminalFormatter } from '../terminal/terminalFormatter';

import fs from 'fs';
import path from 'path';
import { handlePollUpdateFn, TestHandlerOptions, TestObject, TestState } from './types';


/**
 * Generic base class for handling test-like processes with VS Code integration.
 * Provides hooks for subclasses to implement specific functionality.
 */
export abstract class TestHandler {
    protected static controller: vscode.TestController | undefined;
    protected client: DebuggAIServerClient;
    protected timeoutMinutes: number;
    protected vsCodeTestRun: vscode.TestRun | null = null;
    protected vsCodeTestItem: vscode.TestItem | null = null;
    protected formatter: TerminalFormatter | null = null;
    protected isRunning: boolean = false;
    protected cleanupCallbacks: (() => void)[] = [];
    protected pollingInterval: number;
    public testState: TestState;
    protected options: TestHandlerOptions;
    protected ide: IDE;
    protected testOutputDir: string;

    constructor(client: DebuggAIServerClient, ide: IDE, options: TestHandlerOptions) {
        this.ide = ide;
        this.client = client;
        this.timeoutMinutes = options.timeoutMinutes || 30;
        this.pollingInterval = options.pollingInterval || 3500;
        this.options = options;
        this.testOutputDir = options.testOutputDir || 'tests/debugg-ai';

        // Initialize state
        this.testState = {
            testObject: null,
            testResults: null,
            stepNumber: 0,
            completed: false,
            status: "pending",
            steps: [],
            tests: [],
            handlePollUpdate: handlePollUpdateFn
        };
    }

    /**
     * Initialize the test handler. Called before running any tests.
     * Subclasses should override this to set up their specific requirements.
     */
    protected abstract initialize(): Promise<void>;

    /**
     * Create the run, runs, or suite that is being tested. Subclasses must implement this.
     */
    protected abstract createTestObject(): Promise<TestObject>;

    /**
     * Get the test object by accessing the subclass's createTestObject method, unless
     * already created.
     */
    public async getTestObject(): Promise<TestObject> {
        if (!this.testState.testObject) {
            this.testState.testObject = await this.createTestObject();
        }
        if (!this.testState.testObject) {
            const errorMsg = "❌ Failed to create test object. Please check your configuration and try again.";
            // vscode.window.showErrorMessage(errorMsg);
            throw new Error(errorMsg);
        }
        return this.testState.testObject;
    }

    /**
     * Set the test object.
     * 
     * This is used to set the test object in cases where we are polling for
     * updates and may have received changes.
     */
    public setTestObject(testObject: TestObject): void {
        this.testState.testObject = testObject;
    }

    /**
     * Get the test state.
     */
    public getTestState(): TestState {
        return this.testState;
    }

    /**
     * Set up the VS Code test run and associated metadata.
     * Subclasses can override this to customize the test run setup.
     */
    protected async setupVsCodeTester(): Promise<void> {
        const ctrl = this.getController();
        const request = new vscode.TestRunRequest();
        const run = ctrl.createTestRun(request);

        const testItem = ctrl.createTestItem(
            this.testState.testObject?.uuid || 'test',
            this.testState.testObject?.uuid ? `${this.testState.testObject?.uuid.slice(0, 4)}: ${this.testState.testObject?.description || 'Test'}` : "Test Process"
        );
        run.enqueued(testItem);

        this.formatter = new TerminalFormatter(run, {
            title: this.testState.testObject?.title || "Test Process",
            showProgressBar: true,
            stepLabelWidth: 30
        });

        this.vsCodeTestRun = run;
        this.vsCodeTestItem = testItem;
        vscode.commands.executeCommand('testing.showMostRecentOutput', testItem);
    }

    /**
     * Set up polling interval to check test status.
     * Subclasses can override this to customize polling behavior.
     */
    protected async setupPollingInterval(): Promise<NodeJS.Timeout> {
        const interval = setInterval(async () => {
            if (!this.isRunning) {
                clearInterval(interval);
                return;
            }

            try {
                const currentState = await this.pollForUpdates();
                if (currentState?.completed) {
                    await this.handleProgress(currentState);
                    await this.handleCompletion(currentState);
                    clearInterval(interval);
                } else {
                    await this.handleProgress(currentState);
                }
            } catch (error) {
                console.error('Error during polling interval:', error);
                clearInterval(interval);

                // Ensure VS Code test run gets properly terminated
                if (this.vsCodeTestRun) {
                    this.vsCodeTestRun.errored(
                        this.vsCodeTestItem!,
                        [new vscode.TestMessage(`Polling error: ${error instanceof Error ? error.message : String(error)}`)]
                    );
                    this.vsCodeTestRun.end();
                    this.vsCodeTestRun = null;
                    this.vsCodeTestItem = null;
                }

                await this.cleanupError(error instanceof Error ? error.message : String(error));
            }
        }, this.pollingInterval);
        return interval;
    }

    /**
     * Set up timeout and error cleanup.
     * Subclasses can override this to customize timeout behavior.
     */
    protected async setupTimeoutAndErrorCleanup(): Promise<NodeJS.Timeout> {
        const timeout = setTimeout(async () => {
            await this.handleTimeout();
        }, this.timeoutMinutes * 60 * 1000);
        return timeout;
    }

    /**
     * Poll for updates on the test suite. Subclasses must implement this.
     */
    protected abstract pollForUpdates(): Promise<TestState>;

    /**
     * Handle test completion. Subclasses can override this.
     * 
     * Need to print out the formatted results.
     * Clean up the test run.
     */
    protected async handleCompletion(state: TestState, originalBaseUrl?: string): Promise<void> {
        const completionMsg = `✅ E2e session completed successfully! Status: ${state.status}`;
        vscode.window.setStatusBarMessage(completionMsg, 3000);
        this.formatter?.printSummary(state);

        let grade: 'pass' | 'fail' | 'error' = 'pass';

        if (state.tests && state.tests.length > 0) {
            for (const test of state.tests) {
                console.log("Processing files for test: ", test);
                const testRun = test.object?.curRun;
                const testName = test.object?.name ?? "";
                const testUuid = testRun?.uuid ?? "";
                if (test.outcome === 'fail') {
                    grade = 'fail';
                }
                if (test.outcome === 'error') {
                    grade = 'error';
                }
                // Download GIF recording if available
                if (testRun?.runGif) {
                    fetchAndOpenGif(this.ide, testRun.runGif, testName, testUuid);
                }

                // Download script file if available
                if (testRun?.runScript) {
                    const workspaceDirs = await this.ide.getWorkspaceDirs();
                    const localSavePath = await this.createLocalTestFilePath(workspaceDirs, { name: testName, content: testRun.runScript, testName: testName });
                    const remoteScriptUrl = testRun.runScript;
                    if (localSavePath) {
                        fetchAndOpenScript(this.ide, localSavePath, remoteScriptUrl, testName, testUuid, originalBaseUrl);
                    }
                }

                // Download JSON details file if available
                if (testRun?.runJson) {
                    fetchAndOpenJson(this.ide, testRun.runJson, testName, testUuid, originalBaseUrl);
                }
            }
        } else {
            console.log("No tests found in state");
            vscode.window.showWarningMessage("⚠️ No test results found in the completed test state.");
        }

        if (grade === 'fail') {
            this.vsCodeTestRun?.failed(this.vsCodeTestItem!, [new vscode.TestMessage("Test failed")]);
        } else if (grade === 'error') {
            this.vsCodeTestRun?.errored(this.vsCodeTestItem!, [new vscode.TestMessage("Test errored")]);
        } else {
            this.vsCodeTestRun?.passed(this.vsCodeTestItem!, this.formatter?.calculateTotalExecutionMs(this.testState) || 0);
        }
        this.vsCodeTestRun?.end();
        this.vsCodeTestRun = null;
        this.vsCodeTestItem = null;
        this.formatter = null;
        await this.cleanup();
        this.isRunning = false;
    }

    /**
     * Handle test progress updates. Subclasses can override this.
     */
    protected async handleProgress(state: TestState): Promise<void> {
        // Default implementation - subclasses can override
        this.formatter?.printState(state);
    }

    /**
     * Handle test timeout. Subclasses can override this.
     */
    protected async handleTimeout(): Promise<void> {
        this.isRunning = false;
        const timeoutMsg = `⏰ Test timed out after ${this.timeoutMinutes} minutes. The test may be taking longer than expected or there may be an issue.`;
        vscode.window.showErrorMessage(timeoutMsg);
        this.formatter?.printMessage(timeoutMsg, "error");

        // Ensure VS Code test run gets properly terminated with timeout error
        if (this.vsCodeTestRun && this.vsCodeTestItem) {
            this.vsCodeTestRun.errored(this.vsCodeTestItem, [new vscode.TestMessage(timeoutMsg)]);
            this.vsCodeTestRun.end();
        }

        this.vsCodeTestRun = null;
        this.vsCodeTestItem = null;
        this.formatter = null;
        await this.cleanupError("Timeout");
    }

    /**
     * Cleanup hook called when test completes successfully.
     * Subclasses should override this to implement their cleanup logic.
     */
    protected async cleanup(): Promise<void> {
        // Default implementation - subclasses should override
        for (const callback of this.cleanupCallbacks) {
            try {
                callback();
            } catch (error) {
                console.error('Error in cleanup callback:', error);
            }
        }
    }

    /**
     * Cleanup hook called when test fails or times out.
     * Subclasses should override this to implement their error cleanup logic.
     */
    protected async cleanupError(reason: string): Promise<void> {
        this.isRunning = false;

        // Ensure VS Code test run gets properly terminated if it still exists
        if (this.vsCodeTestRun && this.vsCodeTestItem) {
            this.vsCodeTestRun.errored(this.vsCodeTestItem, [new vscode.TestMessage(`Test failed: ${reason}`)]);
            this.vsCodeTestRun.end();
            this.vsCodeTestRun = null;
            this.vsCodeTestItem = null;
        }

        // Default implementation - subclasses should override
        const errorMsg = `❌ Test failed: ${reason}`;
        console.error(errorMsg);
        vscode.window.showErrorMessage(errorMsg);

        // Clear formatter
        this.formatter = null;

        for (const callback of this.cleanupCallbacks) {
            try {
                callback();
            } catch (error) {
                console.error('Error in cleanup callback:', error);
                vscode.window.showErrorMessage(`⚠️ Error during cleanup: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }

    /**
     * Add a cleanup callback that will be called during cleanup.
     */
    protected addCleanupCallback(callback: () => void): void {
        this.cleanupCallbacks.push(callback);
    }

    /**
     * Get the VS Code test controller.
     */
    protected getController(): vscode.TestController {
        if (!TestHandler.controller) {
            TestHandler.controller = vscode.tests.createTestController(
                'debuggaiTestHandler',
                'Test Handler'
            );
        }
        return TestHandler.controller;
    }

    /**
     * Get the formatter instance.
     */
    protected getFormatter(): TerminalFormatter {
        if (!this.formatter) {
            this.formatter = new TerminalFormatter(vscode.window.createOutputChannel("Test Handler"));
        }
        return this.formatter;
    }

    /**
     * Generic run method that orchestrates the test process.
     * @param description - The description of the test.
     * @param title - The title of the test.
     * @param object - The object to run the test on.
     */
    async run(): Promise<void> {
        try {
            this.isRunning = true;
            vscode.window.showInformationMessage(`🚀 Starting test run: ${this.options.title || 'Test Process'}`).then(() => {
                setTimeout(() => vscode.commands.executeCommand('workbench.action.closeMessages'), 1000);
            });

            // Initialize the test handler
            await this.initialize();

            // Create the test object
            const testObject = await this.getTestObject();
            if (!testObject) {
                const errorMsg = "❌ Failed to create test object. Please check your configuration and try again.";
                vscode.window.showErrorMessage(errorMsg);
                throw new Error(errorMsg);
            }

            // Set up VS Code test run
            vscode.window.setStatusBarMessage(`🔧 Setting up test environment...`, 1500);
            await this.setupVsCodeTester();

            // Set up polling interval
            vscode.window.setStatusBarMessage(`⏱️ Monitoring test progress...`, 2000);
            const pollingInterval = await this.setupPollingInterval();

            // Set up timeout
            const timeout = await this.setupTimeoutAndErrorCleanup();

            // Add cleanup callbacks
            this.addCleanupCallback(() => {
                clearInterval(pollingInterval);
                clearTimeout(timeout);
            });

        } catch (error) {
            this.isRunning = false;
            const errorMsg = `❌ Error in test run: ${error instanceof Error ? error.message : String(error)}`;
            console.error(errorMsg);
            vscode.window.showErrorMessage(errorMsg);
            await this.cleanupError(error instanceof Error ? error.message : String(error));
        }
    }

    /**
     * Stop the current test run.
     */
    async stop(): Promise<void> {
        this.isRunning = false;
        await this.cleanupError("Manually stopped");
    }

    /**
     * Check if the test is currently running.
     */
    isTestRunning(): boolean {
        return this.isRunning;
    }

    /**
     * Get the current test run.
     */
    getTestRun(): vscode.TestRun | null {
        return this.vsCodeTestRun;
    }

    /**
     * Get the current test item.
     */
    getTestItem(): vscode.TestItem | null {
        return this.vsCodeTestItem;
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
     * Create a local test file path
     */
    public async createLocalTestFilePath(workspaceDirs: string[], testFile: { name: string, content: string, testName?: string }): Promise<string | null> {
        try {
            console.log("Creating local test file path - ", testFile.name);
            console.log("Workspace dirs - ", workspaceDirs);
            const wrkDir = workspaceDirs[0] ? workspaceDirs[0].replace("file://", "") : "";
            console.log("UpdatedWorkspace dir - ", wrkDir);

            // Decode the workspace directory
            const decodedWrkDir = decodeURIComponent(wrkDir);
            console.log("Decoded string url - ", decodedWrkDir);
            await this.ensureTestOutputDir([decodedWrkDir]);

            // Ensure the file has a proper extension
            if (!path.extname(testFile.name)) {
                testFile.name += '.js'; // Default to JavaScript
            }
            console.log("Test file name - ", testFile.name);
            if (!testFile.name.includes(".spec") && (testFile.name.includes(".ts") || testFile.name.includes(".js"))) {
                testFile.name = testFile.name.split(".")[0] + '.spec.' + testFile.name.split(".")[1];
            }

            let filePath = "";
            if (testFile.testName) {
                filePath = path.join(decodedWrkDir, this.testOutputDir, testFile.testName, testFile.name);
                await fs.promises.mkdir(path.join(decodedWrkDir, this.testOutputDir, testFile.testName), { recursive: true });
            } else {
                filePath = path.join(decodedWrkDir, this.testOutputDir, testFile.name);
            }

            return filePath;
        } catch (error) {
            console.error('[E2eTestHandler] Error creating local test file path:', error);
            return null;
        }
    }
}

export default TestHandler;