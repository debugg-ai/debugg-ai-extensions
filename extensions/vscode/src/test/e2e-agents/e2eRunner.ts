// src/E2eTestRunner.ts
import { DebuggAIServerClient } from 'core/debuggAIServer/stubs/client';
import { E2eTest } from 'core/debuggAIServer/types';
import { fetchAndOpenGif } from 'core/e2es/recordingHandler';
import { IDE } from 'core/index.js';
import * as vscode from 'vscode';

import { downloadBinary, start, stop } from '../../tunnels/ngrok';
import { RunResultFormatter } from '../terminal/resultsFormatter';

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


export class E2eTestRunner {
    private static controller: vscode.TestController | undefined;
    private client: DebuggAIServerClient;
    private ide: IDE;

    private repoName?: string;
    private repoPath?: string;
    private branchName?: string;
    private fileContents?: Uint8Array;
    private filePath?: string;
    private currentTunnel?: string;

    constructor(ide: IDE, client: DebuggAIServerClient) {
        this.ide = ide;
        this.client = client;
        this.setup();

    }

    async setup() {
        await this.configureNgrok();

        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showWarningMessage("No file open.")
          setTimeout(() => vscode.commands.executeCommand('workbench.action.closeMessages'), 3000);
          return;
        }
        try {
            
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
        } catch (e) {
            console.error("Error setting up E2E test runner:", e);
            vscode.window.setStatusBarMessage("File not found or not associated with a repo.", 3000);
            return;
        }

    }

    async configureNgrok(): Promise<void> {
        await downloadBinary();
    }

    /** Lazily create (or reuse) the controller so VS Code only shows one "DebuggAI Tests" tree */
    private getController(): vscode.TestController {
        if (!E2eTestRunner.controller) {
            E2eTestRunner.controller = vscode.tests.createTestController(
                'debuggaiE2eTests',
                'DebuggAI E2E Tests'
            );
        }
        return E2eTestRunner.controller;
    }

    async startTunnel(authToken: string, port: number, url: string): Promise<string> {
        await startNgrokTunnel(authToken, port, url);
        console.log(`Tunnel started at: ${url}`);
        this.currentTunnel = url;
        return url;
    }

    async createNewE2eTest(testDescription: string, localPort?: number): Promise<void> {
        console.log(`Creating new E2E test with description: ${testDescription}`);
        const e2eTest = await this.client.e2es?.createE2eTest(
            testDescription
        );
        console.log(`E2E test created - ${e2eTest}`);
        if (!e2eTest) {
            vscode.window.setStatusBarMessage("Failed to create E2E test.", 3000);
            return;
        }
        if (!e2eTest.curRun) {
            vscode.window.setStatusBarMessage("Failed to create E2E test run.", 3000);
            return;
        }
        const authToken = e2eTest.tunnelKey ?? "";
        return this.handleE2eRun(authToken, e2eTest, localPort);
    }

    async handleE2eRun(authToken: string, e2eTest: E2eTest, localPort?: number): Promise<void> {
        console.log(`🔧 Handling E2E run - ${e2eTest.uuid}`);

        const e2eRun = e2eTest.curRun;
        const port = localPort ?? 3000;
        if (!e2eRun) {
            vscode.window.setStatusBarMessage("Failed to retrieve current E2E test run.", 3000);
            return;
        }
        // Start ngrok tunnel
        await startNgrokTunnel(authToken, port, `${e2eRun.key}.ngrok.debugg.ai`);
        console.log(`🌐 Tunnel started at: ${e2eRun.key}.ngrok.debugg.ai`);

        vscode.window.setStatusBarMessage(`E2E test running...`, 1000);

        // Setup VS Code test run
        const ctrl = this.getController();
        const request = new vscode.TestRunRequest();
        const run = ctrl.createTestRun(request);

        const testItem = ctrl.createTestItem(
            e2eRun.uuid, 
            e2eTest.uuid ? `${e2eTest.uuid.slice(0, 4)}: ${e2eTest.description}` : "End to end test runner"
        );
        run.enqueued(testItem);

        let stopped = false;
        let lastStep = 0;
        const formatter = new RunResultFormatter(run);
        vscode.commands.executeCommand('testing.showMostRecentOutput', testItem);
        formatter.updateStep(`Running ${e2eTest.description}`, "pending");

        // Poll every second for completion
        const interval = setInterval(async () => {
            const updatedRun = await this.client.e2es?.getE2eRun(e2eRun.uuid);
            if (!updatedRun) {return;}

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
                
                // const duration = new Date().getTime() - new Date(updatedRun.timestamp).getTime();
                // if (updatedRun.outcome === 'pass') {
                //     run.passed(testItem, duration);
                // } else {
                //     run.failed(testItem, new vscode.TestMessage(formatted ?? ""), duration);
                // }
                // run.end();
                if (updatedRun.runGif) {
                    fetchAndOpenGif(this.ide, updatedRun.runGif, updatedRun.test?.name ?? "", updatedRun.uuid);
                }
                stopped = true;
            } 
        }, 5000);

        // Timeout safeguard
        const timeout = setTimeout(async () => {
            if (stopped) {return;}
            clearInterval(interval);
            await stop(`https://${e2eRun.key}.ngrok.debugg.ai`);
            run.appendOutput(`⏰ E2E test timed out after 15 minutes\n`);
            run.errored(testItem, new vscode.TestMessage('Timeout after 15 minutes'), 900_000);
            run.end();
        }, 900_000);
    }

}

export default E2eTestRunner;