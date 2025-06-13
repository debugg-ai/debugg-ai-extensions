// src/E2eTestRunner.ts
import { DebuggAIServerClient } from '../debuggAIServer/stubs/client';
import { E2eTestSuite } from '../debuggAIServer/types';
// import { downloadBinary, start, stop } from '../tunnels/ngrok';
import type { IDE, TestController, TestItem, TestRun, TunnelClient } from '../index.js';
import { SuiteGenFormatter } from './terminal/suiteGenFormatter';

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

export class E2eSuiteHandler {
    private client: DebuggAIServerClient;
    private ide: IDE;

    // Tunnelling tools and configuration
    private tunnelClient: TunnelClient;
    private currentTunnel?: string;
    private timeoutMinutes: number;

    // Testing interfaces
    private static controller: TestController | undefined;
    private ideTesterRun: TestRun | null = null;
    private ideTesterItem: TestItem | null = null;
    private formatter: SuiteGenFormatter | null = null;

    constructor(client: DebuggAIServerClient, ide: IDE, tunnelClient: TunnelClient, timeoutMinutes: number = 15) {
        this.client = client;
        this.ide = ide;
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
            this.currentTunnel = tunnelUrl;
            return tunnelUrl;
        } catch (err) {
            console.error('Error starting ngrok tunnel:', err);
            return "";
        }
    }

    /** Lazily create (or reuse) the controller so VS Code only shows one "DebuggAI Tests" tree */
    private async getController(): Promise<TestController> {
        if (!E2eSuiteHandler.controller) {
            E2eSuiteHandler.controller = await this.ide.createTestController(
                'debuggaiTestSuiteGenerators',
                'Test Suite Generator'
            );
        }
        return E2eSuiteHandler.controller;
    }

    async createTestSuite(testDescription: string, localPort?: number): Promise<E2eTestSuite | null> {
        console.log(`Creating new E2E test suite with description: ${testDescription}`);
        const e2eTestSuite = await this.client.e2es?.createE2eTestSuite(testDescription);
        console.log(`E2E test suite created - ${e2eTestSuite}`);
        if (!e2eTestSuite) {
            this.ide.showToast("error", "Failed to create E2E test suite.");
            return null;
        }
        this.ide.showToast("info", `E2E test suite created - ${e2eTestSuite.uuid}`);
        return e2eTestSuite;
    }

    async setupVsCodeTester(suite: E2eTestSuite): Promise<void> {
        // Setup VS Code test run
        const ctrl = await this.getController();
        const request = await this.ide.createTestRunRequest();
        const run = ctrl.createTestRun(request);

        const testItem = ctrl.createTestItem(
            suite.uuid,
            suite.uuid ? `${suite.uuid.slice(0, 4)}: ${suite.description}` : "End to end test suite generator"
        );
        run.enqueued(testItem);

        this.formatter = new SuiteGenFormatter(run, suite);
        // vscode.commands.executeCommand('testing.showMostRecentOutput', testItem);
        this.formatter?.printToTestRun();

        this.ideTesterRun = run;
        this.ideTesterItem = testItem;
    }

    async setupPollingInterval(e2eTestSuite: E2eTestSuite): Promise<NodeJS.Timeout> {
        const interval = setInterval(async () => {
            const suite = await this.client.e2es?.getE2eTestSuite(e2eTestSuite.uuid);
            if (suite?.completed) {
                this.formatter?.printToSummarySection(suite, this.ideTesterItem ?? null);
                this.ideTesterRun?.end();
                this.ideTesterRun = null;
                this.ideTesterItem = null;
                this.formatter = null;
                clearInterval(interval);
            } else {
                this.formatter?.printToTestRun(suite);
            }
        }, 2500);
        return interval;
    }

    async setupTimeoutAndErrorCleanup(e2eTestSuite: E2eTestSuite): Promise<NodeJS.Timeout> {
        // TODO: Setup the timeout / error cleanup
        const timeout = setTimeout(async () => {
            await this.tunnelClient.stop(this.currentTunnel);
            this.ide.showToast("warning", `E2E test suite generator timed out after ${this.timeoutMinutes} minutes\n`);
        }, this.timeoutMinutes * 60 * 1000);
        return timeout;
    }

    async runE2eSuiteHandler(description: string, localPort: number, testSuite?: E2eTestSuite): Promise<void> {
        // Create the test suite
        const e2eTestSuite = testSuite ? testSuite : await this.createTestSuite(description, localPort);
        if (!e2eTestSuite) {
            this.ide.showToast("error", "Failed to create E2E test suite.");
            return;
        }
        // First setup the tunnel as needed
        const ngrokUrl = `${e2eTestSuite.uuid}.ngrok.debugg.ai`;
        await this.configureAndStartTunnel(e2eTestSuite.tunnelKey ?? "", localPort, ngrokUrl);
        // Setup the VS Code test run and associated metadata
        await this.setupVsCodeTester(e2eTestSuite);
        // Setup the polling interval
        await this.setupPollingInterval(e2eTestSuite);
        // Setup the timeout / error cleanup
        await this.setupTimeoutAndErrorCleanup(e2eTestSuite);

    }
}

export default E2eSuiteHandler;