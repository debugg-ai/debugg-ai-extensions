import * as vscode from 'vscode';
import { get } from '../../util/axiosNaming';
import { FileResult } from '../backend/types';

export async function getFileResults(params: {
    filePath: string;
}): Promise<FileResult[]> {
    try {
        const serverUrl = 'api/v1/suggestions/a9179c1c-94fc-4c9b-9bcf-3a442407426e/90c435f3-cea6-4ada-8816-f0f3e0ae4163/';
        // Get relative path to git repo root
        const gitPath = vscode.workspace.getConfiguration('git').get<string>('path') || 'git';
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            throw new Error('No workspace folder found');
        }
    
        const gitProcess = await new Promise<string>((resolve, reject) => {
            const cp = require('child_process');
            cp.exec(`"${gitPath}" rev-parse --show-toplevel`, {
                cwd: workspaceFolder.uri.fsPath
            }, (err: any, stdout: string) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(stdout.trim());
            });
        });
        // Convert absolute path to relative path
        const relativePath = params.filePath.replace(gitProcess + '/', '');
        console.log('Relative path: ', relativePath);
        params.filePath = relativePath;
        // Example request that passes file_path as a query param

        console.log('Pulling inlays for file: ', params.filePath);
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
