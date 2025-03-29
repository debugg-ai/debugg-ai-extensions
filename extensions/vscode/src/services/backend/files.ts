import * as vscode from 'vscode';
import { get } from '../../util/axiosNaming';
import { Issue, PaginatedIssueResponse } from '../backend/types';
import { DEBUGG_AI_HOST_NAME, PROJECT_KEY } from './constants';

/**
 * FilesService
 * 
 * Service for fetching files from the backend that contain errors
 * 
 * 
 */
export const FilesService = {
    /**
     * Get a sequential list of files that contain errors. Starting
     * with the most RECENT error.
     */
    async getFilesWithRecentErrors(options?: {
        host?: string;
        projectKey?: string;
        page?: number;
    }): Promise<Issue[]> {
        const params = {
            ...(options?.host ? { host: options.host } : { host: DEBUGG_AI_HOST_NAME }),
            ...(options?.projectKey ? { projectKey: options.projectKey } : { projectKey: PROJECT_KEY }),
            ...(options?.page ? { page: options.page } : {}),
        };
        const response = await get(`/api/v1/issues/recent_local/`, { params });
        const paginatedResponse = response.data as PaginatedIssueResponse;
        return paginatedResponse.results as Issue[];
    }

}

export async function getIssuesInFile(
  params: { 
    filePath: string;
    query_params?: Record<string, any> 
  }
): Promise<Issue[]> {

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

    console.log('Raw API response:', response.data);

    // Optionally filter suggestions that match the current file
    // (If your backend already filters by file_path, this might be unnecessary,
    //  but it's often safer to double-check.)
    const issues = response.data as Issue[];
    return issues;

} catch (err) {
    vscode.window.showWarningMessage(`Could not fetch remote errors: ${err}`);
    return [];
}

}