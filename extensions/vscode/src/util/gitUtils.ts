import * as vscode from 'vscode';

export const gitProcessTool = async () => {
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
    // const relativePath = params.filePath.replace(gitProcess + '/', '');
    // console.log('Relative path: ', relativePath);
    return gitProcess;
}
