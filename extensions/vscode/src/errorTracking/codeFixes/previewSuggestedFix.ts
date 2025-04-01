import * as vscode from 'vscode';
import { FileChange, Issue, SnippetUpdate } from '../../services/backend/types';

/**
 * Generates a modified version of the file content based on snippet updates.
 * The snippet updates are assumed to be 1-indexed; they are converted to 0-indexed.
 * Updates are applied from bottom to top to avoid shifting line numbers.
 *
 * @param originalText The original file text.
 * @param snippets Array of snippet updates.
 * @returns The modified text.
 */
function applySnippetUpdates(originalText: string, snippets: SnippetUpdate[]): string {
  const lines = originalText.split(/\r?\n/);
  // Sort snippets in descending order by startLine
  const sortedSnippets = snippets.sort((a, b) => b.startLine - a.startLine);
  for (const snippet of sortedSnippets) {
    const startLineIndex = snippet.startLine - 1;
    const endLineIndex = snippet.endLine - 1;
    // Replace the lines from start to end (inclusive) with the new snippet lines.
    const snippetLines = snippet.newContent.split(/\r?\n/);
    lines.splice(startLineIndex, endLineIndex - startLineIndex + 1, ...snippetLines);
  }
  return lines.join('\n');
}

/**
 * Previews a suggested fix as an inline diff.
 *
 * This function uses the provided Issue object (which must include a solution)
 * to generate modified file content. It then opens VS Code’s diff view
 * so the user can review the proposed changes before confirming.
 *
 * @param issue - The issue containing the solution and file changes.
 * @returns A promise that resolves when the diff view is opened.
 */
export async function previewSuggestedFix(uri: vscode.Uri, issue: Issue): Promise<void> {
  console.log('Starting to preview suggested fix');
  console.log(`Issue: ${issue}`);
  if (!issue.solution) {
    vscode.window.showWarningMessage("No solution available for this issue.");
    return;
  }

  // For simplicity, here we assume the solution contains one file change.
  // In a multi-file scenario you might want to handle each file separately.
  const fileChange: FileChange = issue.solution.changes[0];
  const filePath = fileChange.filePath;

    try {
    // Open the file specified by the file change.
    console.log(`Opening file: ${uri.fsPath}`);
    const originalDocument = await vscode.workspace.openTextDocument(uri.fsPath);
    const originalText = originalDocument.getText();

    // Compute the modified text by applying all snippet updates.
    const modifiedText = applySnippetUpdates(originalText, fileChange.snippetsToUpdate);

    // Create an in-memory document for the modified content.
    // VS Code supports opening a document with a given content.
    const modifiedDocument = await vscode.workspace.openTextDocument({
      content: modifiedText,
      language: originalDocument.languageId,
    });

    // Prepare a title for the diff view.
    const diffTitle = `Proposed Changes: ${vscode.Uri.file(filePath).fsPath}`;

    // Open the diff view.
    // Note: VS Code will show a side-by-side diff. To encourage an inline diff view,
    // you can set the following option in the user's settings:
    //   "diffEditor.renderSideBySide": false
    await vscode.commands.executeCommand(
      'vscode.diff',
      originalDocument.uri,
      modifiedDocument.uri,
      diffTitle,
      {
        // Optionally pass options here
        // For example, you might set 'preserveFocus': true if desired.
        preview: true,
      }
    );

    // At this point the user can review the diff.
    // You can add additional UI (e.g. via CodeLens or a custom webview)
    // to let them confirm or reject the changes.
  } catch (error) {
    vscode.window.showErrorMessage(`Error previewing suggested fix: ${error}`);
  }
}
