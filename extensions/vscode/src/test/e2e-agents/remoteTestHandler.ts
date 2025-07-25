// src/E2eTestRunner.ts
import { DebuggAIServerClient } from 'core/debuggAIServer/stubs/client';
import { IDE } from 'core/index';

import { downloadBinary, startNgrokTunnel, stop } from '../../tunnels/ngrok';

import { TestHandler } from './testHandler';
import { RemoteTestHandlerOptions, TestHandlerOptions } from './types';


/**
 * Remote test handler that extends the generic TestHandler to add ngrok tunnel functionality.
 * This allows any test to be run with remote access via ngrok tunnels.
 */
export abstract class RemoteTestHandler extends TestHandler {
    public currentTunnel?: string;
    public remoteOptions: RemoteTestHandlerOptions;

    constructor(client: DebuggAIServerClient, ide: IDE, options: TestHandlerOptions, remoteOptions: RemoteTestHandlerOptions = {}) {
        super(client, ide, options);
        this.remoteOptions = remoteOptions;
    }

    /**
     * Configure and start ngrok tunnel.
     */
    protected async configureAndStartTunnel(): Promise<void> {
        const tunnelKey = this.remoteOptions.remoteTunnelKey ?? this.testState.testObject?.uuid ?? "";
        const port = this.remoteOptions.localTunnelPort ?? 0;
        const url = this.remoteOptions.remoteTunnelUrl ?? `${tunnelKey}.ngrok.debugg.ai`;
        this.currentTunnel = await startNgrokTunnel(tunnelKey, port, url);
    }

    /**
     * Stop ngrok tunnel.
     */
    protected async stopNgrokTunnel(currentTunnel: string): Promise<void> {
        if (currentTunnel) {
            try {
                await stop(currentTunnel);
                console.log(`Stopped tunnel: ${currentTunnel}`);
            } catch (error) {
                console.error(`Error stopping tunnel: ${error}`);
            }
        }
    }

    /**
     * Configure ngrok binary.
     */
    private async configureNgrok(): Promise<void> {
        await downloadBinary();
    }

    /**
     * Run a remote test with tunnel setup. Simply wrap the parent run method with
     * tunnel setup and cleanup.
     */
    async run(): Promise<void> {
        this.isRunning = true;

        // Configure ngrok
        await this.configureNgrok();

        console.log("Ngrok configured for remote test handler");
        // Initialize the test handler
        await this.initialize();

        console.log("Remote test handler initialized");

        // Create the test object
        const testObject = await this.getTestObject();
        if (!testObject.object) {
            console.error("No test object created, skipping test");
            return;
        }

        console.log("Test object created");
        if (testObject.status === "failed") {
            console.error("Test object created but failed to start, skipping test");
            return;
        }
        if (testObject.status === "completed") {
            console.error("Test object created but set immediately to completed, skipping test");
            return;
        }
        
        // Use the object to configure and start the tunnel
        await this.configureAndStartTunnel();

        console.log("Tunnel configured and started");

        // Add tunnel cleanup callback for when we're done
        this.addCleanupCallback(() => {
            this.stopNgrokTunnel(this.currentTunnel ?? "");
        });

        console.log("Running test handler...");
        // Run the test using parent implementation
        await super.run();
    }

    /**
     * Get the current tunnel URL.
     */
    getCurrentTunnel(): string | undefined {
        return this.currentTunnel;
    }

    /**
     * Check if a tunnel is currently active.
     */
    isTunnelActive(): boolean {
        return !!this.currentTunnel;
    }
}

export default RemoteTestHandler;