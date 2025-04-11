import * as vscode from "vscode";
import { IssuesService } from "../services/backend/issues";
import { Issue } from "../services/backend/types";

/**
 * A class-based notification provider.
 *
 * This class queries the backend for notifications (using project and company parameters)
 * and then displays them to the user. You can choose to display the notifications
 * either as a popup quick pick or as a status bar item.
 */
export class NotificationProvider {
  private displayMode: "popup" | "statusBar";
  private statusBarItem?: vscode.StatusBarItem;
  private disposables: vscode.Disposable[] = [];

  constructor() {
    // Get the display mode from configuration ("continueNotifications.displayMode")
    this.displayMode = vscode.workspace
      .getConfiguration("continueNotifications")
      .get("displayMode", "popup");
  }

  /**
   * Queries the backend for notifications given a project and company.
   *
   * @param projectKey The project key.
   * @returns A promise that resolves to an array of Issue objects.
   */
  public async checkNotifications(projectKey: string): Promise<Issue[]> {
    try {
      const response = await IssuesService.getAlertLevelIssues(projectKey);
      return response;
    } catch (error) {
      vscode.window.showErrorMessage("Error fetching notifications: " + error);
      return [];
    }
  }

  /**
   * Checks for notifications and then displays them to the user based on the configured mode.
   * In "popup" mode, a quick pick is shown.
   * In "statusBar" mode, a status bar item is created and clicking it shows a quick pick.
   *
   * @param projectKey The project key.
   */
  public async displayNotifications(projectKey: string): Promise<void> {
    const notifications = await this.checkNotifications(projectKey);
    if (!notifications || notifications.length === 0) {
      return;
    }
    if (this.displayMode === "popup") {
      await this.showQuickPick(notifications);
    } else if (this.displayMode === "statusBar") {
      this.showStatusBar(notifications);
    }
  }

  /**
   * Shows the notifications in a quick pick popup.
   *
   * @param notifications An array of Notification objects.
   */
  private async showQuickPick(notifications: Issue[]): Promise<void> {
    const quickPickItems = notifications.map((notif) => ({
      label: notif.title || "",
      description: notif.message || "",
      notification: notif,
    }));

    const selectedItem = await vscode.window.showQuickPick(quickPickItems, {
      placeHolder: "Select a notification to open the associated file",
    });

    if (selectedItem) {
      this.openFile(selectedItem.notification);
    }
  }

  /**
   * Creates a status bar item to display a notification count.
   * Clicking the status bar item will open a quick pick with all notifications.
   *
   * @param notifications An array of Notification objects.
   */
  private showStatusBar(notifications: Issue[]): void {
    // Dispose any previous status bar item
    if (this.statusBarItem) {
      this.statusBarItem.dispose();
    }

    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.statusBarItem.text = `$(alert) ${notifications.length} issue notifications`;
    this.statusBarItem.tooltip = "Click to view issue notifications";
    this.statusBarItem.command = "continue.openNotifications";
    this.statusBarItem.show();

    // Register a command for when the status bar item is clicked.
    const disposable = vscode.commands.registerCommand("continue.openNotifications", async () => {
      await this.showQuickPick(notifications);
      if (this.statusBarItem) {
        this.statusBarItem.hide();
        disposable.dispose();
      }
    });

    this.disposables.push(disposable);
  }

  /**
   * Opens the file specified in the notification.
   *
   * @param notification The Notification object.
   */
  private openFile(notification: Issue): void {
    const fileUri = vscode.Uri.file(notification.filePath);
    vscode.commands.executeCommand("vscode.open", fileUri);
  }

  /**
   * Clean up any resources (e.g. status bar items or command disposables).
   */
  public dispose(): void {
    if (this.statusBarItem) {
      this.statusBarItem.dispose();
    }
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
