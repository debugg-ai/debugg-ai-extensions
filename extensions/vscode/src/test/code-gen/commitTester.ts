import * as fs from 'fs';
import { fileURLToPath } from "node:url";
import * as path from 'path';

import { ConfigHandler } from 'core/config/ConfigHandler';
import { DebuggAIServerClient } from 'core/debuggAIServer/stubs/client';
import { CommitInfo, E2eTest, WorkingChange, WorkingChanges } from 'core/debuggAIServer/types';
import { E2eTestHandler } from 'core/e2es/e2eTestHandler';
import { NgrokTunnelClient } from 'core/e2es/ngrok-service';
import { IDE } from 'core/index.js';
import * as vscode from 'vscode';

export interface TestGenerationResult {
  success: boolean;
  testFiles: string[];
  error?: string;
}

export interface GitExtension {
  readonly enabled: boolean;
  getAPI(version: number): API;
}

export interface API {
  repositories: Repository[];
}

export interface Repository {
  rootUri: vscode.Uri;
}

export class CommitTester {
  private client: DebuggAIServerClient;
  private ide: IDE;
  private configHandler: ConfigHandler;
  private e2eTestHandler: E2eTestHandler;
  private isMonitoring: boolean = false;
  private lastCommitHash: string | null = null;
  private testOutputDir: string = 'tests/playwright';
  private fileWatchers: Map<string, fs.StatWatcher> = new Map();
  private context: vscode.ExtensionContext;

  constructor(
    client: DebuggAIServerClient,
    ide: IDE,
    configHandler: ConfigHandler,
    context: vscode.ExtensionContext
  ) {
    this.client = client;
    this.ide = ide;
    this.configHandler = configHandler;
    this.context = context;
    this.e2eTestHandler = new E2eTestHandler(
      client,
      ide,
      configHandler,
      new NgrokTunnelClient()
    );
  }

  /**
   * Initialize and start monitoring git commits automatically
   */
  async initialize(): Promise<void> {
    try {
      // Check if commit testing is enabled (default to true)
      const config = vscode.workspace.getConfiguration('debugg-ai');
      const commitTestingEnabled = config.get<boolean>('enableCommitTesting', true);
      
      if (!commitTestingEnabled) {
        console.log('[CommitTester] Commit testing is disabled in settings');
        return;
      }

      const git = this.getGitApi();
      if (!git) {
        console.log('[CommitTester] Git extension not found');
        return;
      }

      // Wait for git API to be ready
      const api = await git;
      if (!api || !api.repositories.length) {
        console.log('[CommitTester] No git repositories found');
        return;
      }

      // Set up monitoring for each repository
      for (const repo of api.repositories) {
        await this.setupRepositoryMonitoring(repo);
      }

      this.isMonitoring = true;
      console.log('[CommitTester] Started monitoring git commits automatically');
      
      // Create test output directory
      await this.ensureTestOutputDir();
      
    } catch (error) {
      console.error('[CommitTester] Failed to initialize:', error);
    }
  }

  /**
   * Set up monitoring for a specific repository
   */
  private async setupRepositoryMonitoring(repo: Repository): Promise<void> {
    const repoPath = repo.rootUri.fsPath;
    const gitLogPath = path.join(repoPath, '.git', 'logs', 'HEAD');

    if (!fs.existsSync(gitLogPath)) {
      console.log(`[CommitTester] No git log found at ${gitLogPath}`);
      return;
    }

    console.log(`[CommitTester] Setting up monitoring for ${repoPath}`);
    
    // Get initial commit hash
    this.lastCommitHash = await this.getLatestCommitHash(repoPath);
    
    let lastModified = fs.statSync(gitLogPath).mtimeMs;

    const watcher = fs.watchFile(gitLogPath, { interval: 1000 }, async (curr, prev) => {
      if (curr.mtimeMs !== lastModified) {
        lastModified = curr.mtimeMs;
        console.log(`[CommitTester] New commit detected in ${repoPath}`);
        
        // Add a small delay to ensure git log is fully written
        setTimeout(async () => {
          await this.handleNewCommit(repoPath);
        }, 1000);
      }
    });

    // Store watcher for cleanup
    this.fileWatchers.set(repoPath, watcher);

    // Register cleanup on extension deactivation
    this.context.subscriptions.push({
      dispose: () => {
        fs.unwatchFile(path.join(repoPath, '.git', 'logs', 'HEAD'));
        this.fileWatchers.delete(repoPath);
      },
    });
  }

