/* eslint-disable @typescript-eslint/naming-convention */
import * as os from "node:os";

import {
  ContextMenuConfig,
  ILLM,
  ModelInstaller,
  RangeInFileWithContents,
} from "core";
import { CompletionProvider } from "core/autocomplete/CompletionProvider";
import { ConfigHandler } from "core/config/ConfigHandler";
// import { ContinueServerClient } from "core/continueServer/stubs/client";
import { EXTENSION_NAME } from "core/control-plane/env";
import { Core } from "core/core";
import { LOCAL_DEV_DATA_VERSION } from "core/data/log";
import { DebuggAIServerClient } from "core/debuggAIServer/stubs/client";
import { E2eTestCommitSuite, E2eTestSuite, Issue } from 'core/debuggAIServer/types';
import { walkDirAsync } from "core/indexing/walkDir";
import { isModelInstaller } from "core/llm";
import { startLocalOllama } from "core/util/ollamaHelper";
import { getDevDataFilePath } from "core/util/paths";
import { Telemetry } from "core/util/posthog";
import readLastLines from "read-last-lines";
import * as vscode from "vscode";

import {
  getStatusBarStatus,
  getStatusBarStatusFromQuickPickItemLabel,
  quickPickStatusText,
  setupStatusBar,
  StatusBarStatus
} from "./autocomplete/statusBar";
import { SuggestionCodeLensProvider } from "./debug/codeLens/suggestionsLensProvider";
import { pullErrorsAndHighlight } from "./debug/pullErrors";
import { showSnippetWebview } from "./debug/webviews/snippetWebview";
import { DebuggGuiWebviewViewProvider } from "./DebuggGUIWebviewViewProvider";
import { VerticalDiffManager } from "./diff/vertical/manager";
import { ErrorFileDecorationProvider } from "./errorTracking/fileDecorations/ErrorFileDecoration";
import EditDecorationManager from "./quickEdit/EditDecorationManager";
import { QuickEdit, QuickEditShowParams } from "./quickEdit/QuickEditQuickPick";
import { CommitTester } from "./test/code-gen/commitTester";
import { AiE2eAgent, AiE2eAgentOptions } from "./test/e2e-agents/aiE2eAgent";
import { post } from "./util/axiosNaming";
import { Battery } from "./util/battery";
import { VsCodeIde } from "./VsCodeIde";

import type { VsCodeWebviewProtocol } from "./webviewProtocol";

// Global commit tester instance
let commitTester: CommitTester | null = null;

let fullScreenPanel: vscode.WebviewPanel | undefined;

function getFullScreenTab() {
  const tabs = vscode.window.tabGroups.all.flatMap((tabGroup) => tabGroup.tabs);
  return tabs.find((tab) =>
    (tab.input as any)?.viewType?.endsWith("debugg-ai.debuggaiGUIView"),
  );
}

type TelemetryCaptureParams = Parameters<typeof Telemetry.capture>;

/**
 * Helper method to add the `isCommandEvent` to all telemetry captures
 */
function captureCommandTelemetry(
  commandName: TelemetryCaptureParams[0],
  properties: TelemetryCaptureParams[1] = {},
) {
  Telemetry.capture(commandName, { isCommandEvent: true, ...properties });
}

function addCodeToContextFromRange(
  range: vscode.Range,
  webviewProtocol: VsCodeWebviewProtocol,
  prompt?: string,
) {
  const document = vscode.window.activeTextEditor?.document;

  if (!document) {
    return;
  }

  const rangeInFileWithContents = {
    filepath: document.uri.toString(),
    contents: document.getText(range),
    range: {
      start: {
        line: range.start.line,
        character: range.start.character,
      },
      end: {
        line: range.end.line,
        character: range.end.character,
      },
    },
  };

  webviewProtocol?.request("highlightedCode", {
    rangeInFileWithContents,
    prompt,
    // Assume `true` since range selection is currently only used for quick actions/fixes
    shouldRun: true,
  });
}

function getRangeInFileWithContents(
  allowEmpty?: boolean,
  range?: vscode.Range,
): RangeInFileWithContents | null {
  const editor = vscode.window.activeTextEditor;

  if (editor) {
    const selection = editor.selection;
    const filepath = editor.document.uri.toString();

    if (range) {
      const contents = editor.document.getText(range);

      return {
        range: {
          start: {
            line: range.start.line,
            character: range.start.character,
          },
          end: {
            line: range.end.line,
            character: range.end.character,
          },
        },
        filepath,
        contents,
      };
    }

    if (selection.isEmpty && !allowEmpty) {
      return null;
    }

    let selectionRange = new vscode.Range(selection.start, selection.end);
    const document = editor.document;
    // Select the context from the beginning of the selection start line to the selection start position
    const beginningOfSelectionStartLine = selection.start.with(undefined, 0);
    const textBeforeSelectionStart = document.getText(
      new vscode.Range(beginningOfSelectionStartLine, selection.start),
    );
    // If there are only whitespace before the start of the selection, include the indentation
    if (textBeforeSelectionStart.trim().length === 0) {
      selectionRange = selectionRange.with({
        start: beginningOfSelectionStartLine,
      });
    }

    const contents = editor.document.getText(selectionRange);

    return {
      filepath,
      contents,
      range: {
        start: {
          line: selection.start.line,
          character: selection.start.character,
        },
        end: {
          line: selection.end.line,
          character: selection.end.character,
        },
      },
    };
  }

  return null;
}

async function addHighlightedCodeToContext(
  webviewProtocol: VsCodeWebviewProtocol | undefined,
) {
  const rangeInFileWithContents = getRangeInFileWithContents();
  if (rangeInFileWithContents) {
    webviewProtocol?.request("highlightedCode", {
      rangeInFileWithContents,
    });
  }
}

async function addEntireFileToContext(
  uri: vscode.Uri,
  webviewProtocol: VsCodeWebviewProtocol | undefined,
) {
  // If a directory, add all files in the directory
  const stat = await vscode.workspace.fs.stat(uri);
  if (stat.type === vscode.FileType.Directory) {
    const files = await vscode.workspace.fs.readDirectory(uri);
    for (const [filename, type] of files) {
      if (type === vscode.FileType.File) {
        addEntireFileToContext(
          vscode.Uri.joinPath(uri, filename),
          webviewProtocol,
        );
      }
    }
    return;
  }

  // Get the contents of the file
  const contents = (await vscode.workspace.fs.readFile(uri)).toString();
  const rangeInFileWithContents = {
    filepath: uri.toString(),
    contents: contents,
    range: {
      start: {
        line: 0,
        character: 0,
      },
      end: {
        line: contents.split(os.EOL).length - 1,
        character: 0,
      },
    },
  };

  webviewProtocol?.request("highlightedCode", {
    rangeInFileWithContents,
  });
}

function focusGUI() {
  const fullScreenTab = getFullScreenTab();
  if (fullScreenTab) {
    // focus fullscreen
    fullScreenPanel?.reveal();
  } else {
    // focus sidebar
    vscode.commands.executeCommand("debugg-ai.debuggaiGUIView.focus");
    // vscode.commands.executeCommand("workbench.action.focusAuxiliaryBar");
  }
}

function hideGUI() {
  const fullScreenTab = getFullScreenTab();
  if (fullScreenTab) {
    // focus fullscreen
    fullScreenPanel?.dispose();
  } else {
    // focus sidebar
    // vscode.commands.executeCommand("workbench.action.closeAuxiliaryBar");
    vscode.commands.executeCommand("workbench.action.toggleAuxiliaryBar");
  }
}

