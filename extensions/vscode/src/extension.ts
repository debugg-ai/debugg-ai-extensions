/**
 * This is the entry point for the extension.
 */

import { setupCa } from "core/util/ca";
import { extractMinimalStackTraceInfo } from "core/util/extractMinimalStackTraceInfo";
import { Telemetry } from "core/util/posthog";
import * as vscode from "vscode";
// Try to import ngrok kill function, but handle gracefully if not available
let ngrokKill: (() => Promise<void>) | null = null;
try {
  const ngrok = require('ngrok');
  ngrokKill = ngrok.kill;
} catch (error: any) {
  console.warn('ngrok package not available:', error.message);
}

import { getExtensionVersion } from "./util/util";

async function dynamicImportAndActivate(context: vscode.ExtensionContext) {
  await setupCa();
  const { activateExtension } = await import("./activation/activate");

  return await activateExtension(context);
}

export function activate(context: vscode.ExtensionContext) {
  console.log('Extension activate called, NODE_ENV:', process.env.NODE_ENV);
  return dynamicImportAndActivate(context).catch((e) => {
    console.log("Error activating extension: ", e);
    Telemetry.capture(
      "vscode_extension_activation_error",
      {
        stack: extractMinimalStackTraceInfo(e.stack),
        message: e.message,
      },
      false,
      true,
    );
    vscode.window
      .showWarningMessage(
        "Error activating the Debugg AI extension.",
        "View Logs",
        "Retry",
      )
      .then((selection) => {
        if (selection === "View Logs") {
          vscode.commands.executeCommand("debugg-ai.viewLogs");
        } else if (selection === "Retry") {
          // Reload VS Code window
          vscode.commands.executeCommand("workbench.action.reloadWindow");
        }
      });
  });
}

export async function deactivate() {
  Telemetry.capture(
    "deactivate",
    {
      extensionVersion: getExtensionVersion(),
    },
    true,
  );

  Telemetry.shutdownPosthogClient();
  if (ngrokKill) {
    try {
      await ngrokKill();
    } catch (error: any) {
      console.warn('Failed to kill ngrok:', error.message);
    }
  }
}
