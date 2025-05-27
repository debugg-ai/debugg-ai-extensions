// src/E2eTestRunner.ts
import { DebuggAIServerClient } from 'core/debuggAIServer/stubs/client';
import { E2eRun } from 'core/debuggAIServer/types';
import * as vscode from 'vscode';
import { downloadBinary, start, stop } from '../../tunnels/ngrok';
import { RunResultFormatter } from '../terminal/resultsFormatter';
import { fetchAndOpenGif } from './recordingHandler';

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

async function startTunnel(localPort: number, domain: string) {
    try {
        await start({
            addr: localPort,
            hostname: domain,
            onLogEvent: (data: any) => {
                console.log(`${localPort} | ${domain} | ngrok log: ${data}`);
            },
        });
        // console.log('Clearing ngrok tunnels');
        // await ngrok.disconnect();
        // console.log('Tunnels disconnected');

        // console.log(`Starting ngrok tunnel for ${domain} on port ${localPort}`);
        // const listener = await ngrok.connect({
        //     configPath: path.join(__dirname, 'ngrok-config.yml'),
        //     addr: localPort,
        //     authtoken: '2xWBRboVuXUJkwVF2H4motEE6fI_2prPjBgL3ky8UW9WVNLxC',
        //     hostname: domain,
        //     onLogEvent: (data: any) => {
        //         console.log(`Ngrok log event: ${data}`);
        //     },
        // }).catch((err: any) => {
        //     console.error('Failed to connect ngrok:', err);
        //     throw err; // Re-throw to be caught by outer try-catch
        // });
        return domain;
    } catch (err) {
        console.error('Error starting ngrok tunnel:', err);
    }
}


export class E2eTestRunner {
    private static controller: vscode.TestController | undefined;
    private client: DebuggAIServerClient;

    private repoName?: string;
    private repoPath?: string;
    private branchName?: string;
    private fileContents?: Uint8Array;
    private filePath?: string;

    constructor(client: DebuggAIServerClient) {
        this.client = client;
        this.setup();
    }

