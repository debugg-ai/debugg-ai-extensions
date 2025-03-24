// myInlayHintsProvider.ts
import * as vscode from 'vscode';
import { FileResult, getFileResults, Level, LogOverview } from '../../services/debugg-ai/inlays';
import { getMarkdownStructure } from './structure';


function addInlineDecoration(editor: vscode.TextEditor | undefined, line: number, message: string) {
  if (!editor) {
    return;
  }

  const decorationType = vscode.window.createTextEditorDecorationType({
    isWholeLine: false,
    after: {
      contentText: ` ← ${message}`, // This text shows inline after the existing line
      margin: '0 0 0 1rem',
      color: 'rgba(153,153,153,0.7)',
      fontStyle: 'italic',
    },
  });

  const decorationOptions: vscode.DecorationOptions[] = [{
    range: editor.document.lineAt(line).range,
    hoverMessage: message,
  }];

  editor.setDecorations(decorationType, decorationOptions);
}


/**
 * Provides inlay hints for lines that we want to annotate
 * with "Overview", "Suggested Fix", and "Test Coverage" buttons.
 */
export class OptionsInlayHintsProvider implements vscode.InlayHintsProvider {
    onDidChangeInlayHints?: vscode.Event<void> | undefined;

    public async provideInlayHints(
        document: vscode.TextDocument,
        range: vscode.Range,
        token: vscode.CancellationToken
    ): Promise<vscode.InlayHint[]> {
        const inlayHints: vscode.InlayHint[] = [];

        // Example: We want to show hints on lines 10 and 20. 
        // Real logic might come from an API or a set of error lines.
        const fileResults = await this.getLinesWithSuggestions(document); // 0-based line indices

        for (const result of fileResults) {
            const { suggestions, overview } = result;
            const suggestion = suggestions?.[0];
            const vsLineNumber = suggestion?.lineNumber ? suggestion.lineNumber - 1 : null;
            const level = overview.level;

            // Skip if out of range
            if (!suggestion || !vsLineNumber || vsLineNumber >= document.lineCount) {
                continue;
            }

            // We'll place the hints at the start of the line above
            const lineText = document.lineAt(vsLineNumber).text;
            const endColumn = lineText.length;
            const hintPosition = new vscode.Position(vsLineNumber, endColumn);

            const fmtdOverview = this.getErrorMarkdown(overview);

            // Create inlay hints for 3 separate clickable items
            inlayHints.push(this.createHint("Apply Fix", "Apply the suggested fix to the code", "continue.applySuggestedFix", document.uri, vsLineNumber, hintPosition, level));
            inlayHints.push(this.createHint("Overview", fmtdOverview, "continue.showOverview", document.uri, vsLineNumber, hintPosition, level));
            inlayHints.push(this.createHint("Suggested Fix", suggestion.message, "continue.applySuggestedFix", document.uri, vsLineNumber, hintPosition, level));
            inlayHints.push(this.createHint("Test Coverage", suggestion.message, "continue.showTestCoverage", document.uri, vsLineNumber, hintPosition, level));
            
            const earlierLineText = document.lineAt(vsLineNumber - 1).text;
            const earlierEndColumn = earlierLineText.length;
            const earlierHintPosition = new vscode.Position(vsLineNumber - 1, earlierEndColumn);
            inlayHints.push(this.createHint("Runtime: 47ms", '47 runs and 0 failures', "continue.showTestCoverage", document.uri, vsLineNumber - 1, earlierHintPosition, level));

        }
        // vscode.commands.executeCommand('continue.showSnippetPreview', 'console.log("Hello from snippet!")');
        // addInlineDecoration(vscode.window.activeTextEditor, 10, 'Hello from snippet!');

        return inlayHints;
    }

    /**
     * Helper to create a single inlay hint with a bound command.
     * 
     * @param label       The text shown in the editor
     * @param labelTooltip The tooltip text shown when hovering over the hint
     * @param commandId   The command ID from your getCommandsMap
     * @param uri         The file's Uri
     * @param line        The line number (0-based)
     * @param position    Where to place the hint
     */
    private createHint(
        label: string,
        labelTooltip: string,
        commandId: string,
        uri: vscode.Uri,
        line: number,
        position: vscode.Position,
        level: Level | null = 'info' // Add level parameter with default
    ): vscode.InlayHint {
        const hint = new vscode.InlayHint(position, label, vscode.InlayHintKind.Type);
        const tip = new vscode.MarkdownString(labelTooltip);
        tip.isTrusted = true;

        const colorMap = {
            debug: '$(debug)',   // maybe $(debug-alt) or another icon
            info: '$(info)',
            warning: '$(warning)',
            error: '$(error)',
          };
          

        // Build a label part that includes the text, tooltip, and command
        const labelPart: vscode.InlayHintLabelPart = {
            value: `${label}`,
            tooltip: tip,
            command: {
                command: commandId,
                title: label,
                arguments: [uri, line]
            }
        };

        // Assign the label as an array with that part
        hint.label = [labelPart];
        hint.paddingLeft = true;

        return hint;
    }

    /**
     * Returns an array of line numbers (0-based) where suggestions/hints should appear.
     * 
     * This method should be implemented to determine which lines in the document should
     * show the inlay hints. The line numbers could be derived from:
     * - Lines with diagnostic errors/warnings
     * - Lines with test coverage data
     * - Lines with available code fixes or refactoring suggestions
     * 
     * @param document The text document to analyze
     * @returns Array of line numbers where hints should be shown
     */
    private async getLinesWithSuggestions(document: vscode.TextDocument): Promise<FileResult[]> {
        // Implement this to return actual line numbers where you want the buttons to appear
        // This could come from your diagnostic system, test coverage data, etc.
        const fileResults = await getFileResults({
            filePath: document.uri.fsPath
        });
        console.log('File results:', fileResults);
        return fileResults; // Replace with actual implementation
    }

    // Returns Markdown as a string
    private getErrorMarkdown(overview: LogOverview): string {
        return getMarkdownStructure(overview);
    }
      
    
}