async function processDiff(
  action: "accept" | "reject",
  sidebar: DebuggGuiWebviewViewProvider,
  ide: VsCodeIde,
  verticalDiffManager: VerticalDiffManager,
  newFileUri?: string,
  streamId?: string,
) {
  captureCommandTelemetry(`${action}Diff`);

  let newOrCurrentUri = newFileUri;
  if (!newOrCurrentUri) {
    const currentFile = await ide.getCurrentFile();
    newOrCurrentUri = currentFile?.path;
  }
  if (!newOrCurrentUri) {
    console.warn(
      `No file provided or current file open while attempting to resolve diff`,
    );
    return;
  }

  await ide.openFile(newOrCurrentUri);

  // Clear vertical diffs depending on action
  verticalDiffManager.clearForfileUri(newOrCurrentUri, action === "accept");

  void sidebar.webviewProtocol.request("setEditStatus", {
    status: "done",
  });

  if (streamId) {
    const fileContent = await ide.readFile(newOrCurrentUri);

    await sidebar.webviewProtocol.request("updateApplyState", {
      fileContent,
      filepath: newOrCurrentUri,
      streamId,
      status: "closed",
      numDiffs: 0,
    });
  }

  await sidebar.webviewProtocol.request("exitEditMode", undefined);
}

function waitForSidebarReady(
  sidebar: DebuggGuiWebviewViewProvider,
  timeout: number,
  interval: number,
): Promise<boolean> {
  return new Promise((resolve) => {
    const startTime = Date.now();

    const checkReadyState = () => {
      if (sidebar.isReady) {
        resolve(true);
      } else if (Date.now() - startTime >= timeout) {
        resolve(false); // Timed out
      } else {
        setTimeout(checkReadyState, interval);
      }
    };

    checkReadyState();
  });
}

