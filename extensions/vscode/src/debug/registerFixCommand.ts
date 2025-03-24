// registerFixCommand.ts
import * as vscode from 'vscode';

/**
 * Registers a command that will replace a specific range of code with a suggestion.
 */
export function registerFixCommand(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    'myLoggerHighlighter.applyFix',
    async (documentUri: vscode.Uri, range: vscode.Range, newCode: string) => {
      // 1. Open the document
      const doc = await vscode.workspace.openTextDocument(documentUri);
      const editor = await vscode.window.showTextDocument(doc);

      // 2. Replace the text in the given range with `newCode`
      await editor.edit(editBuilder => {
        editBuilder.replace(range, newCode);
      });

      vscode.window.showInformationMessage('Applied the suggested fix successfully!');
    }
  );

  context.subscriptions.push(disposable);
}
