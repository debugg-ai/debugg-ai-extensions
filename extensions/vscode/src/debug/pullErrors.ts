// pullErrors.ts
import * as vscode from 'vscode';
import { get } from '../util/axiosNaming';
import { gitProcessTool } from '../util/gitUtils';
import { highlightErrors } from './highlight';

interface LogOverview {
  args: unknown[];                       // e.g. ['foo', 'bar']
  kwargs: Record<string, unknown>;       // e.g. { baz: 'qux' }

  exceptionType?: string | null;        // e.g. "AttributeError"
  handled?: string | null;               // e.g. "no"
  mechanism?: string | null;             // e.g. "celery"
  environment?: string | null;           // e.g. "production"
  traceId?: string | null;              // e.g. "6318bd31dbf843b48380bbfe3979233b"
  celeryTaskId?: string | null;        // e.g. "396bf247-f397-4ef3-a0b7-b9d77a803ed2"
  runtimeVersion?: string | null;       // e.g. "3.11.5"
  serverName?: string | null;           // e.g. "ip-10-0-1-25.us-east-2.compute.internal"
  eventId?: string | null;             // e.g. "fda64423"
  timestamp?: string | null;             // e.g. "2023-03-10T06:20:21.000Z"
  level?: string | null;                 // e.g. "error", "warning"
  filePath?: string | null;             // e.g. "backend/transactions/tasks.py"
  messagePreview?: string | null;       // e.g. "AttributeError: 'NoneType' object..."
}


interface ApiRecord {
  id: number;
  company: number;
  level: string;
  suggestions: Array<{
    lineNumber: number;
    message: string;
    filePath: string;
    errorCount: number;
  }>;
  overview: LogOverview;
}

/**
 * pullErrorsAndHighlight
 * Performs an HTTP GET to fetch errors for the given file and highlights them in the editor.
 * 
 * @param editor  The currently active text editor
 */
export async function pullErrorsAndHighlight(editor: vscode.TextEditor) {
  try {
    const fullPath = editor.document.uri.fsPath;

    // Replace with your actual server URL
    const serverUrl = 'api/v1/suggestions/a9179c1c-94fc-4c9b-9bcf-3a442407426e/90c435f3-cea6-4ada-8816-f0f3e0ae4163/';

    // Convert absolute path to relative path
    const gitProcess = await gitProcessTool();
    const filePath = fullPath.replace(gitProcess + '/', '');

    console.log('Pulling errors and highlights for file: ', filePath);
    // Example request that passes file_path as a query param
    const response = await get(serverUrl, {
      params: { filePath: filePath }
    });

    // The API returns an array of records, each with a 'suggestions' array
    const records = response.data as ApiRecord[];
    console.log('Raw API response:', records);

    // Flatten all suggestions from all records
    const allSuggestions = records.flatMap(record => record.suggestions);

    // Optionally filter suggestions that match the current file
    // (If your backend already filters by file_path, this might be unnecessary,
    //  but it's often safer to double-check.)
    const relevantSuggestions = allSuggestions;

    console.log('Relevant suggestions for this file:', relevantSuggestions);

    // Finally, pass these suggestions to the highlight function
    highlightErrors(editor, relevantSuggestions);
  } catch (err) {
    vscode.window.showWarningMessage(`Could not fetch remote errors: ${err}`);
  }
}

