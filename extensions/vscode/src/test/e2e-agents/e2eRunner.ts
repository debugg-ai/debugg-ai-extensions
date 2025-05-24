// src/E2eTestRunner.ts
import { DebuggAIServerClient } from 'core/debuggAIServer/stubs/client';
import { E2eRun } from 'core/debuggAIServer/types';
import * as vscode from 'vscode';
import { downloadBinary, start, stop } from '../../tunnels/ngrok';

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
        throw err;
    }
}


export class E2eTestRunner {
    private static controller: vscode.TestController | undefined;

    async configureNgrok(): Promise<void> {
        await downloadBinary();
    }
    /** Lazily create (or reuse) the controller so VS Code only shows one “DebuggAI Tests” tree */
    private getController(): vscode.TestController {
        if (!E2eTestRunner.controller) {
            E2eTestRunner.controller = vscode.tests.createTestController(
                'debuggaiTests',
                'DebuggAI Tests'
            );
        }
        return E2eTestRunner.controller;
    }

    async startTunnel(port: number, url: string): Promise<string> {
        const listener = await startTunnel(port, url);
        console.log(`Tunnel started at: ${listener}`);
        return listener;
    }

    /**
     * Run E2E test generator for a single file *quietly* in the background.
     * @param filePath absolute path of the file to test
     */
    async runTests(e2eRun: E2eRun, client: DebuggAIServerClient): Promise<undefined> {
        // Start by opening an ngrok tunnel.
        // call the debugg ai endpoint to start running the test
        // retrieve the results when done
        // save files locally somewhere
        const listener = await startTunnel(3011, `${e2eRun.key}.ngrok.debugg.ai`)
        console.log(`Tunnel started at: ${listener}`);

        const interval = setInterval(async () => {
            const newE2eRun = await client.e2es?.getE2eRun(e2eRun.id);
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

}

export default E2eTestRunner;
