// hoverBuilder.ts
import * as vscode from 'vscode';

/**
 * Builds a MarkdownString from a given piece of pre-formatted Markdown text.
 * 
 * @param message A string containing valid Markdown.
 * @returns A vscode.MarkdownString that VS Code can use to display hover text.
 */
export function buildHoverMarkdown(message: string): vscode.MarkdownString {
  // We trust the content if we want code blocks and links to work fully (including external links).
  // If you prefer more security, you can leave this as false, but then external links won't work.
  const fixedMessage = message.replace(/\n/g, '  \n');
  const markdown = new vscode.MarkdownString(fixedMessage);
  markdown.isTrusted = true;

  return markdown;
}