    async setup() {
        await this.configureNgrok();

        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showWarningMessage("No file open.");
          return;
        }
        const filePath = editor.document.uri.fsPath;
        this.filePath = filePath;
        const { repoName, repoPath, branchName } = await this.client.getRepoInfo(editor.document.uri.fsPath);
        if (!repoName || !repoPath || !branchName) {
          console.debug("No repo name, path, or branch name found for file");
        }
        const curFileUri = vscode.Uri.file(filePath);
        const fileContents = await vscode.workspace.fs.readFile(curFileUri);
        this.repoName = repoName;
        this.repoPath = repoPath;
        this.branchName = branchName;
        this.fileContents = fileContents;
    }

    async configureNgrok(): Promise<void> {
        await downloadBinary();
    }

    /** Lazily create (or reuse) the controller so VS Code only shows one “DebuggAI Tests” tree */
    private getController(): vscode.TestController {
        if (!E2eTestRunner.controller) {
            E2eTestRunner.controller = vscode.tests.createTestController(
                'debuggaiE2eTests',
                'DebuggAI E2E Tests'
            );
        }
        return E2eTestRunner.controller;
    }

    async startTunnel(port: number, url: string): Promise<string> {
        await startTunnel(port, url);
        console.log(`Tunnel started at: ${url}`);
        return url;
    }

    /**
     * Run E2E test generator for a single file *quietly* in the background.
     * @param filePath absolute path of the file to test
     */
    async runTests(e2eRun: E2eRun): Promise<undefined> {
        // Start by opening an ngrok tunnel.
        // call the debugg ai endpoint to start running the test
        // retrieve the results when done
        // save files locally somewhere
        const listener = await startTunnel(3011, `${e2eRun.key}.ngrok.debugg.ai`)
        console.log(`Tunnel started at: ${listener}`);

        const interval = setInterval(async () => {
            const newE2eRun = await this.client.e2es?.getE2eRun(e2eRun.id);
            console.log(`E2E run - ${newE2eRun}`);
            if (newE2eRun?.status === 'completed') {
                console.log(`E2E run completed - ${newE2eRun}`);
                clearInterval(interval);
                await stop(listener);
            }
        }, 1000);
        // if the run doesn't complete in time, disconnect the tunnel
        const setTimer = setTimeout(async () => {
            clearInterval(interval);
            clearTimeout(setTimer);
            await stop(listener);
        }, 300000);
        return undefined;
    }

    async createNewE2eTest(testDescription: string): Promise<void> {
        console.log(`Creating new E2E test with description: ${testDescription}`);
        const e2eTest = await this.client.e2es?.createE2eTest(
            testDescription,
            this.filePath ?? "",
            this.repoName ?? "",
            this.branchName ?? "",
            {
              repoPath: this.repoPath ?? ""
            }
        );
        console.log(`E2E test created - ${e2eTest}`);
        if (!e2eTest) {
            vscode.window.showWarningMessage("Failed to create E2E test.");
            return;
        }
        if (!e2eTest.curRun) {
            vscode.window.showWarningMessage("Failed to create E2E test run.");
            return;
        }
        return this.handleE2eRun(e2eTest.curRun);
    }

    async handleE2eRun(e2eRun: E2eRun): Promise<void> {
        console.log(`🔧 Handling E2E run - ${e2eRun.uuid}`);

        // Start ngrok tunnel
        await startTunnel(3011, `${e2eRun.key}.ngrok.debugg.ai`);
        console.log(`🌐 Tunnel started at: ${e2eRun.key}.ngrok.debugg.ai`);

        // Setup VS Code test run
        const ctrl = this.getController();
        const request = new vscode.TestRunRequest();
        const run = ctrl.createTestRun(request);

        const testItem = ctrl.createTestItem(
            e2eRun.uuid, 
            e2eRun.test?.description ?? ""
        );
        run.enqueued(testItem);

        let stopped = false;
        let lastStep = 0;
        const formatter = new RunResultFormatter(run);

        // Poll every second for completion
        const interval = setInterval(async () => {
            const updatedRun = await this.client.e2es?.getE2eRun(e2eRun.id);
            if (!updatedRun) return;

            console.log(`📡 Polled E2E run status: ${updatedRun.status}`);

            // Update with the latest step status
            let prevStepMessage = "";

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
            // Process the current step
            const stepMessage = updatedRun.conversations?.[0]?.messages?.[lastStep];
            if (stepMessage) {
                const stepMessageContent = stepMessage.jsonContent;
                if (stepMessageContent) {
                    const actionFmt = stepMessageContent as StepMessageContent;
                    const stepMessage = actionFmt.currentState.memory;
                    const stepStatus = actionFmt.currentState.evaluationPreviousGoal ? actionFmt.currentState.evaluationPreviousGoal.split(" - ")[0]?.trim().toLowerCase() : "pending";
                    if (stepStatus && prevStepMessage) {
                        formatter.updateStep(prevStepMessage, stepStatus as any);
                    }
                    if (stepMessage) {
                        formatter.updateStep(stepMessage, 'pending');
                    }
                }
            }
            if (updatedRun.status === 'completed') {
                clearInterval(interval);
                clearTimeout(timeout);
                await stop(`https://${e2eRun.key}.ngrok.debugg.ai`);

                formatter.appendToTestRun(updatedRun, run, testItem);  // For test output
                // formatter.printToTerminal();               // Optional: pretty terminal view

                // const duration = new Date().getTime() - new Date(updatedRun.timestamp).getTime();
                // if (updatedRun.outcome === 'pass') {
                //     run.passed(testItem, duration);
                // } else {
                //     run.failed(testItem, new vscode.TestMessage(formatted ?? ""), duration);
                // }
                // run.end();
                if (updatedRun.runGif) {
                    fetchAndOpenGif(this.repoPath ?? "", updatedRun.runGif, updatedRun.test?.name ?? "", updatedRun.uuid);
                }
                stopped = true;
            } 
        }, 5000);

        // Timeout safeguard
        const timeout = setTimeout(async () => {
            if (stopped) return;
            clearInterval(interval);
            await stop(`https://${e2eRun.key}.ngrok.debugg.ai`);
            run.appendOutput(`⏰ E2E test timed out after 15 minutes\n`);
            run.errored(testItem, new vscode.TestMessage('Timeout after 15 minutes'), 900_000);
            run.end();
        }, 900_000);
    }

}

export default E2eTestRunner;