// Copy everything over from extension.ts
const getCommandsMap: (
  ide: VsCodeIde,
  extensionContext: vscode.ExtensionContext,
  sidebar: DebuggGuiWebviewViewProvider,
  configHandler: ConfigHandler,
  verticalDiffManager: VerticalDiffManager,
  // continueServerClientPromise: Promise<ContinueServerClient>,
  debuggAIServerClientPromise: Promise<DebuggAIServerClient>,
  battery: Battery,
  quickEdit: QuickEdit,
  core: Core,
  editDecorationManager: EditDecorationManager,
  errorFileDecorationProvider: ErrorFileDecorationProvider,
) => { [command: string]: (...args: any) => any } = (
  ide,
  extensionContext,
  sidebar,
  configHandler,
  verticalDiffManager,
  debuggAIServerClientPromise,
  battery,
  quickEdit,
  core,
  editDecorationManager,
  errorFileDecorationProvider,
) => {
    /**
     * Streams an inline edit to the vertical diff manager.
     *
     * This function retrieves the configuration, determines the appropriate model title,
     * increments the FTC count, and then streams an edit to the
     * vertical diff manager.
     *
     * @param  promptName - The key for the prompt in the context menu configuration.
     * @param  fallbackPrompt - The prompt to use if the configured prompt is not available.
     * @param  [onlyOneInsertion] - Optional. If true, only one insertion will be made.
     * @param  [range] - Optional. The range to edit if provided.
     * @returns
     */
    async function streamInlineEdit(
      promptName: keyof ContextMenuConfig,
      fallbackPrompt: string,
      onlyOneInsertion?: boolean,
      range?: vscode.Range,
    ) {
      const { config } = await configHandler.loadConfig();
      if (!config) {
        throw new Error("Config not loaded");
      }

      const modelTitle =
        config.selectedModelByRole.edit?.title ??
        (await sidebar.webviewProtocol.request(
          "getDefaultModelTitle",
          undefined,
        ));

      void sidebar.webviewProtocol.request("incrementFtc", undefined);

      await verticalDiffManager.streamEdit(
        config.experimental?.contextMenuPrompts?.[promptName] ?? fallbackPrompt,
        modelTitle,
        undefined,
        onlyOneInsertion,
        undefined,
        range,
      );
    }
    /**
     * Inserts the suggested fix inline for a given issue.
     * This function retrieves the model title and config,
     * finds the appropriate file change for the current file,
     * determines the target range based on snippet update line numbers,
     * and calls verticalDiffManager.insertEdit to inject the new code.
     *
     * @param issue The issue containing a solution with file changes.
     */
    async function insertInlineEdit(uri: vscode.Uri, issue: Issue): Promise<void> {
      const { config } = await configHandler.loadConfig();
      if (!config) {
        throw new Error("Config not loaded");
      }

      const modelTitle =
        config.selectedModelByRole.edit?.title ??
        (await sidebar.webviewProtocol.request("getDefaultModelTitle", undefined));

      void sidebar.webviewProtocol.request("incrementFtc", undefined);

      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage("No active editor found");
        return;
      }

      if (!issue.solution) {
        throw new Error("Issue has no solution.");
      }

      // Find the file change corresponding to the currently open file.
      const fileChange = issue.solution.changes.find(
        change => editor.document.uri.fsPath.includes(change.filePath)
      );
      if (!fileChange) {
        throw new Error("No solution available for the current file.");
      }

      // For this example, use the first snippet update.
      const snippetUpdate = fileChange.snippetsToUpdate[0];
      if (!snippetUpdate) {
        throw new Error("No snippet update found for this file.");
      }

      // Convert 1-indexed line numbers to 0-indexed positions.
      const startLineIndex = snippetUpdate.startLine - 1;
      const endLineIndex = snippetUpdate.endLine - 1;

      // Create a range covering from the start of the start line to the end of the end line.
      const range = new vscode.Range(
        new vscode.Position(startLineIndex, 0),
        new vscode.Position(
          endLineIndex,
          editor.document.lineAt(endLineIndex).text.length
        )
      );

      // Call insertEdit on verticalDiffManager. In this case:
      // - input: We pass the original snippet (or prompt) as input.
      // - modelTitle: as determined above.
      // - streamId, onlyOneInsertion, quickEdit: not needed (or false/undefined).
      // - range: the range to update.
      // - newCode: the final code snippet to insert.
      const result = await verticalDiffManager.insertEdit(
        snippetUpdate.newContent,   // input (could be used for context)
        modelTitle,
        undefined,               // streamId (not needed here)
        false,                   // onlyOneInsertion flag
        undefined,               // quickEdit (not used)
        range,                   // range to update
        snippetUpdate.newContent    // newCode: final suggested solution
      );

      if (result) {
        vscode.window.showInformationMessage("Suggested fix preview inserted successfully.");
      } else {
        vscode.window.showErrorMessage("Failed to insert suggested fix.");
      }
    }
    return {
      "debugg-ai.acceptDiff": async (newFileUri?: string, streamId?: string) =>
        processDiff(
          "accept",
          sidebar,
          ide,
          verticalDiffManager,
          newFileUri,
          streamId,
        ),

      "debugg-ai.rejectDiff": async (newFilepath?: string, streamId?: string) =>
        processDiff(
          "reject",
          sidebar,
          ide,
          verticalDiffManager,
          newFilepath,
          streamId,
        ),
      "debugg-ai.acceptVerticalDiffBlock": (fileUri?: string, index?: number) => {
        captureCommandTelemetry("acceptVerticalDiffBlock");
        verticalDiffManager.acceptRejectVerticalDiffBlock(true, fileUri, index);
      },
      "debugg-ai.rejectVerticalDiffBlock": (fileUri?: string, index?: number) => {
        captureCommandTelemetry("rejectVerticalDiffBlock");
        verticalDiffManager.acceptRejectVerticalDiffBlock(false, fileUri, index);
      },
      "debugg-ai.quickFix": async (
        range: vscode.Range,
        diagnosticMessage: string,
      ) => {
        captureCommandTelemetry("quickFix");

        const prompt = `Please explain the cause of this error and how to solve it: ${diagnosticMessage}`;

        addCodeToContextFromRange(range, sidebar.webviewProtocol, prompt);

        vscode.commands.executeCommand("debugg-ai.debuggaiGUIView.focus");
      },
      // Passthrough for telemetry purposes
      "debugg-ai.defaultQuickAction": async (args: QuickEditShowParams) => {
        captureCommandTelemetry("defaultQuickAction");
        vscode.commands.executeCommand("debugg-ai.focusEdit", args);
      },
      "debugg-ai.customQuickActionSendToChat": async (
        prompt: string,
        range: vscode.Range,
      ) => {
        captureCommandTelemetry("customQuickActionSendToChat");

        addCodeToContextFromRange(range, sidebar.webviewProtocol, prompt);

        vscode.commands.executeCommand("debugg-ai.debuggaiGUIView.focus");
      },
      "debugg-ai.customQuickActionStreamInlineEdit": async (
        prompt: string,
        range: vscode.Range,
      ) => {
        captureCommandTelemetry("customQuickActionStreamInlineEdit");

        streamInlineEdit("docstring", prompt, false, range);
      },
      "debugg-ai.codebaseForceReIndex": async () => {
        core.invoke("index/forceReIndex", undefined);
      },
      "debugg-ai.rebuildCodebaseIndex": async () => {
        core.invoke("index/forceReIndex", { shouldClearIndexes: true });
      },
      "debugg-ai.docsIndex": async () => {
        core.invoke("context/indexDocs", { reIndex: false });
      },
      "debugg-ai.docsReIndex": async () => {
        core.invoke("context/indexDocs", { reIndex: true });
      },
      "debugg-ai.focusContinueInput": async () => {
        const isContinueInputFocused = await sidebar.webviewProtocol.request(
          "isContinueInputFocused",
          undefined,
          false,
        );

        // This is a temporary fix—sidebar.webviewProtocol.request is blocking
        // when the GUI hasn't yet been setup and we should instead be
        // immediately throwing an error, or returning a Result object
        focusGUI();
        if (!sidebar.isReady) {
          const isReady = await waitForSidebarReady(sidebar, 5000, 100);
          if (!isReady) {
            return;
          }
        }

        const historyLength = await sidebar.webviewProtocol.request(
          "getWebviewHistoryLength",
          undefined,
          false,
        );

        if (isContinueInputFocused) {
          if (historyLength === 0) {
            hideGUI();
          } else {
            void sidebar.webviewProtocol?.request(
              "focusContinueInputWithNewSession",
              undefined,
              false,
            );
          }
        } else {
          focusGUI();
          sidebar.webviewProtocol?.request(
            "focusContinueInputWithNewSession",
            undefined,
            false,
          );
          void addHighlightedCodeToContext(sidebar.webviewProtocol);
        }
      },
      "debugg-ai.focusContinueInputWithoutClear": async () => {
        const isContinueInputFocused = await sidebar.webviewProtocol.request(
          "isContinueInputFocused",
          undefined,
          false,
        );

        // This is a temporary fix—sidebar.webviewProtocol.request is blocking
        // when the GUI hasn't yet been setup and we should instead be
        // immediately throwing an error, or returning a Result object
        focusGUI();
        if (!sidebar.isReady) {
          const isReady = await waitForSidebarReady(sidebar, 5000, 100);
          if (!isReady) {
            return;
          }
        }

        if (isContinueInputFocused) {
          hideGUI();
        } else {
          focusGUI();

          sidebar.webviewProtocol?.request(
            "focusContinueInputWithoutClear",
            undefined,
          );

          void addHighlightedCodeToContext(sidebar.webviewProtocol);
        }
      },
      // QuickEditShowParams are passed from CodeLens, temp fix
      // until we update to new params specific to Edit
      "debugg-ai.focusEdit": async (args?: QuickEditShowParams) => {
        captureCommandTelemetry("focusEdit");
        focusGUI();

        sidebar.webviewProtocol?.request("focusEdit", undefined);

        const editor = vscode.window.activeTextEditor;

        if (!editor) {
          return;
        }

        const existingDiff = verticalDiffManager.getHandlerForFile(
          editor.document.fileName,
        );

        // If there's a diff currently being applied, then we just toggle focus back to the input
        if (existingDiff) {
          sidebar.webviewProtocol?.request("focusContinueInput", undefined);
          return;
        }

        const startFromCharZero = editor.selection.start.with(undefined, 0);
        const document = editor.document;
        let lastLine, lastChar;
        // If the user selected onto a trailing line but didn't actually include any characters in it
        // they don't want to include that line, so trim it off.
        if (editor.selection.end.character === 0) {
          // This is to prevent the rare case that the previous line gets selected when user
          // is selecting nothing and the cursor is at the beginning of the line
          if (editor.selection.end.line === editor.selection.start.line) {
            lastLine = editor.selection.start.line;
          } else {
            lastLine = editor.selection.end.line - 1;
          }
        } else {
          lastLine = editor.selection.end.line;
        }
        lastChar = document.lineAt(lastLine).range.end.character;
        const endAtCharLast = new vscode.Position(lastLine, lastChar);
        const range =
          args?.range ?? new vscode.Range(startFromCharZero, endAtCharLast);

        editDecorationManager.setDecoration(editor, range);

        const rangeInFileWithContents = getRangeInFileWithContents(true, range);

        if (rangeInFileWithContents) {
          sidebar.webviewProtocol?.request(
            "addCodeToEdit",
            rangeInFileWithContents,
          );

          // Un-select the current selection
          editor.selection = new vscode.Selection(
            editor.selection.anchor,
            editor.selection.anchor,
          );
        }
      },
      "debugg-ai.focusEditWithoutClear": async () => {
        captureCommandTelemetry("focusEditWithoutClear");
        focusGUI();

        sidebar.webviewProtocol?.request("focusEditWithoutClear", undefined);

        const editor = vscode.window.activeTextEditor;

        if (!editor) {
          return;
        }

        const document = editor.document;

        const existingDiff = verticalDiffManager.getHandlerForFile(
          document.fileName,
        );

        // If there's a diff currently being applied, then we just toggle focus back to the input
        if (existingDiff) {
          sidebar.webviewProtocol?.request("focusContinueInput", undefined);
          return;
        }

        const rangeInFileWithContents = getRangeInFileWithContents(false);

        if (rangeInFileWithContents) {
          sidebar.webviewProtocol?.request(
            "addCodeToEdit",
            rangeInFileWithContents,
          );
        } else {
          const contents = document.getText();

          sidebar.webviewProtocol?.request("addCodeToEdit", {
            filepath: document.uri.toString(),
            contents,
          });
        }
      },
      "debugg-ai.exitEditMode": async () => {
        captureCommandTelemetry("exitEditMode");
        editDecorationManager.clear();
        void sidebar.webviewProtocol?.request("exitEditMode", undefined);
      },
      // "debugg-ai.quickEdit": async (args: QuickEditShowParams) => {
      //   let linesOfCode = undefined;
      //   if (args.range) {
      //     linesOfCode = args.range.end.line - args.range.start.line;
      //   }
      //   captureCommandTelemetry("quickEdit", {
      //     linesOfCode,
      //   });
      //   quickEdit.show(args);
      // },
      "debugg-ai.writeCommentsForCode": async () => {
        captureCommandTelemetry("writeCommentsForCode");

        streamInlineEdit(
          "comment",
          "Write comments for this code. Do not change anything about the code itself.",
        );
      },
      "debugg-ai.writeDocstringForCode": async () => {
        captureCommandTelemetry("writeDocstringForCode");

        streamInlineEdit(
          "docstring",
          "Write a docstring for this code. Do not change anything about the code itself.",
          true,
        );
      },
      "debugg-ai.fixCode": async () => {
        captureCommandTelemetry("fixCode");

        streamInlineEdit(
          "fix",
          "Fix this code. If it is already 100% correct, simply rewrite the code.",
        );
      },
      "debugg-ai.optimizeCode": async () => {
        captureCommandTelemetry("optimizeCode");
        streamInlineEdit("optimize", "Optimize this code");
      },
      "debugg-ai.fixGrammar": async () => {
        captureCommandTelemetry("fixGrammar");
        streamInlineEdit(
          "fixGrammar",
          "If there are any grammar or spelling mistakes in this writing, fix them. Do not make other large changes to the writing.",
        );
      },
      "debugg-ai.viewLogs": async () => {
        captureCommandTelemetry("viewLogs");
        vscode.commands.executeCommand("workbench.action.toggleDevTools");
      },
      "debugg-ai.debugTerminal": async () => {
        captureCommandTelemetry("debugTerminal");

        const terminalContents = await ide.getTerminalContents();

        vscode.commands.executeCommand("debugg-ai.debuggaiGUIView.focus");

        sidebar.webviewProtocol?.request("userInput", {
          input: `I got the following error, can you please help explain how to fix it?\n\n${terminalContents.trim()}`,
        });
      },
      "debugg-ai.hideInlineTip": () => {
        vscode.workspace
          .getConfiguration(EXTENSION_NAME)
          .update("showInlineTip", false, vscode.ConfigurationTarget.Global);
      },

      // Commands without keyboard shortcuts
      "debugg-ai.addModel": () => {
        captureCommandTelemetry("addModel");

        vscode.commands.executeCommand("debugg-ai.debuggaiGUIView.focus");
        sidebar.webviewProtocol?.request("addModel", undefined);
      },
      "debugg-ai.sendMainUserInput": (text: string) => {
        sidebar.webviewProtocol?.request("userInput", {
          input: text,
        });
      },
      "debugg-ai.selectRange": (startLine: number, endLine: number) => {
        if (!vscode.window.activeTextEditor) {
          return;
        }
        vscode.window.activeTextEditor.selection = new vscode.Selection(
          startLine,
          0,
          endLine,
          0,
        );
      },
      "debugg-ai.foldAndUnfold": (
        foldSelectionLines: number[],
        unfoldSelectionLines: number[],
      ) => {
        vscode.commands.executeCommand("editor.unfold", {
          selectionLines: unfoldSelectionLines,
        });
        vscode.commands.executeCommand("editor.fold", {
          selectionLines: foldSelectionLines,
        });
      },
      "debugg-ai.sendToTerminal": (text: string) => {
        captureCommandTelemetry("sendToTerminal");
        ide.runCommand(text);
      },
      "debugg-ai.showE2es": () => {
        vscode.commands.executeCommand("debugg-ai.navigateTo", "/", true);
      },
      "debugg-ai.showE2eSuites": () => {
        vscode.commands.executeCommand("debugg-ai.navigateTo", "/e2e-suites", true);
      },
      "debugg-ai.showE2eCommitSuites": () => {
        vscode.commands.executeCommand("debugg-ai.navigateTo", "/e2e-commit-suites", true);
      },
      "debugg-ai.newSession": () => {
        sidebar.webviewProtocol?.request("newSession", undefined);
      },
      "debugg-ai.viewHistory": () => {
        vscode.commands.executeCommand("debugg-ai.navigateTo", "/history", true);
      },
      "debugg-ai.focusContinueSessionId": async (
        sessionId: string | undefined,
      ) => {
        if (!sessionId) {
          sessionId = await vscode.window.showInputBox({
            prompt: "Enter the Session ID",
          });
        }
        void sidebar.webviewProtocol?.request("focusContinueSessionId", {
          sessionId,
        });
      },
      "debugg-ai.applyCodeFromChat": () => {
        void sidebar.webviewProtocol.request("applyCodeFromChat", undefined);
      },
      "debugg-ai.toggleFullScreen": async () => {
        focusGUI();

        const sessionId = await sidebar.webviewProtocol.request(
          "getCurrentSessionId",
          undefined,
        );
        // Check if full screen is already open by checking open tabs
        const fullScreenTab = getFullScreenTab();

        if (fullScreenTab && fullScreenPanel) {
          // Full screen open, but not focused - focus it
          fullScreenPanel.reveal();
          return;
        }

        // Clear the sidebar to prevent overwriting changes made in fullscreen
        vscode.commands.executeCommand("debugg-ai.newSession");

        // Full screen not open - open it
        captureCommandTelemetry("openFullScreen");

        // Create the full screen panel
        let panel = vscode.window.createWebviewPanel(
          "debugg-ai.debuggaiGUIView",
          "Debugg AI",
          vscode.ViewColumn.One,
          {
            retainContextWhenHidden: true,
            enableScripts: true,
          },
        );
        fullScreenPanel = panel;

        // Add content to the panel
        panel.webview.html = sidebar.getSidebarContent(
          extensionContext,
          panel,
          undefined,
          undefined,
          true,
        );

        const sessionLoader = panel.onDidChangeViewState(() => {
          vscode.commands.executeCommand("debugg-ai.newSession");
          if (sessionId) {
            vscode.commands.executeCommand(
              "debugg-ai.focusContinueSessionId",
              sessionId,
            );
          }
          panel.reveal();
          sessionLoader.dispose();
        });

        // When panel closes, reset the webview and focus
        panel.onDidDispose(
          () => {
            sidebar.resetWebviewProtocolWebview();
            vscode.commands.executeCommand("debugg-ai.focusContinueInput");
          },
          null,
          extensionContext.subscriptions,
        );

        vscode.commands.executeCommand("workbench.action.copyEditorToNewWindow");
        vscode.commands.executeCommand("workbench.action.closeAuxiliaryBar");
      },
      "debugg-ai.openConfigPage": () => {
        vscode.commands.executeCommand("debugg-ai.navigateTo", "/config", true);
      },
      "debugg-ai.selectFilesAsContext": async (
        firstUri: vscode.Uri,
        uris: vscode.Uri[],
      ) => {
        if (uris === undefined) {
          throw new Error("No files were selected");
        }

        vscode.commands.executeCommand("debugg-ai.debuggaiGUIView.focus");

        for (const uri of uris) {
          // If it's a folder, add the entire folder contents recursively by using walkDir (to ignore ignored files)
          const isDirectory = await vscode.workspace.fs
            .stat(uri)
            ?.then((stat) => stat.type === vscode.FileType.Directory);
          if (isDirectory) {
            for await (const fileUri of walkDirAsync(uri.toString(), ide, {
              source: "vscode continue.selectFilesAsContext command",
            })) {
              addEntireFileToContext(
                vscode.Uri.parse(fileUri),
                sidebar.webviewProtocol,
              );
            }
          } else {
            addEntireFileToContext(uri, sidebar.webviewProtocol);
          }
        }
      },
      "debugg-ai.logAutocompleteOutcome": (
        completionId: string,
        completionProvider: CompletionProvider,
      ) => {
        completionProvider.accept(completionId);
      },
      "debugg-ai.toggleTabAutocompleteEnabled": () => {
        // This is the command that toggles in the bottom right of the window
        // footer bar. The little menus pop up in the search bar when you click the 
        // button. 
        captureCommandTelemetry("toggleTabAutocompleteEnabled");

        const config = vscode.workspace.getConfiguration(EXTENSION_NAME);
        const enabled = config.get("enableTabAutocomplete");
        const pauseOnBattery = config.get<boolean>(
          "pauseTabAutocompleteOnBattery",
        );
        if (!pauseOnBattery || battery.isACConnected()) {
          config.update(
            "enableTabAutocomplete",
            !enabled,
            vscode.ConfigurationTarget.Global,
          );
        } else {
          if (enabled) {
            const running = getStatusBarStatus() === StatusBarStatus.Running;
            if (running) {
              setupStatusBar(StatusBarStatus.Active);
            } else {
              config.update(
                "enableTabAutocomplete",
                false,
                vscode.ConfigurationTarget.Global,
              );
            }
          } else {
            setupStatusBar(StatusBarStatus.Running);
            config.update(
              "enableTabAutocomplete",
              true,
              vscode.ConfigurationTarget.Global,
            );
          }
        }
      },
      "debugg-ai.openE2eTestingMenu": async () => {
        captureCommandTelemetry("openE2eTestingMenu");

        const quickPick = vscode.window.createQuickPick();
        const currentStatus = getStatusBarStatus();

        quickPick.items = [
          {
            label: "$(rocket) Create New E2E Test",
            description: "Generate a new E2E test with AI",
          },
          {
            label: "$(play) Run E2E Test",
            description: "Run an existing E2E test",
          },
          {
            label: "$(tools) Generate E2E Test Suite",
            description: "Create multiple tests for a feature",
          },
          {
            label: "$(list-tree) Run E2E Test Suite",
            description: "Execute a complete test suite",
          },
          {
            kind: vscode.QuickPickItemKind.Separator,
            label: "Test Management",
          },
          {
            label: "$(file-code) Generate Tests for Working Changes",
            description: "Create tests for uncommitted code changes",
          },
          {
            label: "$(eye) Show E2E Tests",
            description: "View all E2E tests",
          },
          {
            label: "$(layers) Show E2E Test Suites",
            description: "View all test suites",
          },
          {
            label: "$(git-commit) Show Commit Test Suites",
            description: "View commit-based test suites",
          },
          {
            kind: vscode.QuickPickItemKind.Separator,
            label: "Status & Settings",
          },
          {
            label: quickPickStatusText(currentStatus),
            description: "Toggle E2E testing status",
          },
          {
            label: "$(gear) Configuration",
            description: "Open E2E testing configuration",
          },
          {
            label: "$(question) Help & Documentation",
            description: "Get help with E2E testing",
          },
        ];

        quickPick.onDidAccept(() => {
          const selectedOption = quickPick.selectedItems[0].label;
          
          switch (selectedOption) {
            case "$(rocket) Create New E2E Test":
              vscode.commands.executeCommand("debugg-ai.createNewE2eTest");
              break;
            case "$(play) Run E2E Test":
              vscode.commands.executeCommand("debugg-ai.runE2eTest");
              break;
            case "$(tools) Generate E2E Test Suite":
              vscode.commands.executeCommand("debugg-ai.runE2eSuiteGenerator");
              break;
            case "$(list-tree) Run E2E Test Suite":
              vscode.commands.executeCommand("debugg-ai.runE2eTestSuite");
              break;
            case "$(file-code) Generate Tests for Working Changes":
              vscode.commands.executeCommand("debugg-ai.generateTestsForWorkingChanges");
              break;
            case "$(eye) Show E2E Tests":
              vscode.commands.executeCommand("debugg-ai.showE2es");
              break;
            case "$(layers) Show E2E Test Suites":
              vscode.commands.executeCommand("debugg-ai.showE2eSuites");
              break;
            case "$(git-commit) Show Commit Test Suites":
              vscode.commands.executeCommand("debugg-ai.showE2eCommitSuites");
              break;
            case "$(gear) Configuration":
              vscode.commands.executeCommand("debugg-ai.openConfigPage");
              break;
            case "$(question) Help & Documentation":
              focusGUI();
              vscode.commands.executeCommand("debugg-ai.navigateTo", "/more", true);
              break;
            default:
              // Handle status toggle
              const targetStatus = getStatusBarStatusFromQuickPickItemLabel(selectedOption);
              if (targetStatus !== undefined) {
                setupStatusBar(targetStatus);
                const config = vscode.workspace.getConfiguration(EXTENSION_NAME);
                config.update(
                  "enableE2eTesting",
                  targetStatus === StatusBarStatus.Active,
                  vscode.ConfigurationTarget.Global,
                );
              }
              break;
          }
          quickPick.dispose();
        });
        quickPick.show();
      },
      "debugg-ai.giveAutocompleteFeedback": async () => {
        const feedback = await vscode.window.showInputBox({
          ignoreFocusOut: true,
          prompt:
            "Please share what went wrong with the last completion. The details of the completion as well as this message will be sent to the Continue team in order to improve.",
        });
        if (feedback) {
          const client = await debuggAIServerClientPromise;
          const completionsPath = getDevDataFilePath(
            "autocomplete",
            LOCAL_DEV_DATA_VERSION,
          );

          const lastLines = await readLastLines.read(completionsPath, 2);
          client.sendFeedback(feedback, lastLines);
        }
      },
      "debugg-ai.openMorePage": () => {
        vscode.commands.executeCommand("debugg-ai.navigateTo", "/more", true);
      },
      "debugg-ai.navigateTo": (path: string, toggle: boolean) => {
        sidebar.webviewProtocol?.request("navigateTo", { path, toggle });
        focusGUI();
      },
      "debugg-ai.startLocalOllama": () => {
        startLocalOllama(ide);
      },
      "debugg-ai.installModel": async (
        modelName: string,
        llmProvider: ILLM | undefined,
      ) => {
        try {
          if (!isModelInstaller(llmProvider)) {
            const msg = llmProvider
              ? `LLM provider '${llmProvider.providerName}' does not support installing models`
              : "Missing LLM Provider";
            throw new Error(msg);
          }
          await installModelWithProgress(modelName, llmProvider);
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          vscode.window.showErrorMessage(
            `Failed to install '${modelName}': ${message}`,
          );
        }
      },
      "debugg-ai.highlightErrors": async () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          await pullErrorsAndHighlight(editor);
        }
      },
      "debugg-ai.applyFix": async (documentUri: vscode.Uri, range: vscode.Range, newCode: string) => {
        try {
          // 1. Open the document
          const doc = await vscode.workspace.openTextDocument(documentUri);
          const editor = await vscode.window.showTextDocument(doc);

          // 2. Replace the text in the given range with `newCode`
          await editor.edit(editBuilder => {
            editBuilder.replace(range, newCode);
          });

          // 3. Clear suggestions for this file since we've applied one
          const codeLensProvider = SuggestionCodeLensProvider.getInstance();
          codeLensProvider.setSuggestionsForFile(documentUri.fsPath, []);

          vscode.window.showInformationMessage('Applied the suggested fix successfully!');
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to apply fix: ${error}`);
        }
      },

      // ----------------------------------------------------------
      // New "buttons" or "inline commands" for Overview, Fix, Coverage
      // ----------------------------------------------------------
      /**
       * Show an overview of the line (e.g. show info in a popup or side panel)
       */
      "debugg-ai.showOverview": async (uri?: vscode.Uri, line?: number) => {
        captureCommandTelemetry("debugg-ai.showOverview");

        // Example: we just show a popup with info
        vscode.window.showInformationMessage(
          `Showing Overview for line ${line != null ? line + 1 : "??"} in ${uri?.fsPath ?? ""}`
        );
        // Possibly open a webview or do more advanced logic
      },

      /**
       * Apply a suggested fix (e.g. replace code in the editor).
       */
      "debugg-ai.applySuggestedFix": async (uri?: vscode.Uri, line?: number, issue?: Issue) => {
        captureCommandTelemetry("debugg-ai.applySuggestedFix");

        if (!uri || !issue || !line) {
          vscode.window.showWarningMessage("Not enough info to apply fix!");
          return;
        }

        insertInlineEdit(uri, issue);
        // await previewSuggestedFix(uri, issue);
        // await applySuggestedFix(uri, issue);

        // Clear suggestions for this file since we've applied one
        // const codeLensProvider = SuggestionCodeLensProvider.getInstance();
        // codeLensProvider.setSuggestionsForFile(uri.fsPath, []);

        // vscode.window.showInformationMessage(`Applied fix for issue - ${issue.title}`);
      },

      /**
       * Mark the issue as resolved.
       */
      "debugg-ai.markResolved": async (uri?: vscode.Uri, line?: number, issue?: Issue) => {
        captureCommandTelemetry("debugg-ai.markResolved");

        if (!issue) {
          // vscode.window.showWarningMessage("No issue ID provided.");
          return;
        }

        // Call the API to mark the issue as resolved
        const response = await post(`/api/v1/issues/${issue.uuid}/resolve/`);
        console.log(response);
        vscode.window.showInformationMessage("Issue marked as resolved!");
      },

      /**
       * Show test coverage for the given line (e.g. open a coverage report).
       */
      "debugg-ai.showTestCoverage": async (uri?: vscode.Uri, line?: number) => {
        captureCommandTelemetry("debugg-ai.showTestCoverage");

        vscode.window.showInformationMessage(
          `Showing test coverage for line ${line != null ? line + 1 : "??"} in ${uri?.fsPath ?? ""}`
        );
        // Possibly open a coverage file, or show an inline coverage annotation, etc.
      },
      /**
       * Display the snippet preview webview.
       */
      "debugg-ai.showSnippetPreview": async (snippet?: string) => {
        captureCommandTelemetry("debugg-ai.showSnippetPreview");

        if (!snippet) {
          vscode.window.showWarningMessage("No snippet provided for preview.");
          return;
        }

        if (!extensionContext) {
          vscode.window.showWarningMessage("Failed to get extension context.");
          return;
        }
        const snip = 'console.log("Hello from snippet!")';
        showSnippetWebview(extensionContext, snip);
      },
      /**
       * Highlight files with errors on the sidebar
       */
      "debugg-ai.showFilesWithErrors": async () => {
        captureCommandTelemetry("debugg-ai.showFilesWithErrors");
        const client = await debuggAIServerClientPromise;
        const errorFiles = await client.issues?.getRecentIssues();
        if (errorFiles) {
          errorFileDecorationProvider.updateErrorFiles(errorFiles.map(f => f.filePath));
        }
      },
      "debugg-ai.createNewE2eTest": async (description?: string) => {
        captureCommandTelemetry("debugg-ai.createNewE2eTest");
        const getTestDescription = async () => {
          // If description is provided as parameter, use it; otherwise prompt user
          if (description && description.trim() !== '') {
            return description.trim();
          }
          const testDescription = await vscode.window.showInputBox({
            prompt: 'Provide a description for the new E2E test',
          });
          return testDescription;
        };
        const { config } = await configHandler.loadConfig();
        let localPortConfig = config?.debuggAiServerPort;
        if (!localPortConfig) {
          const localPort = await vscode.window.showInputBox({
            prompt: 'Provide the port number for the local server',
            value: '3000',
          });
          if (!localPort) {
            vscode.window.showWarningMessage("⚠️ No local port provided. A port number is required to run the server.");
            return;
          }
          localPortConfig = parseInt(localPort, 10);
        }
        console.log("Local port config - ", localPortConfig);
        const client = await debuggAIServerClientPromise;
        const testDescription = await getTestDescription();
        if (!testDescription) {
          vscode.window.showWarningMessage("⚠️ No test description provided. Please provide a description to create the E2E test.");
          return;
        }
        
        vscode.window.showInformationMessage(`🚀 Starting E2E test creation: ${testDescription}`);
        try {
          // Configure AiE2eAgent with E2E test creation settings
          const agentOptions: AiE2eAgentOptions = {
            testObjectType: "e2e-test",
            testRunType: "run",
            remote: true,
            localServerPort: localPortConfig,
            testParams: {
              description: testDescription
            }
          };
          
          // Create and run the AiE2eAgent
          const aiE2eAgent = new AiE2eAgent(client, ide, agentOptions);
          await aiE2eAgent.testHandler.run();
          vscode.window.showInformationMessage(`✅ E2E test created successfully: ${testDescription}`);
        } catch (error) {
          vscode.window.showErrorMessage(`❌ Failed to create E2E test: ${error instanceof Error ? error.message : String(error)}`);
        }
      },
      "debugg-ai.runE2eTest": async () => {
        captureCommandTelemetry("debugg-ai.runE2eTest");
        const { config } = await configHandler.loadConfig();
        let localPortConfig = config?.debuggAiServerPort;
        const getTestDescription = async () => {
          const testDescription = await vscode.window.showInputBox({
            prompt: 'What test do you want to run? (e.g. Test my login page...)'
          });
          return testDescription;
        };
        console.log("Local port config - ", localPortConfig);
        const client = await debuggAIServerClientPromise;
        const testDescription = await getTestDescription();
        if (!testDescription) {
          vscode.window.showWarningMessage("⚠️ No test description provided. Please provide a description to run the E2E test.");
          return;
        }
        
        vscode.window.showInformationMessage(`🏃 Starting E2E test run: ${testDescription}`);
        try {
          // Configure AiE2eAgent with E2E test run settings
          const agentOptions: AiE2eAgentOptions = {
            testObjectType: "e2e-test",
            testRunType: "run",
            remote: true,
            localServerPort: localPortConfig ?? 3000,
            testParams: {
              description: testDescription
            }
          };
          
          // Create and run the AiE2eAgent
          const aiE2eAgent = new AiE2eAgent(client, ide, agentOptions);
          await aiE2eAgent.testHandler.run();
          vscode.window.showInformationMessage(`✅ E2E test completed: ${testDescription}`);
        } catch (error) {
          vscode.window.showErrorMessage(`❌ E2E test failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      },
      "debugg-ai.runE2eSuiteGenerator": async (description?: string) => {
        captureCommandTelemetry("debugg-ai.runE2eSuiteGenerator");
        vscode.window.setStatusBarMessage("Running E2E test generator...", 2500);

        const getTestDescription = async () => {
          // If description is provided as parameter, use it; otherwise prompt user
          if (description) {
            return description;
          }
          const testDescription = await vscode.window.showInputBox({
            prompt: 'What section of the app do you want to create test suites for?',
            value: 'User authentication',
          });
          return testDescription;
        };
        const { config } = await configHandler.loadConfig();
        let localPortConfig = config?.debuggAiServerPort;
        if (!localPortConfig) {
          const localPort = await vscode.window.showInputBox({
            prompt: 'Provide the port number for the local server',
            value: '3000',
          });
          if (!localPort) {
            vscode.window.showWarningMessage("⚠️ No local port provided. A port number is required to run the server.");
            return;
          }
          localPortConfig = parseInt(localPort, 10);
        }
        console.log("Local port config - ", localPortConfig);
        const client = await debuggAIServerClientPromise;
        const testDescription = await getTestDescription();
        if (!testDescription) {
          vscode.window.showWarningMessage("⚠️ No test description provided. Please provide a description to generate the E2E test suite.");
          return;
        }
        
        vscode.window.showInformationMessage(`🔧 Generating E2E test suite for: ${testDescription}`);
        try {
          // Configure AiE2eAgent with E2E test suite generation settings
          const agentOptions: AiE2eAgentOptions = {
            testObjectType: "test-suite",
            testRunType: "generate",
            remote: true,
            localServerPort: localPortConfig,
            testParams: {
              description: testDescription
            }
          };
          
          // Create and run the AiE2eAgent
          const aiE2eAgent = new AiE2eAgent(client, ide, agentOptions);
          await aiE2eAgent.testHandler.run();
          vscode.window.showInformationMessage(`✅ E2E test suite generated successfully for: ${testDescription}`);
        } catch (error) {
          vscode.window.showErrorMessage(`❌ Failed to generate E2E test suite: ${error instanceof Error ? error.message : String(error)}`);
        }

      },
      "debugg-ai.runE2eTestSuite": async (uuid?: string) => {
        captureCommandTelemetry("debugg-ai.runE2eTestSuite");
        vscode.window.setStatusBarMessage("Fetching E2E test suites...", 2500);

        const client = await debuggAIServerClientPromise;

        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showWarningMessage("⚠️ No file is currently open. Please open a file from your repository first.");
          return;
        }
        const { repoName, repoPath, branchName } = await client.getRepoInfo(editor.document.uri.fsPath);
        if (!repoName || !repoPath || !branchName) {
          console.debug("No repo name, path, or branch name found for file");
        }
        let selectedSuite: E2eTestSuite | undefined = undefined;
        if (uuid) {
          selectedSuite = await client.e2es?.getE2eTestSuite(uuid) ?? undefined;
          if (!selectedSuite) {
            vscode.window.showWarningMessage("⚠️ Selected E2E test suite not found. Please try selecting a different suite.");
            return;
          }
        } else {
          const testSuitesPaginated = await client.e2es?.listE2eTestSuites({
            repoName,
            repoPath,
            branchName,
          });
          const testSuites = testSuitesPaginated?.results ?? [];
          if (!testSuites || !testSuites.length) {
            vscode.window.showWarningMessage("⚠️ No E2E test suites found. Create a test suite first using the 'Generate E2E Test Suite' command.");
            return;
          }

          // Show dropdown
          const selected = await vscode.window.showQuickPick(
            testSuites.map((suite: E2eTestSuite) => ({
              label: suite.name,
              uuid: suite.uuid,
              description: suite.description || undefined,
              detail: `ID: ${suite.uuid}`,
            })),
            {
              placeHolder: "Select an E2E test suite to view details or run",
            }
          );
          if (!selected) {return;}
          selectedSuite = testSuites.find((suite: E2eTestSuite) => suite.uuid === selected.uuid);
          if (!selectedSuite) {
            vscode.window.showWarningMessage("⚠️ Selected E2E test suite not found. Please try selecting a different suite.");
            return;
          }
        }

        const { config } = await configHandler.loadConfig();
        let localPortConfig = config?.debuggAiServerPort;
        if (!localPortConfig) {
          const localPort = await vscode.window.showInputBox({
            prompt: 'Provide the port number for the local server',
            value: '3000',
          });
          if (!localPort) {
            vscode.window.showWarningMessage("⚠️ No local port provided. A port number is required to run the server.");
            return;
          }
          localPortConfig = parseInt(localPort, 10);
        }
        console.log("Local port config - ", localPortConfig);
        vscode.window.showInformationMessage(`🏃 Running E2E test suite: ${selectedSuite.name}`);
        try {
          // Configure AiE2eAgent with E2E test suite run settings
          const agentOptions: AiE2eAgentOptions = {
            testObjectType: "test-suite",
            testRunType: "run",
            remote: true,
            localServerPort: localPortConfig,
            testParams: {
              existingSuite: selectedSuite
            }
          };
          
          // Create and run the AiE2eAgent
          const aiE2eAgent = new AiE2eAgent(client, ide, agentOptions);
          await aiE2eAgent.testHandler.run();
          vscode.window.showInformationMessage(`✅ E2E test suite completed: ${selectedSuite.name}`);
        } catch (error) {
          vscode.window.showErrorMessage(`❌ E2E test suite failed: ${error instanceof Error ? error.message : String(error)}`);
        }

      },

      // Commit Tester Commands
      "debugg-ai.startCommitTesting": async () => {
        captureCommandTelemetry("debugg-ai.startCommitTesting");

        if (!commitTester) {
          const client = await debuggAIServerClientPromise;
          commitTester = new CommitTester(client, ide, configHandler, extensionContext);
        }

        await commitTester.initialize();
      },

      "debugg-ai.stopCommitTesting": async () => {
        captureCommandTelemetry("debugg-ai.stopCommitTesting");

        if (commitTester) {
          commitTester.stopMonitoring();
          vscode.window.showInformationMessage("Commit testing stopped");
        } else {
          vscode.window.showWarningMessage("⚠️ Commit testing was not running. Start commit testing first using the 'Start Commit Testing' command.");
        }
      },

      "debugg-ai.getCommitTestingStatus": async () => {
        captureCommandTelemetry("debugg-ai.getCommitTestingStatus");

        if (commitTester) {
          const isMonitoring = commitTester.isMonitoringCommits();
          const outputDir = commitTester.getTestOutputDirectory();

          vscode.window.showInformationMessage(
            `Commit testing is ${isMonitoring ? 'active' : 'inactive'}. Test output directory: ${outputDir}`
          );
        } else {
          vscode.window.showInformationMessage("Commit testing is not initialized");
        }
      },

      "debugg-ai.setCommitTestOutputDirectory": async () => {
        captureCommandTelemetry("debugg-ai.setCommitTestOutputDirectory");

        const newDir = await vscode.window.showInputBox({
          prompt: 'Enter the test output directory path',
          value: commitTester?.getTestOutputDirectory() || 'tests/playwright'
        });

        if (newDir && commitTester) {
          commitTester.setTestOutputDirectory(newDir);
          vscode.window.showInformationMessage(`Test output directory set to: ${newDir}`);
        }
      },

      "debugg-ai.generateTestsForWorkingChanges": async () => {
        captureCommandTelemetry("debugg-ai.generateTestsForWorkingChanges");
        const client = await debuggAIServerClientPromise;
        const { config } = await configHandler.loadConfig();
        let localPortConfig = config?.debuggAiServerPort;

        if (!commitTester) {
          commitTester = new CommitTester(client, ide, configHandler, extensionContext);
        }

        vscode.window.setStatusBarMessage("Generating E2E tests for working changes...", 3000);

        const changes = await commitTester.generateTestsForWorkingChanges();

        const aiE2eAgent = new AiE2eAgent(client, ide, {
          testParams: {
            description: "Generate tests for working changes",
            changes: changes,
            commitHash: changes.branchInfo?.commitHash,
            branchName: changes.branchInfo?.branch,
          },
          title: "Generate tests for working changes",
          testObjectType: "commit-suite",
          testRunType: "generate",
          remote: true,
          localServerPort: localPortConfig ?? 3000,
        } as unknown as AiE2eAgentOptions);

        try {
          if (changes.workingChanges.changes.length === 0) {
            vscode.window.showWarningMessage("⚠️ No working changes found. Make some code changes first, then run this command to generate tests.");
            return;
          }
          
          vscode.window.setStatusBarMessage("🤖 Generating tests for your working changes...", 3000);
          // Actually run the handler to process the request
          await aiE2eAgent.testHandler.run();

          while (aiE2eAgent.testHandler.isTestRunning()) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (error) {
          console.error('[Commands.generateTestsForWorkingChanges] Error running tests:', error);
          vscode.window.showErrorMessage(
            `Error running tests: ${error instanceof Error ? error.message : String(error)}`
          );
        }

        try {
          // TODO: handle the final state and results if needed
          const testState = aiE2eAgent.testHandler.getTestState();
          const testObjectS = await aiE2eAgent.testHandler.getTestObject();
          if (testObjectS) {
            let testObject = testObjectS.object as unknown as E2eTestCommitSuite;
            console.log("Test object - ", testObject);
            const tests = testObject.tests;
            console.log("Tests - ", tests);

            const workspaceDirs = await ide.getWorkspaceDirs();
            console.log("Workspace dirs - ", workspaceDirs);

            if (tests && tests.length > 0) {
              for (const test of tests) {
                // We need to save the test script files locally
                const testScriptUrl = test.testScript;
                console.log("Test script url - ", testScriptUrl);

                try {
                  const testScriptContent = await fetch(testScriptUrl).then(res => res.text());
                  const testScriptName = test.testScript.split('/').pop() ?? `${testObject.uuid}`;
                  await aiE2eAgent.testHandler.saveTestFile(workspaceDirs, { name: testScriptName, content: testScriptContent });
                } catch (error) {
                  console.error('[Commands.generateTestsForWorkingChanges] Error downloading test script:', error);
                  vscode.window.showErrorMessage(
                    `Error downloading test script: ${error instanceof Error ? error.message : String(error)}`
                  );
                }
              }
            }
            if (testObject.runStatus === "completed") {
              vscode.window.showInformationMessage(`✅ Tests generated successfully! ${tests?.length || 0} test(s) created.`);
            } else {
              vscode.window.showErrorMessage(`❌ Test generation failed with status: ${testObject.runStatus}`);
            }
          }
        } catch (error) {
          console.error('[Commands.generateTestsForWorkingChanges] Error running test for working changes:', error);
          vscode.window.showErrorMessage(
            `Error running test for working changes: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    };
  };

const registerCopyBufferSpy = (
  context: vscode.ExtensionContext,
  core: Core,
) => {
  const typeDisposable = vscode.commands.registerCommand(
    "debugg-ai.copy",
    async (arg) => doCopy(typeDisposable),
  );

  async function doCopy(typeDisposable: any) {
    typeDisposable.dispose(); // must dispose to avoid endless loops

    await vscode.commands.executeCommand("debugg-ai.copy");

    const clipboardText = await vscode.env.clipboard.readText();

    if (clipboardText) {
      core.invoke("clipboardCache/add", {
        content: clipboardText,
      });
    }

    await context.workspaceState.update("debugg-ai.copyBuffer", {
      text: clipboardText,
      copiedAt: new Date().toISOString(),
    });

    // re-register to continue intercepting copy commands
    typeDisposable = vscode.commands.registerCommand(
      "debugg-ai.copy",
      async () => doCopy(typeDisposable),
    );
    context.subscriptions.push(typeDisposable);
  }

  context.subscriptions.push(typeDisposable);
};

async function installModelWithProgress(
  modelName: string,
  modelInstaller: ModelInstaller,
) {
  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Installing model '${modelName}'`,
      cancellable: true,
    },
    async (windowProgress, token) => {
      let currentProgress: number = 0;
      const progressWrapper = (
        details: string,
        worked?: number,
        total?: number,
      ) => {
        let increment = 0;
        if (worked && total) {
          const progressValue = Math.round((worked / total) * 100);
          increment = progressValue - currentProgress;
          currentProgress = progressValue;
        }
        windowProgress.report({ message: details, increment });
      };
      const abortController = new AbortController();
      token.onCancellationRequested(() => {
        console.log(`Pulling ${modelName} model was cancelled`);
        abortController.abort();
      });
      await modelInstaller.installModel(
        modelName,
        abortController.signal,
        progressWrapper,
      );
    },
  );
}

export function registerAllCommands(
  context: vscode.ExtensionContext,
  ide: VsCodeIde,
  extensionContext: vscode.ExtensionContext,
  sidebar: DebuggGuiWebviewViewProvider,
  configHandler: ConfigHandler,
  verticalDiffManager: VerticalDiffManager,
  debuggAIServerClientPromise: Promise<DebuggAIServerClient>,
  battery: Battery,
  quickEdit: QuickEdit,
  core: Core,
  editDecorationManager: EditDecorationManager,
  errorFileDecorationProvider: ErrorFileDecorationProvider,
) {
  registerCopyBufferSpy(context, core);

  // Initialize commit tester automatically
  initializeCommitTester(extensionContext, ide, configHandler, debuggAIServerClientPromise);

  for (const [command, callback] of Object.entries(
    getCommandsMap(
      ide,
      extensionContext,
      sidebar,
      configHandler,
      verticalDiffManager,
      debuggAIServerClientPromise,
      battery,
      quickEdit,
      core,
      editDecorationManager,
      errorFileDecorationProvider,
    ),
  )) {
    context.subscriptions.push(
      vscode.commands.registerCommand(command, callback),
    );
  }
}

/**
 * Initialize the commit tester automatically when the extension starts
 */
async function initializeCommitTester(
  context: vscode.ExtensionContext,
  ide: VsCodeIde,
  configHandler: ConfigHandler,
  debuggAIServerClientPromise: Promise<DebuggAIServerClient>
) {
  try {
    // Wait a bit for the extension to fully load
    setTimeout(async () => {
      const client = await debuggAIServerClientPromise;
      commitTester = new CommitTester(client, ide, configHandler, context);
      await commitTester.initialize();
    }, 2000);
  } catch (error) {
    console.error('[CommitTester] Failed to auto-initialize:', error);
  }
}
