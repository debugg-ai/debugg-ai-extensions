// src/E2eTestRunner.ts
import { DebuggAIServerClient } from '../debuggAIServer/stubs/client';
import { E2eRun, E2eTest } from '../debuggAIServer/types';
// import { downloadBinary, start, stop } from '../tunnels/ngrok';
import { ConfigHandler } from '../config/ConfigHandler';
import type { IDE, TestController, TestItem, TestRun } from '../index.js';
import { TunnelClient } from './ngrok-service/types';
import { fetchAndOpenGif } from './recordingHandler';
import { TestRunFormatter } from './terminal/testRunFormatter';

// test-runner.ts
export interface FailureDetail {
    testName: string;
    message: string;
    location?: any;
}

export interface RunResult {
    filePath: string;
    ok: boolean;                 // true = all passed
    durationMs?: number;         // if you have it
    failures: FailureDetail[];   // empty when ok === true
    stdout: string;              // raw runner output
    stderr: string;
}

export type StepAction = {
    input_text: {
        index: number;
        text: string;
    } | {
        click_element_by_index: {
            index: number;
        };
    };
};

export interface StepMessageContent {
    currentState: {
        evaluationPreviousGoal: string;
        memory: string;
        nextGoal: string;
    };
    action: StepAction[];
}

export class E2eTestHandler {
    private client: DebuggAIServerClient;
    private ide: IDE;
    private configHandler: ConfigHandler;

    public status: "pending" | "running" | "completed" | "failed" = "pending";
    public isRunning: boolean = false;

    // Tunnelling tools and configuration
    private tunnelClient: TunnelClient;
    private currentTunnel?: string;
    private timeoutMinutes: number;

    // Testing interfaces
    private static controller: TestController | undefined;
    private ideTesterRun: TestRun | null = null;
    private ideTesterItem: TestItem | null = null;
    private formatter: TestRunFormatter | null = null;
    private _setupPromise: Promise<void> | null = null;
    private _controllerPromise: Promise<TestController> | null = null;
    private pollingInterval: NodeJS.Timeout | null = null;
    private timeoutInterval: NodeJS.Timeout | null = null;

    constructor(client: DebuggAIServerClient, ide: IDE, configHandler: ConfigHandler, tunnelClient: TunnelClient, timeoutMinutes: number = 15) {
        this.client = client;
        this.ide = ide;
        this.configHandler = configHandler;
        this.tunnelClient = tunnelClient;
        this.timeoutMinutes = timeoutMinutes;
        this._setupPromise = this.setup();  // Start async setup for Ngrok
        this._controllerPromise = this.getControllerPromise(); // Start async setup for test controller

    }

    async setup(): Promise<void> {
        return this.configureTunnelClient();
    }

    async configureTunnelClient(): Promise<void> {
        return this.tunnelClient.downloadBinary();
    }
    async configureAndStartTunnel(tunnelKey: string, port: number, url: string): Promise<string> {
        try {
            await this._setupPromise;  // Correctly waiting for the promise to resolve
            const tunnelUrl = await this.tunnelClient.start({
                addr: port,
                hostname: url,
                authtoken: tunnelKey,
                onLogEvent: (data: any) => {
                    console.log(`${port} | ${url} | ngrok log: ${data}`);
                },
            });
            console.log(`Tunnel started at: ${tunnelUrl}`);
            this.currentTunnel = tunnelUrl ?? undefined;
            return tunnelUrl ?? "";
        } catch (err) {
            console.error('Error starting ngrok tunnel:', err);
            return "";
        }
    }

    private async getControllerPromise(): Promise<TestController> {
        return this.getController();
    }
    /** Lazily create (or reuse) the controller so VS Code only shows one "DebuggAI Tests" tree */
    private async getController(): Promise<TestController> {
        console.log("Getting controller...");
        if (!E2eTestHandler.controller) {
            E2eTestHandler.controller = await this.ide.createTestController(
                'debuggaiTestSuiteGenerators',
                'Test Suite Generator'
            );
        }
        return E2eTestHandler.controller;
    }

