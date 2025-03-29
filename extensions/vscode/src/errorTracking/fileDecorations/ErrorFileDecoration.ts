import * as vscode from 'vscode';
import { gitProcessTool } from '../../util/gitUtils';

export class ErrorFileDecorationProvider implements vscode.FileDecorationProvider {
  // Event emitter for when decorations need to be updated.
  private _onDidChangeFileDecorations = new vscode.EventEmitter<vscode.Uri | vscode.Uri[]>();
  onDidChangeFileDecorations: vscode.Event<vscode.Uri | vscode.Uri[]> = this._onDidChangeFileDecorations.event;

  // A simple set to keep track of files with errors (store file URI strings)
  private errorFiles: Set<string> = new Set();
  private previousUris: vscode.Uri[] = [];

  /**
   * Update the list of files that have errors.
   * Call this when your API returns new error data.
   * @param filesWithErrors An array of file URI strings.
   */
  public async updateErrorFiles(filesWithErrors: string[]): Promise<void> {
    const gitProcess = await gitProcessTool();
    const urls = new Set(filesWithErrors.map(f => {
        if (f.startsWith(gitProcess)) {
            return f;
        }
        return `${gitProcess}${f.startsWith('/') ? '' : '/'}${f}`;
    }));
    
    // Set new decorations
    const uris = Array.from(urls).map(uri => vscode.Uri.parse(uri));
    this.errorFiles = new Set(uris.map(uri => uri.toString()));
    this.previousUris = uris;

    // Clear old decorations
    this._onDidChangeFileDecorations.fire(this.previousUris);
    // Set new decorations
    this._onDidChangeFileDecorations.fire(uris);
  }

  /**
   * Called by VS Code for each file in the Explorer.
   * If the file is in our errorFiles list, we return a decoration.
   */
  provideFileDecoration(
    uri: vscode.Uri,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.FileDecoration> {
    if (this.errorFiles.has(uri.toString())) {
      // You can customize:
      // - badge: short text (e.g. "!" or an error count)
      // - tooltip: a message when hovering
      // - color: a theme color (here we use the built-in error icon foreground color)
      return {
        badge: '!', 
        tooltip: 'DebuggAI: This file contains recent errors.',
        color: new vscode.ThemeColor('problemsErrorIcon.foreground'),
      };
    }
    // console.log('No error file decoration for: ', uri.toString());
    return;
  }
}