  /**
   * Get the Git API from VS Code extension
   */
  private getGitApi(): Promise<API> | undefined {
    const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git');

    if (!gitExtension) {
      console.log('[CommitTester] Git extension not found');
      return undefined;
    }

    if (gitExtension.isActive) {
      return Promise.resolve(gitExtension.exports.getAPI(1));
    } else {
      return Promise.resolve(gitExtension.activate()).then(ext => ext.getAPI(1));
    }
  }

  /**
   * Stop monitoring git commits
   */
  stopMonitoring(): void {
    this.isMonitoring = false;
    this.lastCommitHash = null;
    
    // Clean up all file watchers
    for (const [repoPath, watcher] of this.fileWatchers) {
      fs.unwatchFile(path.join(repoPath, '.git', 'logs', 'HEAD'));
    }
    this.fileWatchers.clear();
    
    console.log('[CommitTester] Stopped monitoring git commits');
  }

  /**
   * Handle a new commit by generating tests
   */
  private async handleNewCommit(workspaceDir: string): Promise<void> {
    try {
      const newCommitHash = await this.getLatestCommitHash(workspaceDir);
      
      if (newCommitHash === this.lastCommitHash) {
        return; // Same commit, no need to process
      }

      const commitInfo = await this.getCommitInfo(workspaceDir, newCommitHash);
      if (!commitInfo) {
        return;
      }

      vscode.window.showInformationMessage(
        `🟢 New commit detected: ${commitInfo.message.substring(0, 50)}...`
      );

      // Generate tests for the commit
      const result = await this.generateTestsForCommit(commitInfo);
      
      if (result.success) {
        vscode.window.showInformationMessage(
          `✅ Generated ${result.testFiles.length} test files for commit ${newCommitHash.substring(0, 8)}`
        );
      } else {
        vscode.window.showWarningMessage(
          `⚠️ Failed to generate tests: ${result.error}`
        );
      }

      this.lastCommitHash = newCommitHash;
      
    } catch (error) {
      console.error('[CommitTester] Error handling commit:', error);
      vscode.window.showErrorMessage(`Error handling commit: ${error}`);
    }
  }

  /**
   * Get the latest commit hash
   */
  private async getLatestCommitHash(workspaceDir: string): Promise<string> {
    const [output] = await this.ide.subprocess(
      'git rev-parse HEAD',
      workspaceDir
    );
    return output.trim();
  }

  /**
   * Get detailed information about a commit
   */
  private async getCommitInfo(workspaceDir: string, commitHash: string): Promise<CommitInfo | null> {
    try {
      // Get commit details
      const [commitOutput] = await this.ide.subprocess(
        `git show --pretty=format:"%H%n%s%n%an%n%ad" --date=iso ${commitHash}`,
        workspaceDir
      );

      // Get changed files
      const [filesOutput] = await this.ide.subprocess(
        `git show --name-only --pretty=format: ${commitHash}`,
        workspaceDir
      );

      // Get diff
      const [diffOutput] = await this.ide.subprocess(
        `git show ${commitHash}`,
        workspaceDir
      );

      const lines = commitOutput.trim().split('\n');
      const files = filesOutput.trim().split('\n').filter(f => f.length > 0);

      return {
        hash: lines[0],
        message: lines[1],
        author: lines[2],
        date: lines[3],
        files: files,
        diff: diffOutput
      };
    } catch (error) {
      console.error('[CommitTester] Error getting commit info:', error);
      return null;
    }
  }

