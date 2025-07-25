// src/E2eTestRunner.ts
import { DebuggAIServerClient } from 'core/debuggAIServer/stubs/client';
import { E2eTestSuite } from 'core/debuggAIServer/types';
import * as vscode from 'vscode';

import { downloadBinary, start, stop } from '../../tunnels/ngrok';
import { SuiteGenFormatter } from '../terminal/suiteGenFormatter';


// test-runner.ts
export interface FailureDetail {
    testName: string;
    message: string;
    location?: vscode.Location;
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

async function startNgrokTunnel(authToken: string, localPort: number, domain: string) {
    try {
        await start({
            addr: localPort,
            hostname: domain,
            authtoken: authToken,
            onLogEvent: (data: any) => {
                console.log(`${localPort} | ${domain} | ngrok log: ${data}`);
            },
        });
        return domain;
    } catch (err) {
        console.error('Error starting ngrok tunnel:', err);
    }
}


export class E2eSuiteGenerator {
    private static controller: vscode.TestController | undefined;
    private client: DebuggAIServerClient;

    private repoName?: string;
    private repoPath?: string;
    private branchName?: string;
    private fileContents?: Uint8Array;
    private filePath?: string;
    private currentTunnel?: string;
    private timeoutMinutes: number;
    private vsCodeTestRun: vscode.TestRun | null = null;
    private vsCodeTestItem: vscode.TestItem | null = null;
    private formatter: SuiteGenFormatter | null = null;

    constructor(client: DebuggAIServerClient, timeoutMinutes: number = 15) {
        this.client = client;
        this.setup();
        this.timeoutMinutes = timeoutMinutes;

    }

    async setup() {
        await this.configureNgrok();

        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.setStatusBarMessage("No file open.", 3000);
            return;
        }
        try {

            const filePath = editor.document.uri.fsPath;
            this.filePath = filePath;
            const { repoName, repoPath, branchName } = await this.client.getRepoInfo(editor.document.uri.fsPath);
            if (!repoName || !repoPath || !branchName) {
                console.log("No repo name, path, or branch name found for file");
                vscode.window.setStatusBarMessage("File not found or not associated with a repo. Please open a file in a repo.", 2000);
                return;
            }
            const curFileUri = vscode.Uri.file(filePath);
            this.repoName = repoName;
            this.repoPath = repoPath;
            this.branchName = branchName;
        } catch (e) {
            console.error("Error setting up E2E test runner:", e);
            vscode.window.showWarningMessage("File not found or not associated with a repo.");
            return;
        }

    }

    async configureNgrok(): Promise<void> {
        await downloadBinary();
    }

    /** Lazily create (or reuse) the controller so VS Code only shows one "DebuggAI Tests" tree */
    private getController(): vscode.TestController {
        if (!E2eSuiteGenerator.controller) {
            E2eSuiteGenerator.controller = vscode.tests.createTestController(
                'debuggaiTestSuiteGenerators',
                'Test Suite Generator'
            );
        }
        return E2eSuiteGenerator.controller;
    }

    private getParams(): Record<string, any> {
        return {
            filePath: this.filePath ?? "",
            repoName: this.repoName ?? "",
            branchName: this.branchName ?? "",
            repoPath: this.repoPath ?? ""
        };
    }

    async createTestSuite(testDescription: string, localPort?: number): Promise<E2eTestSuite | null> {
        console.log(`Creating new E2E test suite with description: ${testDescription}`);
        const e2eTestSuite = await this.client.e2es?.createE2eTestSuite(
            testDescription,
            this.getParams()
        );
        console.log(`E2E test suite created - ${e2eTestSuite}`);
        if (!e2eTestSuite) {
            vscode.window.setStatusBarMessage("Failed to create E2E test suite.", 3000);
            return null;
        }
        vscode.window.setStatusBarMessage(`E2E test suite created - ${e2eTestSuite.uuid}`, 1500);
        return e2eTestSuite;
    }

    async configureAndStartTunnel(tunnelKey: string, port: number, url: string): Promise<void> {
        // TODO: Configure the tunnel
        await startNgrokTunnel(tunnelKey, port, url);
        console.log(`Tunnel started at: ${url}`);
        this.currentTunnel = url;
    }

    async setupVsCodeTester(suite: E2eTestSuite): Promise<void> {
        // Setup VS Code test run
        const ctrl = this.getController();
        const request = new vscode.TestRunRequest();
        const run = ctrl.createTestRun(request);

        const testItem = ctrl.createTestItem(
            suite.uuid,
            suite.uuid ? `${suite.uuid.slice(0, 4)}: ${suite.description}` : "End to end test suite generator"
        );
        run.enqueued(testItem);

        this.formatter = new SuiteGenFormatter(run, suite);
        vscode.commands.executeCommand('testing.showMostRecentOutput', testItem);
        this.formatter?.printToTestRun();

        this.vsCodeTestRun = run;
        this.vsCodeTestItem = testItem;
    }

    async setupPollingInterval(e2eTestSuite: E2eTestSuite): Promise<NodeJS.Timeout> {
        const interval = setInterval(async () => {
            const suite = await this.client.e2es?.getE2eTestSuite(e2eTestSuite.uuid);
            if (suite?.completed) {
                this.formatter?.printToSummarySection(suite, this.vsCodeTestItem ?? null);
                this.vsCodeTestRun?.end();
                this.vsCodeTestRun = null;
                this.vsCodeTestItem = null;
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
            await stop(`https://${e2eTestSuite.uuid}.ngrok.debugg.ai`);
            vscode.window.showWarningMessage(`E2E test suite generator timed out after ${this.timeoutMinutes} minutes\n`);
        }, this.timeoutMinutes * 60 * 1000);
        return timeout;
    }

    async runE2eSuiteGenerator(description: string, localPort: number, testSuite?: E2eTestSuite): Promise<void> {
        // Create the test suite
        const e2eTestSuite = testSuite ? testSuite : await this.createTestSuite(description, localPort);
        if (!e2eTestSuite) {
            vscode.window.setStatusBarMessage("Failed to create E2E test suite.", 3000);
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

export default E2eSuiteGenerator;