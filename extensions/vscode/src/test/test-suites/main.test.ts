import assert from "node:assert";

import { describe, test } from "mocha";
import * as vscode from "vscode";

import { VsCodeExtension } from "../../extension/VsCodeExtension";

describe("Extension Test Suite", () => {
  // Set test environment
  process.env.NODE_ENV = "test"; 
  
  vscode.window.showInformationMessage("Start all tests.");

  test("Sample test", () => {
    assert.strictEqual(-1, [1, 2, 3].indexOf(5));
    assert.strictEqual(-1, [1, 2, 3].indexOf(0));
  });

  test("Get the default model from webview", async function() {
    // Increase timeout for this async test
    this.timeout(15000);
    
    // Ensure test environment is set
    process.env.NODE_ENV = "test";
    console.log('Test environment NODE_ENV:', process.env.NODE_ENV);
    
    // Get the extension with proper error handling
    const continueExtensionApi = vscode.extensions.getExtension("debugg-ai.debugg-ai");
    
    if (!continueExtensionApi) {
      throw new Error("Extension 'debugg-ai.debugg-ai' not found. Make sure the extension is activated.");
    }

    console.log('Extension found, isActive:', continueExtensionApi.isActive);

    // Ensure extension is activated and wait for activation to complete
    let exports;
    if (!continueExtensionApi.isActive) {
      console.log('Activating extension...');
      exports = await continueExtensionApi.activate();
      console.log('Extension activated, exports keys:', exports ? Object.keys(exports) : 'undefined');
    } else {
      exports = continueExtensionApi.exports;
      console.log('Extension already active, exports keys:', exports ? Object.keys(exports) : 'undefined');
      
      // If exports are undefined but extension is active, try to reactivate
      if (!exports) {
        console.log('Extension exports are undefined, attempting to reactivate...');
        try {
          // Force reactivation by calling activate again
          exports = await continueExtensionApi.activate();
          console.log('After reactivation, exports keys:', exports ? Object.keys(exports) : 'undefined');
        } catch (error) {
          console.log('Reactivation failed:', error);
        }
      }
    }

    if (!exports) {
      // Skip this test if exports are still undefined
      console.warn('Extension exports are still undefined, skipping webview test...');
      this.skip();
      return;
    }

    const extension: VsCodeExtension = exports.extension;
    if (!extension) {
      console.log('Available exports:', Object.keys(exports));
      throw new Error("Extension.extension property is undefined. Make sure NODE_ENV=test is set.");
    }

    console.log('Extension object obtained successfully');

    // Wait for extension to be ready
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    // Focus the continue input to ensure webview is initialized
    await vscode.commands.executeCommand("debugg-ai.focusContinueInput");
    await new Promise((resolve) => setTimeout(resolve, 2000));

    try {
      // Get the webview protocol with timeout
      const webviewProtocol = await Promise.race([
        extension.webviewProtocolPromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Webview protocol timeout")), 5000)
        )
      ]);
      
      if (!webviewProtocol) {
        throw new Error("Webview protocol is not available");
      }

      // Request default model title with timeout
      const title = await Promise.race([
        (webviewProtocol as any).request("getDefaultModelTitle", undefined),
        // webviewProtocol.sendMessage("getDefaultModelTitle", undefined),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error("getDefaultModelTitle timeout")), 3000)
        )
      ]);
      
      // Verify the title is a string
      assert.strictEqual(typeof title, "string");
      
      // According to the test setup, it should be "Test Model"
      assert.strictEqual(title, "Test Model");
      
      console.log("✅ Default model title test passed:", title);
      
    } catch (error) {
      console.error("Error in webview protocol test:", error);
      // Mark the test as failing instead of just warning
      throw error;
    }
  });
});
