// highlight.ts
import * as vscode from 'vscode';
import { buildHoverMarkdown } from './hoverBuilder';

/**
 * highlightFileErrors
 * Applies decorations to indicate errors in a single file, including:
 * - A wavy underline + background
 * - The "errorCount" appended to the end of each line
 * - A hover tooltip showing the error message
 * 
 * @param editor        The TextEditor for the file being decorated
 * @param suggestions   The array of suggestions (lineNumber, message, filePath, errorCount)
 */
export function highlightErrors(
  editor: vscode.TextEditor,
  suggestions: Array<{
    lineNumber: number;
    message: string;
    filePath: string;
    errorCount: number;
  }>
) {
  // Create a single decoration type that defines the base styling
  const decorationType = vscode.window.createTextEditorDecorationType({
    border: "1px solid red",
    borderRadius: "2px",
    color: "white",
    backgroundColor: "rgba(255, 0, 0, 0.4)",
    textDecoration: "underline wavy red",
    overviewRulerColor: "red",
    overviewRulerLane: vscode.OverviewRulerLane.Right,
    // "before" and "dark" can be static here. We'll inject the dynamic text in each decoration below.
    // before: {
    //   contentText: "⚠ ",
    //   color: "yellow",
    //   margin: "0 2px 0 0"
    // },
    dark: {
      backgroundColor: "rgba(255, 0, 0, 0.2)" // dimmer background for dark themes
    }
  });

  // We'll accumulate all line-specific decorations in an array
  const decorations: vscode.DecorationOptions[] = [];

  // For each suggestion, create a DecorationOptions entry
  for (const suggestion of suggestions) {
    // Convert 1-based lineNumber to 0-based index
    const zeroBasedLine = suggestion.lineNumber - 1;

    // Validate line range
    if (zeroBasedLine < 0 || zeroBasedLine >= editor.document.lineCount) {
      continue; // skip if the line is out of bounds
    }

    const lineText = editor.document.lineAt(zeroBasedLine).text;
    const startPos = new vscode.Position(zeroBasedLine, 99);
    const endPos = new vscode.Position(zeroBasedLine, lineText.length);
    const range = new vscode.Range(startPos, endPos);

    // Use our hover builder to get a MarkdownString
    const hoverMessage = buildHoverMarkdown(suggestion.message);

    // Build a decoration for this line
    // `hoverMessage` can be a string or MarkdownString
    decorations.push({
      range,
      hoverMessage: hoverMessage,
      // Per-line override for the 'after' property so we can show the errorCount
      renderOptions: {
        after: {
          contentText: ` [${suggestion.errorCount} recent errors]`,
          color: "yellow",
          margin: "0 0 0 1em"
        }
      }
    });
  }

  // Finally, apply all decorations to the editor
  editor.setDecorations(decorationType, decorations);
}