    async setupIdeTestRun(e2eTest: E2eTest): Promise<void> {
        // Setup VS Code test run
        console.log("Setting up IDE test run...");
        this.status = "running";
        const ctrl = await this.getControllerPromise();
        const request = await this.ide.createTestRunRequest();
        const run = ctrl.createTestRun(request);

        const testItem = ctrl.createTestItem(
            e2eTest.uuid,
            e2eTest.uuid ? `${e2eTest.uuid.slice(0, 4)}: ${e2eTest.description}` : "End to end test suite generator"
        );
        run.enqueued(testItem);

        console.log("Setting up formatter...");
        this.formatter = new TestRunFormatter(run, this.ide, this.configHandler);
        // vscode.commands.executeCommand('testing.showMostRecentOutput', testItem);
        // this.formatter?.printToTestRun(e2eTest);
        this.formatter?.updateStep(`Running ${e2eTest.description}`, "pending");

        this.ideTesterRun = run;
        this.ideTesterItem = testItem;
    }

    async getRepoPath(): Promise<string> {
        const repoPath = await this.ide.getGitRootPath((await this.ide.getCurrentFile())?.path ?? "");
        return repoPath ?? "";
    }
    async setupPollingInterval(e2eTest: E2eTest): Promise<NodeJS.Timeout> {
        console.log("Setting up polling interval...");
        let lastStep = 0;
        let runUuid: string | null = null;
        const interval = setInterval(async () => {
            console.log("New polling interval...");
            if (!runUuid) {
                const test = await this.client.e2es?.getE2eTest(e2eTest.uuid ?? "");
                runUuid = test?.curRun?.uuid ?? null;
            } 
            if (!runUuid) {
                console.log("No run UUID found...");
                return;
            }

            // Get the run directly as it comes with all the conversation data
            const updatedRun = await this.client.e2es?.getE2eRun(runUuid) ?? null;
            if (!updatedRun) {
                console.log("No updated run found...");
                return;
            }
            lastStep = updatedRun.conversations?.[0]?.messages?.length ?? 0;
            console.log("Last step: ", lastStep);
            // Handle the initial step
            if (lastStep <= 1) {
                // Force redraw of the initial step and show the loading icon sequence
                this.formatter?.updateStep(`Running ${e2eTest.description}`, "pending");
            } else if (lastStep === 2) {
                // Force redraw of the initial step and show the loading icon sequence
                this.formatter?.updateStep(`Running ${e2eTest.description}`, "success");
            }

            // Update with the latest step status
            let prevStepMessage = '';

            if (lastStep > 0) {
                // Need to check for the last step info to see if it was successful or not
                const prevStep = updatedRun.conversations?.[0]?.messages?.[lastStep - 1];
                if (prevStep) {
                    const prevStepMessageContent = prevStep.jsonContent;
                    if (prevStepMessageContent) {
                        const prevActionFmt = prevStepMessageContent as StepMessageContent;
                        prevStepMessage = prevActionFmt.currentState.memory;
                    }
                }
            }

            let stepMessage = null;
            // Process the current step
            stepMessage = updatedRun.conversations?.[0]?.messages?.[lastStep];
            if (stepMessage) {
                console.log("Step message found...");
                const stepMessageContent = stepMessage.jsonContent;
                if (stepMessageContent) {
                    const actionFmt = stepMessageContent as StepMessageContent;
                    const currentStepStateMessage = actionFmt.currentState.memory;
                    const stepStatus = actionFmt.currentState.evaluationPreviousGoal ? actionFmt.currentState.evaluationPreviousGoal.split(" - ")[0]?.trim().toLowerCase() : "pending";
                    if (stepStatus && prevStepMessage) {
                        this.formatter?.updateStep(prevStepMessage, stepStatus as any);
                    }
                    if (currentStepStateMessage) {
                        this.formatter?.updateStep(currentStepStateMessage, 'pending');
                    }
                }
            }

            if (updatedRun?.status === "completed") {
                this.finalizeTestRun(updatedRun ?? null);
                this.ideTesterRun?.end();
                this.ideTesterRun = null;
                this.ideTesterItem = null;
                this.formatter = null;
                this.status = "completed";
                this.isRunning = false;
                if (this.pollingInterval) {
                    clearInterval(this.pollingInterval);
                    this.pollingInterval = null;
                }
                console.log("Finalizing test run...");
                if (this.currentTunnel) {
                    await this.tunnelClient.stop(this.currentTunnel);
                }
                if (this.timeoutInterval) {
                    clearTimeout(this.timeoutInterval);
                    this.timeoutInterval = null;
                }
                if (updatedRun?.runGif) {
                    fetchAndOpenGif(
                        this.ide, 
                        updatedRun.runGif, 
                        updatedRun.test?.name ?? "", 
                        updatedRun.uuid);
                }
            }
        }, 1500);
        this.pollingInterval = interval;
        return interval;
    }
    /*
    Finalize the test run.
    */
    finalizeTestRun(e2eRun: E2eRun | null): void {
        // The summary section uses markdown not terminal output
        const markdown = `\n\n**🧪 E2E Test Completed**\n\n${this.formatter?.formatRunSummaryForMarkdown(e2eRun)}`
        const duration = e2eRun?.metrics?.executionTime ? new Date(e2eRun.metrics.executionTime).getTime() - new Date(e2eRun.timestamp).getTime() : 0;
        
        this.ideTesterRun?.appendOutput("\r\n");
        this.ideTesterRun?.appendOutput(this.formatter?.formatRunSummaryForTerminal(e2eRun ?? null) + "\r\n");

        if (e2eRun && this.ideTesterRun && this.ideTesterItem) {
            if (e2eRun.status === "completed" && e2eRun.outcome === "pass") {
                this.ideTesterRun?.passed(this.ideTesterItem, duration);
            } else {
                this.ideTesterRun?.failed(this.ideTesterItem, markdown, duration);
            }
        }

        this.ideTesterRun?.end();
    }

