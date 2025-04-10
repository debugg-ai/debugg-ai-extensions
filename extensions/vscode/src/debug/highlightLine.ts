// highlight.ts
import * as vscode from 'vscode';
import { Level } from '../services/backend/types';

// Keep track of active decorations
let activeDecorations: vscode.TextEditorDecorationType[] = [];

/**
 * Highlights a single line with a subtle background color to indicate it has inlay hints
 */
export function highlightInlayLine(
  editor: vscode.TextEditor,
  lineNumber: number,
  level: Level
) {
  // Clear previous decorations
  clearDecorations();

  const decorationType = vscode.window.createTextEditorDecorationType({
    textDecoration: "underline wavy red",
  });
  // const decorationType = getDecorationForLevel(level);

  // Add to active decorations
  activeDecorations.push(decorationType);

  // Convert to 0-based line number
  const zeroBasedLine = lineNumber - 1;

  // Validate line range
  if (zeroBasedLine < 0 || zeroBasedLine >= editor.document.lineCount) {
    return;
  }
  const line = editor.document.lineAt(zeroBasedLine);
  const firstNonWhitespaceCharacterIndex = line.firstNonWhitespaceCharacterIndex;
  const lastCharacterIndex = line.text.length;
  
  // Create a range that starts at the first non-whitespace character and ends at the last character
  const range = new vscode.Range(
      new vscode.Position(zeroBasedLine, firstNonWhitespaceCharacterIndex),
      new vscode.Position(zeroBasedLine, lastCharacterIndex)
  );
  // const range = editor.document.lineAt(zeroBasedLine).range;
  editor.setDecorations(decorationType, [{ range }]);
}

/**
 * Clears all active decorations
 */
export function clearDecorations() {
  activeDecorations.forEach(decoration => decoration.dispose());
  activeDecorations = [];
}

function getDecorationForLevel(level: Level): vscode.TextEditorDecorationType {
  const colors = {
    DEBUG: '#2196F3',
    INFO: '#4CAF50', 
    WARNING: '#FFC107',
    ERROR: '#F44336',
    FATAL: '#D32F2F',
    METRIC: '#9E9E9E'
  };
  const underLineColors = {
    DEBUG: 'white',
    INFO: 'white',
    WARNING: 'yellow',
    ERROR: 'red',
    FATAL: 'red',
    METRIC: 'gray'
  };

  return vscode.window.createTextEditorDecorationType({
    backgroundColor: `${colors[level]}33`, // 33 is hex for 20% opacity
    textDecoration: `underline wavy ${underLineColors[level]}`,
    isWholeLine: true
  });
}