  /**
   * Generate tests for a specific commit
   */
  private async generateTestsForCommit(commitInfo: CommitInfo): Promise<TestGenerationResult> {
    try {
      const { config } = await this.configHandler.loadConfig();
      let localPortConfig = config?.debuggAiServerPort;
      
      if (!localPortConfig) {
        localPortConfig = 3000; // Default port
      }

      // Create a description for test generation based on commit info
      const testDescription = this.createTestDescription(commitInfo);

      // Generate test using the E2E test handler
      const e2eTest = await this.e2eTestHandler.createAndRunE2eTest(
        testDescription,
        localPortConfig
      );

      if (!e2eTest) {
        return {
          success: false,
          testFiles: [],
          error: 'Failed to create E2E test'
        };
      }

      // Wait for test completion and get results
      const testFiles = await this.waitForTestCompletionAndSaveFiles(e2eTest);

      return {
        success: true,
        testFiles: testFiles
      };

    } catch (error) {
      return {
        success: false,
        testFiles: [],
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Create a test description based on commit information
   */
  private createTestDescription(commitInfo: CommitInfo): string {
    const changedFiles = commitInfo.files.join(', ');
    const fileCount = commitInfo.files.length;
    
    return `Generate comprehensive E2E tests for the changes in commit ${commitInfo.hash.substring(0, 8)}. 
    
Commit Message: ${commitInfo.message}
Author: ${commitInfo.author}
Date: ${commitInfo.date}

Changed Files (${fileCount}): ${changedFiles}

Please analyze the changes and generate Playwright tests that:
1. Test the functionality that was added, modified, or fixed
2. Include both positive and negative test cases
3. Test edge cases and error conditions
4. Follow best practices for E2E testing
5. Include proper assertions and error handling

Focus on testing the user-facing functionality that was affected by these changes.`;
  }

  /**
   * Wait for test completion and save the generated test files
   */
  private async waitForTestCompletionAndSaveFiles(e2eTest: E2eTest): Promise<string[]> {
    const maxWaitTime = 5 * 60 * 1000; // 5 minutes
    const pollInterval = 5000; // 5 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      try {
        // Get the current test status
        const updatedTest = await this.client.e2es?.getE2eTest(e2eTest.uuid ?? '');
        
        if (!updatedTest) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          continue;
        }

        // Check if test has a current run
        if (updatedTest.curRun?.uuid) {
          const run = await this.client.e2es?.getE2eRun(updatedTest.curRun.uuid);
          
          if (run && run.status === 'completed') {
            // Test completed, extract and save test files
            return await this.extractAndSaveTestFiles(run);
          }
        }

        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } catch (error) {
        console.error('[CommitTester] Error polling test status:', error);
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }

    throw new Error('Test generation timed out');
  }

  /**
   * Extract test files from the completed test run and save them
   */
  private async extractAndSaveTestFiles(run: any): Promise<string[]> {
    const savedFiles: string[] = [];
    
    try {
      // Look for test files in the conversation messages
      const conversations = run.conversations || [];
      
      for (const conversation of conversations) {
        const messages = conversation.messages || [];
        
        for (const message of messages) {
          if (message.role === 'assistant' && message.content) {
            const testFiles = this.extractTestFilesFromMessage(message.content);
            
            for (const testFile of testFiles) {
              const savedPath = await this.saveTestFile(testFile);
              if (savedPath) {
                savedFiles.push(savedPath);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('[CommitTester] Error extracting test files:', error);
    }

    return savedFiles;
  }

  /**
   * Extract test files from a message content
   */
  private extractTestFilesFromMessage(content: string): Array<{name: string, content: string}> {
    const testFiles: Array<{name: string, content: string}> = [];
    
    // Look for code blocks that might contain test files
    const codeBlockRegex = /```(\w+)?\s*([^\n]+)?\n([\s\S]*?)```/g;
    let match;
    
    while ((match = codeBlockRegex.exec(content)) !== null) {
      const language = match[1] || '';
      const filename = match[2] || '';
      const code = match[3];
      
      // Check if this looks like a test file
      if (this.isTestFile(language, filename, code)) {
        const name = filename || this.generateTestFileName(language);
        testFiles.push({ name, content: code });
      }
    }
    
    return testFiles;
  }

  /**
   * Check if a code block looks like a test file
   */
  private isTestFile(language: string, filename: string, code: string): boolean {
    // Check for common test indicators
    const testIndicators = [
      'test(', 'describe(', 'it(', 'expect(', 'assert(',
      'playwright', 'page.', 'test.', 'expect(',
      'cy.', 'cypress', 'selenium', 'webdriver'
    ];
    
    const hasTestIndicators = testIndicators.some(indicator => 
      code.toLowerCase().includes(indicator.toLowerCase())
    );
    
    const hasTestExtension = filename.match(/\.(test|spec)\.(js|ts|py|java|cs)$/i) !== null;
    const isTestLanguage = ['javascript', 'typescript', 'python', 'java', 'csharp'].includes(language.toLowerCase());
    
    return hasTestIndicators || hasTestExtension || isTestLanguage;
  }

  /**
   * Generate a test file name if none is provided
   */
  private generateTestFileName(language: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const ext = this.getFileExtension(language);
    return `auto-generated-test-${timestamp}.${ext}`;
  }

  /**
   * Get file extension based on language
   */
  private getFileExtension(language: string): string {
    const extensions: { [key: string]: string } = {
      'javascript': 'js',
      'typescript': 'ts',
      'python': 'py',
      'java': 'java',
      'csharp': 'cs'
    };
    
    return extensions[language.toLowerCase()] || 'js';
  }

  /**
   * Save a test file to the test output directory
   */
  private async saveTestFile(testFile: {name: string, content: string}): Promise<string | null> {
    try {
      await this.ensureTestOutputDir();
      
      const filePath = path.join(this.testOutputDir, testFile.name);
      
      // Ensure the file has a proper extension
      if (!path.extname(testFile.name)) {
        testFile.name += '.js'; // Default to JavaScript
      }
      
      await fs.promises.writeFile(filePath, testFile.content, 'utf8');
      
      console.log(`[CommitTester] Saved test file: ${testFile.name}`);
      return filePath;
      
    } catch (error) {
      console.error('[CommitTester] Error saving test file:', error);
      return null;
    }
  }

  /**
   * Ensure the test output directory exists
   */
  private async ensureTestOutputDir(): Promise<void> {
    try {
      const workspaceDirs = await this.ide.getWorkspaceDirs();
      if (workspaceDirs.length > 0) {
        const wrkDir = workspaceDirs[0] ? workspaceDirs[0].replace('file://', '') : '';
        const fullPath = path.join(wrkDir, this.testOutputDir);
        await fs.promises.mkdir(fullPath, { recursive: true });
      }
    } catch (error) {
      console.error('[CommitTester] Error creating test output directory:', error);
    }
  }

  /**
   * Get the current monitoring status
   */
  isMonitoringCommits(): boolean {
    return this.isMonitoring;
  }

  /**
   * Get the test output directory
   */
  getTestOutputDirectory(): string {
    return this.testOutputDir;
  }

  /**
   * Set a custom test output directory
   */
  setTestOutputDirectory(dir: string): void {
    this.testOutputDir = dir;
  }

  /**
   * Generate tests for current working changes (uncommitted changes)
   */
  async generateTestsForWorkingChanges(): Promise<{
    workingChanges: WorkingChanges;
    branchInfo: {branch: string, commitHash: string};
    testFiles?: string[];
  }> {
    const nullResult = {
      workingChanges: {
        changes: [],
        branchInfo: {
          branch: '',
          commitHash: ''
        }
      },
      branchInfo: {branch: '', commitHash: ''},
      testFiles: []
    };
    try {
      console.log('[CommitTester] Generating tests for current working changes');

      // Get current git status to understand what changes exist
      let workspaceDir = await this.getCurrentWorkspaceDir();

      if (!workspaceDir) {
        console.log('[CommitTester] No workspace directory found');
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            console.log('[CommitTester] No active text editor found');
            return nullResult;
        }
        const repoName = await this.ide.getRepoName(editor.document.uri.fsPath);
        if (!repoName) {
            console.log('[CommitTester] No repo name found for file');
            return nullResult;
        }
        workspaceDir = path.dirname(editor.document.uri.fsPath);

      }
      console.log('[CommitTester] Workspace directory:', workspaceDir);

      const workspaceDirPath = fileURLToPath(workspaceDir);
      console.log('[CommitTester] Workspace directory path:', workspaceDirPath);

      // Get current branch and working changes
      const branchInfo = await this.getCurrentBranchInfo(workspaceDirPath);
      console.log('[CommitTester] Branch info:', branchInfo);
      const workingChanges = await this.getWorkingChanges(workspaceDir, workspaceDirPath, branchInfo);
      console.log('[CommitTester] Working changes:', workingChanges);
      if (!workingChanges.changes.length) {
        return nullResult;
      }

      // Structure the working changes properly
      // Send them to the server at /e2es/consolidate-changes/
      //    - repository information
      //    - branch information
      //    - working changes
      //    - commit hash
      //    - commit message
      //    - author
      //    - date
      //    - changed files
      // The server will respond with a list of test descriptions

      // We should not re-create how we run tests. Respond with descriptions
      //   and just let our existing test run commands handle it.
      // Send the new descriptions to the server at /e2es/generate-tests/ to create them
      // Wait for the tests to complete
      // Save the test files
      // Return the test files


      // Create a description of the working changes
      // const changeDescription = this.createWorkingChangesDescription(workingChanges, branchInfo);
      

      // Wait for test completion and save files
      // const testFiles = await this.waitForTestCompletionAndSaveFiles(e2eTest);
      
      return {
        workingChanges: workingChanges,
        branchInfo: branchInfo,
        testFiles: []
      };
      
    } catch (error) {
      console.error('[CommitTester] Error generating tests for working changes:', error);
      return {
        workingChanges: {
          changes: [],
          branchInfo: {
            branch: '',
            commitHash: ''
          }
        },
        branchInfo: {branch: '', commitHash: ''},
        testFiles: []
      };
    }
  }

  /**
   * Get the current workspace directory
   */
  private async getCurrentWorkspaceDir(): Promise<string | null> {
    // const git = this.getGitApi();
    // if (!git) {
    //   return null;
    // }

    // const api = await git;
    // if (!api || !api.repositories.length) {
    //   return null;
    // }

    // return api.repositories[0].rootUri.fsPath;

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return null;
    }
    try {
        const filePath = editor.document.uri.fsPath;
        const repoPath = await this.ide.getGitRootPath(filePath);
        if (!repoPath) {
            console.log('[CommitTester] No repo path found for file');
            return null;
        }
        return repoPath;

    } catch (e) {
        console.error("Error setting up E2E test runner:", e);
        vscode.window.showWarningMessage("File not found or not associated with a repo.");
        return null;
    }
  }

  /**
   * Get current branch information
   */
  private async getCurrentBranchInfo(workspaceDir: string): Promise<{branch: string, commitHash: string}> {
    const [branch] = await this.ide.subprocess(`git branch --show-current`, workspaceDir);
    const [commitHash] = await this.ide.subprocess(`git rev-parse HEAD`, workspaceDir);
    
    return {
      branch: branch.trim(),
      commitHash: commitHash.trim()
    };
  }

  /**
   * Get working changes (modified, added, deleted files)
    */
    private async getWorkingChanges(workspaceUri: string, workspaceDir: string, branchInfo: {branch: string, commitHash: string}): Promise<WorkingChanges> {
    const ignoredFolders = ['node_modules', 'dist', 'build', this.testOutputDir, 'out'];
    const [statusOutput] = await this.ide.subprocess(`git status --porcelain`, workspaceDir);
    const changes: WorkingChange[] = [];
    console.log('[CommitTester.getWorkingChanges] Status output:', statusOutput);

    for (const line of statusOutput.split('\n').filter((l: string) => l.trim())) {
      const status = line.substring(0, 2).trim();
      const file = line.substring(3);

      console.log('[CommitTester.getWorkingChanges] Status:', status);
      console.log('[CommitTester.getWorkingChanges] File:', file);
      if (ignoredFolders.some(folder => file.startsWith(folder))) {
        continue;
      }
      if (status === 'M' || status === 'A' || status === 'D') {
        let diff = '';
        if (status === 'M' || status === 'A') {
          // Get diff for modified/added files
          try {
            const [diffOutput] = await this.ide.subprocess(`git diff HEAD -- "${file}"`, workspaceDir);
            diff = diffOutput;
          } catch (error) {
            // File might be new, try staged diff
            try {
              const [diffOutput] = await this.ide.subprocess(`git diff --cached -- "${file}"`, workspaceDir);
              diff = diffOutput;
            } catch (e) {
              // Ignore diff errors
            }
          }
        }
        
        changes.push({ status, file, diff });
      } else if (status === '??') {
        // Completely new files have 'diffs' which are just the file contents
        console.log('[CommitTester.getWorkingChanges] New file:', file);
        try {
          const fileUri = path.join(workspaceUri, file);
          console.log('[CommitTester.getWorkingChanges] File URI:', fileUri);
          const fileContents = await this.ide.readFile(fileUri.toString());
          console.log('[CommitTester.getWorkingChanges] Successfully read file contents');
          changes.push({ status, file, diff: fileContents });
        } catch (error) {
          // Ignore diff errors
          console.error('[CommitTester.getWorkingChanges] Error reading file contents:', error);
        }
      }
    }
    
    return {
      changes,
      branchInfo: {
        branch: branchInfo.branch,
        commitHash: branchInfo.commitHash
      }
    };
  }

}