    async setupTimeoutAndErrorCleanup(): Promise<NodeJS.Timeout> {
        // TODO: Setup the timeout / error cleanup
        const timeout = setTimeout(async () => {
            await this.tunnelClient.stop(this.currentTunnel);
            this.ide.showToast("warning", `E2E test suite generator timed out after ${this.timeoutMinutes} minutes\n`);
        }, this.timeoutMinutes * 60 * 1000);
        this.timeoutInterval = timeout;
        return timeout;
    }

    async createE2eTest(description: string): Promise<E2eTest | null> {
        console.log(`Creating new E2E test with description: ${description}`);
        const e2eTest = await this.client.e2es?.createE2eTest(description);
        console.log(`E2E test created - ${e2eTest}`);
        return e2eTest ?? null;
    }

    async runE2eTest(uuid: string, localPort: number, started: boolean = false): Promise<E2eTest | null> {
        // Start running the test if it's not already started
        let e2eTest: E2eTest | null = null;
        if (!started) {
            console.log("Running E2E test...");
            e2eTest = await this.client.e2es?.runE2eTest(uuid) ?? null;
            if (!e2eTest) {
                console.log("No E2E test found...");
                this.ide.showToast("error", "Failed to run E2E test.");
                return null;
            }
        }

        if (!e2eTest) {
            console.log("No E2E test found...");
            this.ide.showToast("error", "Failed to get E2E test.");
            return null;
        }

        // First setup the tunnel as needed
        const ngrokUrl = `${e2eTest.curRun?.key}.ngrok.debugg.ai`;
        console.log("Configuring and starting tunnel...");
        await this.configureAndStartTunnel(e2eTest.tunnelKey ?? "", localPort, ngrokUrl);
        // Setup the VS Code test run and associated metadata
        console.log("Setting up IDE test run...");
        await this.setupIdeTestRun(e2eTest);
        // Setup the polling interval
        console.log("Setting up polling interval...");
        await this.setupPollingInterval(e2eTest);
        // Setup the timeout / error cleanup
        console.log("Setting up timeout and error cleanup...");
        await this.setupTimeoutAndErrorCleanup();

        console.log("E2E test run completed...");
        return e2eTest;
    }

    async createAndRunE2eTest(description: string, localPort: number): Promise<E2eTest | null> {
        // Create the test
        const e2eTest = await this.createE2eTest(description);
        if (!e2eTest) {
            this.ide.showToast("error", "Failed to create E2E test.");
            return null;
        }
        return await this.runE2eTest(e2eTest.uuid, localPort, true);
    }
}

export default E2eTestHandler;