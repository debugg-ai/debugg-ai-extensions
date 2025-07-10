// src/E2eTestRunner.ts
import { DebuggAIServerClient } from 'core/debuggAIServer/stubs/client';
import * as vscode from 'vscode';
import { TerminalFormatter } from '../terminal/terminalFormatter';
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
    protected testState: TestState;
    protected options: TestHandlerOptions;

    constructor(client: DebuggAIServerClient, options: TestHandlerOptions) {
        this.client = client;
        this.timeoutMinutes = options.timeoutMinutes || 15;
        this.pollingInterval = options.pollingInterval || 2500;
        this.options = options;

        // Initialize state
        this.testState = {
            testObject: null,
            testResults: null,
            stepNumber: 0,
            completed: false,
            status: "pending",
            steps: [],
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
    protected async getTestObject(): Promise<TestObject> {
        if (!this.testState.testObject) {
            this.testState.testObject = await this.createTestObject();
        }
        if (!this.testState.testObject) {
            throw new Error("Failed to create test object");
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

            const currentState = await this.pollForUpdates();
            if (currentState?.completed) {
                await this.handleCompletion(currentState);
                clearInterval(interval);
            } else {
                await this.handleProgress(currentState);
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
    protected async handleCompletion(state: TestState): Promise<void> {
        this.isRunning = false;
        this.formatter?.printSummary(state);
        this.vsCodeTestRun?.end();
        this.vsCodeTestRun = null;
        this.vsCodeTestItem = null;
        this.formatter = null;
        await this.cleanup();
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
        this.formatter?.printMessage(`Test timed out after ${this.timeoutMinutes} minutes`, "error");
        this.vsCodeTestRun?.end();
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
        // Default implementation - subclasses should override
        console.error(`Test failed: ${reason}`);
        for (const callback of this.cleanupCallbacks) {
            try {
                callback();
            } catch (error) {
                console.error('Error in cleanup callback:', error);
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

            // Initialize the test handler
            await this.initialize();

            // Create the test suite
            const testObject = await this.getTestObject();
            if (!testObject) {
                throw new Error("Failed to create test object");
            }

            // Set up VS Code test run
            await this.setupVsCodeTester();

            // Set up polling interval
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
            console.error('Error in test run:', error);
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
}

export default TestHandler;