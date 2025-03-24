import * as vscode from 'vscode';
import { get } from '../../util/axiosNaming';

export type Level = 'debug' | 'info' | 'warning' | 'error';

export interface LogOverview {
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
    level?: Level | null;                 // e.g. "error", "warning"
    filePath?: string | null;             // e.g. "backend/transactions/tasks.py"
    messagePreview?: string | null;       // e.g. "AttributeError: 'NoneType' object..."
}


export interface FileResult {
    id: number;
    company: number;
    level: Level | null;
    suggestions: Array<{
        lineNumber: number;
        message: string;
        filePath: string;
        errorCount: number;
    }>;
    overview: LogOverview;
}


export async function getFileResults(params: {
    filePath: string;
}): Promise<FileResult[]> {
    try {
        const serverUrl = 'api/v1/suggestions/59be6716-a478-4834-b7e0-754f975f4368/suggestions/';
        console.log('Pulling errors for file: ', params.filePath);
        // Example request that passes file_path as a query param
        const response = await get(serverUrl, {
            params: params
        });

        // The API returns an array of records, each with a 'suggestions' array
        const records = response.data as FileResult[];
        console.log('Raw API response:', records);

        // Flatten all suggestions from all records
        const allSuggestions = records.flatMap(record => record.suggestions);

        // Optionally filter suggestions that match the current file
        // (If your backend already filters by file_path, this might be unnecessary,
        //  but it's often safer to double-check.)
        const relevantSuggestions = allSuggestions;

        return response.data as FileResult[];

    } catch (err) {
        vscode.window.showWarningMessage(`Could not fetch remote errors: ${err}`);
        return [];
    }
}
