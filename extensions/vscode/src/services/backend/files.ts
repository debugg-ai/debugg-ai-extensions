import * as vscode from 'vscode';
import { get } from '../../util/axiosNaming';
import { FileResult, Issue, PaginatedIssueResponse } from '../backend/types';
import { COMPANY_KEY, DEBUGG_AI_HOST_NAME, PROJECT_KEY } from './constants';

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

export async function getFileResults(
  companyKey: string,
  projectKey: string,
  options?: { 
    filePath?: string;
    query_params?: Record<string, any> 
  }
): Promise<FileResult[]> {
  try {
    if (options?.filePath) {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        throw new Error('No workspace folder found');
      }

      const gitPath = vscode.workspace.getConfiguration('git').get<string>('path') || 'git';
      const gitRoot = await new Promise<string>((resolve, reject) => {
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
      options.query_params = {
        ...options.query_params,
        file_path: options.filePath.replace(gitRoot + '/', '')
      };
    }

    const response = await get(
      `/api/v1/suggestions/${COMPANY_KEY}/${PROJECT_KEY}/`,
      { params: options?.query_params }
    );

    return response.data as FileResult[];
  } catch (err) {
    vscode.window.showWarningMessage(`Could not fetch remote errors: ${err}`);
    return [];
  }
}