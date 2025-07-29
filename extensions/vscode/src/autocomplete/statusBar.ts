import * as vscode from "vscode";

import {
  CONTINUE_WORKSPACE_KEY,
  getContinueWorkspaceConfig,
} from "../util/workspaceConfig";

export enum StatusBarStatus {
  Inactive,
  Active,
  Running,
  Error,
}

export const quickPickStatusText = (status: StatusBarStatus | undefined) => {
  switch (status) {
    case undefined:
    case StatusBarStatus.Inactive:
      return "$(circle-slash) E2E Testing Inactive";
    case StatusBarStatus.Active:
      return "$(check) E2E Testing Active";
    case StatusBarStatus.Running:
      return "$(play) E2E Test Running";
    case StatusBarStatus.Error:
      return "$(alert) E2E Testing Error";
  }
};

export const getStatusBarStatusFromQuickPickItemLabel = (
  label: string,
): StatusBarStatus | undefined => {
  switch (label) {
    case "$(circle-slash) E2E Testing Inactive":
      return StatusBarStatus.Inactive;
    case "$(check) E2E Testing Active":
      return StatusBarStatus.Active;
    case "$(play) E2E Test Running":
      return StatusBarStatus.Running;
    case "$(alert) E2E Testing Error":
      return StatusBarStatus.Error;
    default:
      return undefined;
  }
};

const statusBarItemText = (
  status: StatusBarStatus | undefined,
  loading?: boolean,
  error?: boolean,
) => {
  if (error) {
    return "$(alert) DebuggAI (ERROR)";
  }

  switch (status) {
    case undefined:
      if (loading) {
        return "$(loading~spin) DebuggAI";
      }
    case StatusBarStatus.Inactive:
      return "$(circle-slash) DebuggAI";
    case StatusBarStatus.Active:
      return "$(check) DebuggAI";
    case StatusBarStatus.Running:
      return "$(play) DebuggAI";
    case StatusBarStatus.Error:
      return "$(alert) DebuggAI";
  }
};

const statusBarItemTooltip = (status: StatusBarStatus | undefined) => {
  switch (status) {
    case undefined:
    case StatusBarStatus.Inactive:
      return "Click to access E2E testing tools and options";
    case StatusBarStatus.Active:
      return "E2E testing tools are active - Click for options";
    case StatusBarStatus.Running:
      return "E2E test is currently running - Click for details";
    case StatusBarStatus.Error:
      return "E2E testing error occurred - Click for details";
  }
};

let statusBarStatus: StatusBarStatus | undefined = undefined;
let statusBarItem: vscode.StatusBarItem | undefined = undefined;
let statusBarFalseTimeout: NodeJS.Timeout | undefined = undefined;
let statusBarError: boolean = false;

export function stopStatusBarLoading() {
  statusBarFalseTimeout = setTimeout(() => {
    setupStatusBar(StatusBarStatus.Active, false);
  }, 100);
}

/**
 * TODO: We should clean up how status bar is handled.
 * Ideally, there should be a single 'status' value without
 * 'loading' and 'error' booleans.
 */
export function setupStatusBar(
  status: StatusBarStatus | undefined,
  loading?: boolean,
  error?: boolean,
) {
  if (loading !== false) {
    clearTimeout(statusBarFalseTimeout);
    statusBarFalseTimeout = undefined;
  }

  // If statusBarItem hasn't been defined yet, create it
  if (!statusBarItem) {
    statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
    );
  }

  if (error !== undefined) {
    statusBarError = error;

    if (status === undefined) {
      status = statusBarStatus;
    }

    if (loading === undefined) {
      loading = loading;
    }
  }

  statusBarItem.text = statusBarItemText(status, loading, statusBarError);
  statusBarItem.tooltip = statusBarItemTooltip(status ?? statusBarStatus);
  statusBarItem.command = "debugg-ai.openE2eTestingMenu";

  statusBarItem.show();
  if (status !== undefined) {
    statusBarStatus = status;
  }

  vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration(CONTINUE_WORKSPACE_KEY)) {
      const enabled = getContinueWorkspaceConfig().get<boolean>(
        "enableE2eTesting",
      );
      if (enabled && statusBarStatus === StatusBarStatus.Running) {
        return;
      }
      setupStatusBar(
        enabled ? StatusBarStatus.Active : StatusBarStatus.Inactive,
      );
    }
  });
}

export function getStatusBarStatus(): StatusBarStatus | undefined {
  return statusBarStatus;
}

export function monitorE2eTestingStatus(): vscode.Disposable {
  // Monitor E2E testing status changes instead of battery
  return vscode.Disposable.from(
    vscode.commands.registerCommand('debugg-ai.updateE2eStatus', (status: StatusBarStatus) => {
      setupStatusBar(status);
    })
  );
}

export function getE2eTestingStatusBarDescription(
  status: StatusBarStatus | undefined,
  testCount?: number,
): string | undefined {
  switch (status) {
    case StatusBarStatus.Active:
      return testCount ? `${testCount} E2E tests available` : "E2E testing ready";
    case StatusBarStatus.Running:
      return "E2E test in progress...";
    case StatusBarStatus.Error:
      return "E2E testing error - check logs";
    case StatusBarStatus.Inactive:
    default:
      return "E2E testing inactive";
  }
}

export function getE2eTestingStatusBarTitle(
  status: StatusBarStatus | undefined,
  testName?: string,
): string {
  if (!testName) {
    return "E2E Testing";
  }

  switch (status) {
    case StatusBarStatus.Running:
      return `$(play) ${testName}`;
    case StatusBarStatus.Error:
      return `$(alert) ${testName}`;
    default:
      return `$(check) ${testName}`;
  }
}
