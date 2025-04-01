// myInlayHintsProvider.ts
import * as vscode from 'vscode';
import { getIssuesInFile } from '../../services/backend/files';
import { Issue, IssueSuggestion, LogOverview } from '../../services/backend/types';
import { clearDecorations, highlightInlayLine } from '../highlightLine';
import { getFixMarkdown, getIssueMarkdown, getMarkdownStructure } from './structure';


/**
 * Provides inlay hints for lines that we want to annotate
 * with "Overview", "Suggested Fix", and "Test Coverage" buttons.
 */
export class OptionsInlayHintsProvider implements vscode.InlayHintsProvider {
    onDidChangeInlayHints?: vscode.Event<void> | undefined;
    // Cache mapping document URI to {timestamp, hints}
    private cache = new Map<string, { timestamp: number; hints: vscode.InlayHint[] }>();
    // Time-to-live for cache in milliseconds (e.g., 1000ms = 1 seconds)
    private cacheTTL = 5000;

    // Called by VS Code whenever inlay hints are needed for a document range
    public async provideInlayHints(
        document: vscode.TextDocument,
        range: vscode.Range,
        token: vscode.CancellationToken
    ): Promise<vscode.InlayHint[]> {
        const cacheKey = document.uri.toString();
        const now = Date.now();

        // Check if we have recent cached hints
        const cached = this.cache.get(cacheKey);
        if (cached && now - cached.timestamp < this.cacheTTL) {
            return cached.hints;
        }

        // Clear existing decorations before fetching new hints
        clearDecorations();

        // Fetch new hints
        const hints = await this.fetchHintsForDocument(document);

        // If no hints were found, ensure decorations are cleared
        if (hints.length === 0) {
            clearDecorations();
        }

        // Update the cache
        this.cache.set(cacheKey, { timestamp: now, hints });
        return hints;
    }

    public async fetchHintsForDocument(
        document: vscode.TextDocument,
    ): Promise<vscode.InlayHint[]> {
        const inlayHints: vscode.InlayHint[] = [];
        const editor = vscode.window.activeTextEditor;

        const issues = await this.getIssuesInDocument(document);
        const lineNumbersUser: number[] = [];
        for (const issue of issues) {
            const { suggestions, overview, lineNumber, title, message } = issue;
            const suggestion = suggestions?.[0];
            const vsLineNumber = lineNumber ? lineNumber - 1 : 0;
            const level = overview?.level;

            // Skip if out of range
            if (!vsLineNumber || vsLineNumber >= document.lineCount) {
                continue;
            }
            if (lineNumbersUser.includes(vsLineNumber)) {
                continue;
            }
            // Highlight the line containing the inlay hints
            if (editor && document.uri === editor.document.uri) {
                highlightInlayLine(editor, lineNumber || 0, level || 'INFO');
            }

            // We'll place the hints at the start of the line above
            const lineText = document.lineAt(vsLineNumber).text;
            const endColumn = lineText.length;
            const hintPosition = new vscode.Position(vsLineNumber, endColumn);

            const fmtdOverview = this.getIssueMarkdown(issue);

            console.log(issue); 
            // Create inlay hints for 3 separate clickable items
            inlayHints.push(this.createHint("Resolve", fmtdOverview, "continue.markResolved", document.uri, vsLineNumber, hintPosition, issue));
            if (issue.solution) {
                const solutionMarkdown = getFixMarkdown(title || '-', issue.solution);
                inlayHints.push(this.createHint("Fix", solutionMarkdown, "continue.applySuggestedFix", document.uri, vsLineNumber, hintPosition, issue));
            }
            if (suggestion) {
                const suggestionMarkdown = this.getSuggestionMarkdown(suggestion);
                inlayHints.push(this.createHint("Suggested Fix", suggestionMarkdown, "continue.applySuggestedFix", document.uri, vsLineNumber, hintPosition, issue));
                inlayHints.push(this.createHint("Test Coverage", suggestion.message, "continue.showTestCoverage", document.uri, vsLineNumber, hintPosition, issue));
            } else {
                // inlayHints.push(this.createHint("Error", title, "continue.showOverview", document.uri, vsLineNumber, hintPosition, level));
            }


            const earlierLineText = document.lineAt(vsLineNumber - 1).text;
            const earlierEndColumn = earlierLineText.length;
            const earlierHintPosition = new vscode.Position(vsLineNumber - 1, earlierEndColumn);
            lineNumbersUser.push(vsLineNumber);
            // inlayHints.push(this.createHint("Runtime: 47ms", '47 runs and 0 failures', "continue.showTestCoverage", document.uri, vsLineNumber - 1, earlierHintPosition, level));

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
     * @param issue       The issue object
     */
    private createHint(
        label: string,
        labelTooltip: string,
        commandId: string,
        uri: vscode.Uri,
        line: number,
        position: vscode.Position,
        issue: Issue | null = null
    ): vscode.InlayHint {
        const hint = new vscode.InlayHint(position, label, vscode.InlayHintKind.Type);
        const tip = new vscode.MarkdownString(labelTooltip);
        tip.isTrusted = true;

        const colorMap = {
            DEBUG: '$(debug)',   // maybe $(debug-alt) or another icon
            INFO: '$(info)',
            WARNING: '$(warning)',
            ERROR: '$(error)',
            FATAL: '$(error)',
            METRIC: '$(info)',
        };

        // Build a label part that includes the text, tooltip, and command
        const labelPart: vscode.InlayHintLabelPart = {
            value: `${label}`,
            tooltip: tip,
            command: {
                command: commandId,
                title: label,
                arguments: [uri, line, issue]
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
    private async getIssuesInDocument(document: vscode.TextDocument): Promise<Issue[]> {
        // Implement this to return actual line numbers where you want the buttons to appear
        // This could come from your diagnostic system, test coverage data, etc.
        const issues = await getIssuesInFile({
            filePath: document.uri.fsPath
        });
        return issues; 
    }

    // Returns Markdown as a string
    private getErrorMarkdown(title: string, message: string, overview: LogOverview): string {
        return getMarkdownStructure(title, message, overview);
    }
    private getIssueMarkdown(issue: Issue): string {
        return getIssueMarkdown(issue);
    }

    private getSuggestionMarkdown(suggestion: IssueSuggestion): string {
        try {
            const jsonSuggestion = JSON.parse(suggestion.message);
            const keys = Object.keys(jsonSuggestion);
            const values = Object.values(jsonSuggestion);
            const fmtdFileUpdates = values?.length > 0 ? `\`\`\`\n${values[0]}\`\`\`` : suggestion.message;
            return fmtdFileUpdates;
        } catch (e) {
            return suggestion.message;
        }
    }
}
