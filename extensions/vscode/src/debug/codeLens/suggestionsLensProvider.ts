import * as vscode from 'vscode';

export function createSampleSuggestions(document: vscode.TextDocument) {
    // Create some sample suggestions
    const suggestions = [
        {
            range: new vscode.Range(
                new vscode.Position(0, 0),  // start of first line
                new vscode.Position(0, 20)  // character 20 of first line
            ),
            newCode: '// This is a sample fix'
        },
        {
            range: new vscode.Range(
                new vscode.Position(2, 0),  // start of third line
                new vscode.Position(2, 30)  // character 30 of third line
            ),
            newCode: 'const updatedCode = "new implementation";'
        }
    ];

    // Add suggestions to the provider
    const provider = SuggestionCodeLensProvider.getInstance();
    provider.setSuggestionsForFile(document.uri.fsPath, suggestions);
}

export class SuggestionCodeLensProvider implements vscode.CodeLensProvider {
    private static instance: SuggestionCodeLensProvider;
    private suggestionsCache: Record<string, Array<{
        range: vscode.Range;
        newCode: string;
    }>> = {};

    private constructor() { }

    public static getInstance(): SuggestionCodeLensProvider {
        if (!SuggestionCodeLensProvider.instance) {
            SuggestionCodeLensProvider.instance = new SuggestionCodeLensProvider();
        }
        return SuggestionCodeLensProvider.instance;
    }

    public setSuggestionsForFile(filePath: string, suggestions: Array<{ range: vscode.Range; newCode: string }>) {
        this.suggestionsCache[filePath] = suggestions;
    }

    public provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
        const fileSuggestions = this.suggestionsCache[document.uri.fsPath] || [];
        return fileSuggestions.map(suggestion => {
            return new vscode.CodeLens(suggestion.range, {
                title: "Apply fix",
                command: "continue.applyFix",
                arguments: [document.uri, suggestion.range, suggestion.newCode]
            });
        });
    }
}
