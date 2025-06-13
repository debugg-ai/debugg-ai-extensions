// src/E2eTestRunner.ts
import { DebuggAIServerClient } from '../debuggAIServer/stubs/client';
import { E2eTest } from '../debuggAIServer/types';
// import { downloadBinary, start, stop } from '../tunnels/ngrok';
import { ConfigHandler } from '../config/ConfigHandler';
import type { IDE, TestController, TestItem, TestRun } from '../index.js';
import { TunnelClient } from './ngrok/types';
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

    // Tunnelling tools and configuration
    private tunnelClient: TunnelClient;
    private currentTunnel?: string;
    private timeoutMinutes: number;

    // Testing interfaces
    private static controller: TestController | undefined;
    private ideTesterRun: TestRun | null = null;
    private ideTesterItem: TestItem | null = null;
    private formatter: TestRunFormatter | null = null;

    constructor(client: DebuggAIServerClient, ide: IDE, configHandler: ConfigHandler, tunnelClient: TunnelClient, timeoutMinutes: number = 15) {
        this.client = client;
        this.ide = ide;
        this.configHandler = configHandler;
        this.tunnelClient = tunnelClient;
        this.timeoutMinutes = timeoutMinutes;
        this.setup();

    }

    async setup() {
        await this.configureTunnelClient();
    }

    async configureTunnelClient(): Promise<void> {
        await this.tunnelClient.downloadBinary();
    }
    async configureAndStartTunnel(tunnelKey: string, port: number, url: string): Promise<string> {
        try {
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

    /** Lazily create (or reuse) the controller so VS Code only shows one "DebuggAI Tests" tree */
    private async getController(): Promise<TestController> {
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
        const ctrl = await this.getController();
        const request = await this.ide.createTestRunRequest();
        const run = ctrl.createTestRun(request);

        const testItem = ctrl.createTestItem(
            e2eTest.uuid,
            e2eTest.uuid ? `${e2eTest.uuid.slice(0, 4)}: ${e2eTest.description}` : "End to end test suite generator"
        );
        run.enqueued(testItem);

        this.formatter = new TestRunFormatter(run, this.ide, this.configHandler);
        // vscode.commands.executeCommand('testing.showMostRecentOutput', testItem);
        this.formatter?.printToTestRun(e2eTest);

        this.ideTesterRun = run;
        this.ideTesterItem = testItem;
    }

    async getRepoPath(): Promise<string> {
        const repoPath = await this.ide.getGitRootPath((await this.ide.getCurrentFile())?.path ?? "");
        return repoPath ?? "";
    }
    async setupPollingInterval(e2eTest: E2eTest): Promise<NodeJS.Timeout> {
        const interval = setInterval(async () => {
            const test = await this.client.e2es?.getE2eTest(e2eTest.uuid);
            if (test?.curRun?.status === "completed") {
                this.finalizeTestRun(test);
                this.ideTesterRun?.end();
                this.ideTesterRun = null;
                this.ideTesterItem = null;
                this.formatter = null;
                clearInterval(interval);
                if (test?.curRun?.runGif) {
                    fetchAndOpenGif(
                        this.ide, 
                        await this.getRepoPath(), 
                        test.curRun.runGif, 
                        test.curRun.test?.name ?? "", 
                        test.curRun.uuid);
                }
            } else {
                this.formatter?.printToTestRun(test ?? null);
            }
        }, 2500);
        return interval;
    }
    /*
    Finalize the test run.
    */
    finalizeTestRun(test: E2eTest | null): void {
        // The summary section uses markdown not terminal output
        const markdown = `\n\n**🧪 E2E Test Completed**\n\n${this.formatter?.formatMarkdownSummary(test)}`
        const duration = test?.curRun?.metrics?.executionTime ? new Date(test.curRun.metrics.executionTime).getTime() - new Date(test.curRun.timestamp).getTime() : 0;
        if (test && this.ideTesterRun && this.ideTesterItem) {
            if (test.curRun?.status === "completed") {
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
            e2eTest = await this.client.e2es?.runE2eTest(uuid) ?? null;
            if (!e2eTest) {
                this.ide.showToast("error", "Failed to run E2E test.");
                return null;
            }
        }

        if (!e2eTest) {
            this.ide.showToast("error", "Failed to get E2E test.");
            return null;
        }

        // First setup the tunnel as needed
        const ngrokUrl = `${e2eTest.curRun?.key}.ngrok.debugg.ai`;
        await this.configureAndStartTunnel(e2eTest.tunnelKey ?? "", localPort, ngrokUrl);
        // Setup the VS Code test run and associated metadata
        await this.setupIdeTestRun(e2eTest);
        // Setup the polling interval
        await this.setupPollingInterval(e2eTest);
        // Setup the timeout / error cleanup
        await this.setupTimeoutAndErrorCleanup();

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