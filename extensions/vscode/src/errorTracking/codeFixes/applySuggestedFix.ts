import * as vscode from 'vscode';
import { Issue } from '../../services/backend/types';

/**
 * Determines the range to replace.
 * If an explicit range is provided, that takes priority.
 * Otherwise, if there's a user selection, use that.
 * If no selection, default to the entire line where the cursor is.
 *
 * @param editor The active text editor.
 * @param providedRange Optional range provided by the extension.
 * @returns The range to replace.
 */
function determineReplaceRange(
  editor: vscode.TextEditor,
  providedRange?: vscode.Range
): vscode.Range {
  if (providedRange) {
    return providedRange;
  }

  if (!editor.selection.isEmpty) {
    return editor.selection;
  }

  // Fallback: replace the entire line where the cursor is.
  const lineNumber = editor.selection.active.line;
  return editor.document.lineAt(lineNumber).range;
}

/**
 * Applies a suggested edit by replacing a determined range in the active editor with the provided new code.
 *
 * @param newCode - The code that should replace the target range.
 * @param providedRange - Optional. A pre-determined range to replace.
 * @returns A promise that resolves to true if the edit was applied successfully.
 */
export async function applySuggestedEdit(newCode: string, providedRange?: vscode.Range): Promise<boolean> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage("No active editor to apply the edit.");
    return false;
  }

  // Determine the range to replace.
  const replaceRange = determineReplaceRange(editor, providedRange);

  // Optionally, update context before applying the edit.
  await vscode.commands.executeCommand("setContext", "continue.applyEditInProgress", true);

  try {
    const success = await editor.edit(editBuilder => {
      editBuilder.replace(replaceRange, newCode);
    });
    if (success) {
      vscode.window.showInformationMessage("Suggested edit applied successfully.");
    } else {
      vscode.window.showErrorMessage("Failed to apply suggested edit.");
    }
    return success;
  } catch (e) {
    vscode.window.showErrorMessage(`Error applying edit: ${e}`);
    return false;
  } finally {
    await vscode.commands.executeCommand("setContext", "continue.applyEditInProgress", false);
  }
}


/**
 * Applies a suggested fix for an issue by retrieving its solution and then updating each file.
 *
 * @param issue - The issue object (which includes a solution with file changes)
 * @returns A promise that resolves to true if all changes were applied successfully, false otherwise.
 */
export async function applySuggestedFix(uri: vscode.Uri, issue: Issue): Promise<boolean> {
  // Check if the issue has an associated solution.
  console.log('Starting to apply suggested fix');
  console.log(`Issue: ${issue}`);
  if (!issue.solution) {
    vscode.window.showWarningMessage("No solution available for this issue.");
    return false;
  }

  let allSuccess = true;

  // Iterate over each file change defined in the issue solution.
  for (const fileChange of issue.solution.changes) {
    console.log(`Processing fileChange: `, fileChange);

    try {
      // Open the file specified by the file change.
      console.log(`Opening file: ${uri.fsPath}`);
      const document = await vscode.workspace.openTextDocument(uri.fsPath);

      await vscode.window.showTextDocument(document, { preview: false });

      console.log('File opened');
      
      // Sort snippet updates in descending order by startLine (so that later edits don't shift earlier ones).
      const sortedSnippets = fileChange.snippetsToUpdate.sort((a, b) => b.startLine - a.startLine);

      console.log(`Processing ${sortedSnippets.length} snippets`);
      console.log(`Snippet updates: `, sortedSnippets);
      for (const snippetUpdate of sortedSnippets) {
        // Convert 1-indexed line numbers (backend) to 0-indexed positions (VS Code)
        const startLineIndex = snippetUpdate.startLine - 1;
        const endLineIndex = snippetUpdate.endLine - 1;

        // Create a range covering from the start of startLine to the end of endLine.
        const startPos = new vscode.Position(startLineIndex, 0);
        const endPos = new vscode.Position(
          endLineIndex,
          document.lineAt(endLineIndex).text.length
        );
        const range = new vscode.Range(startPos, endPos);

        // Apply the suggested edit (replace the text in the range with the provided snippet).
        const success = await applySuggestedEdit(snippetUpdate.newContent, range);
        if (!success) {
          allSuccess = false;
        }
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to apply changes in file ${fileChange.filePath}: ${error}`
      );
      allSuccess = false;
    }
  }

  if (allSuccess) {
    vscode.window.showInformationMessage(
      `Issue solution ${issue.solution.uuid} applied successfully.`
    );
  } else {
    vscode.window.showWarningMessage(
      `Some changes for issue solution ${issue.solution.uuid} could not be applied.`
    );
  }

  return allSuccess;
}
