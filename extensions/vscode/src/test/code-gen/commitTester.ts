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
import { ContextExtractor } from './analyzers/ContextExtractor';
import { E2eFileAnalyzer } from './analyzers/E2eFileAnalyzer';
import { CodebaseContext } from './types/codebaseContext';
import { E2eSnapshot } from './types/e2eAnalysis';

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
  private testOutputDir: string = '';
  private fileWatchers: Map<string, fs.StatWatcher> = new Map();
  private context: vscode.ExtensionContext;
  private e2eFileAnalyzer: E2eFileAnalyzer;
  private contextExtractor: ContextExtractor;

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
    this.e2eFileAnalyzer = new E2eFileAnalyzer(ide);
    this.contextExtractor = new ContextExtractor(ide);
  }

  /**
   * Initialize and start monitoring git commits automatically
   */
  async initialize(): Promise<void> {
    try {
      // Check if commit testing is enabled (default to true)
      const config = vscode.workspace.getConfiguration('debugg-ai');
      const commitTestingEnabled = config.get<boolean>('enableCommitTesting', true);
      const localConfig = await this.configHandler.loadConfig();
      this.testOutputDir = localConfig.config?.debuggAiTestOutputDir || 'tests/debugg-ai';
      console.log(`[CommitTester] Test output directory: ${this.testOutputDir}`);

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
      const result = await this.generateCommitContext({ hash: newCommitHash, message: commitInfo.message, author: commitInfo.author, date: commitInfo.date, files: commitInfo.files, diff: commitInfo.diff });

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
  private extractTestFilesFromMessage(content: string): Array<{ name: string, content: string }> {
    const testFiles: Array<{ name: string, content: string }> = [];

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
  private async saveTestFile(testFile: { name: string, content: string }): Promise<string | null> {
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
    branchInfo: { branch: string, commitHash: string };
    e2eSnapshot?: E2eSnapshot | undefined;
    codebaseContext?: CodebaseContext | undefined;
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
      branchInfo: { branch: '', commitHash: '' },
      e2eSnapshot: undefined,
      codebaseContext: undefined,
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

      // Analyze existing e2e structure to understand current coverage
      const repoName = path.basename(workspaceDirPath);
      const e2eSnapshot = await this.createE2eSnapshot(workspaceDirPath, repoName, branchInfo, workingChanges);

      console.log('[CommitTester] E2E snapshot created:', e2eSnapshot ? 'success' : 'failed');

      // Extract codebase context for changed files and related components
      const codebaseContext = await this.extractCodebaseContext(workspaceDirPath, repoName, branchInfo, workingChanges);

      console.log('[CommitTester] Codebase context extracted:', codebaseContext ? 'success' : 'failed');
      if (codebaseContext) {
        const stats = this.contextExtractor.getExtractionStats(codebaseContext);
        console.log(`[CommitTester] Context stats: ${stats.filesAnalyzed} files, ${stats.totalSizeKB}KB, ${stats.focusAreas} focus areas`);
      }

      return {
        workingChanges: workingChanges,
        branchInfo: branchInfo,
        e2eSnapshot: e2eSnapshot || undefined,
        codebaseContext: codebaseContext || undefined,
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
        branchInfo: { branch: '', commitHash: '' },
        e2eSnapshot: undefined,
        codebaseContext: undefined,
        testFiles: []
      };
    }
  }

  /**
   * Create a comprehensive e2e snapshot including existing e2e files and working changes analysis
   */
  private async createE2eSnapshot(
    workspaceDirPath: string,
    repoName: string,
    branchInfo: { branch: string, commitHash: string },
    workingChanges: WorkingChanges
  ): Promise<E2eSnapshot | null> {
    try {
      console.log('[CommitTester] Creating e2e snapshot for repository:', repoName);

      // Create base e2e snapshot using the analyzer
      const snapshot = await this.e2eFileAnalyzer.createE2eSnapshot(workspaceDirPath, repoName, branchInfo);

      if (!snapshot) {
        console.log('[CommitTester] No existing e2e files found, creating minimal snapshot');
        // Create a minimal snapshot even if no e2e files exist
        return this.createMinimalE2eSnapshot(workspaceDirPath, repoName, branchInfo, workingChanges);
      }

      // Enhance the snapshot with working changes analysis
      const enhancedSnapshot = await this.enhanceSnapshotWithWorkingChanges(snapshot, workingChanges);

      console.log('[CommitTester] Enhanced e2e snapshot created with', enhancedSnapshot.currentE2eFiles.length, 'existing e2e files');
      return enhancedSnapshot;

    } catch (error) {
      console.error('[CommitTester] Error creating e2e snapshot:', error);
      return null;
    }
  }

  /**
   * Create a minimal e2e snapshot when no existing e2e files are found
   */
  private async createMinimalE2eSnapshot(
    workspaceDirPath: string,
    repoName: string,
    branchInfo: { branch: string, commitHash: string },
    workingChanges: WorkingChanges
  ): Promise<E2eSnapshot> {
    const e2eFramework = await this.e2eFileAnalyzer.detectE2eFramework(workspaceDirPath);

    return {
      repository: {
        name: repoName,
        path: workspaceDirPath,
        branch: branchInfo.branch,
        commitHash: branchInfo.commitHash,
        lastUpdated: new Date().toISOString()
      },
      e2eFramework,
      currentE2eFiles: [],
      coverageSummary: {
        totalE2eFiles: 0,
        passingE2eFiles: 0,
        failingE2eFiles: 0,
        totalComponentsCovered: 0,
        totalPagesCovered: 0,
        coverageAreas: this.inferCoverageAreasFromChanges(workingChanges)
      },
      uncoveredAreas: this.identifyUncoveredAreas(workingChanges),
      e2ePatterns: {
        namingConvention: `${e2eFramework.primary === 'cypress' ? 'feature.cy.ts' : 'feature.spec.ts'}`,
        commonSelectors: {
          buttons: "[data-testid*='button']",
          forms: "[data-testid*='form']",
          inputs: "[data-testid*='input']",
          modals: "[data-testid*='modal']"
        },
        pageObjectModel: false,
        dataStrategy: 'inline'
      },
      dependencies: {
        e2e_utilities: e2eFramework.primary !== 'unknown' ? [`@${e2eFramework.primary}/test`] : [],
        assertions: ['expect'],
        changed_files: workingChanges.changes.map(c => c.file)
      }
    };
  }

  /**
   * Enhance existing e2e snapshot with working changes analysis
   */
  private async enhanceSnapshotWithWorkingChanges(
    snapshot: E2eSnapshot,
    workingChanges: WorkingChanges
  ): Promise<E2eSnapshot> {
    // Add working changes context to dependencies
    const enhancedDependencies = {
      ...snapshot.dependencies,
      changed_files: workingChanges.changes.map(c => c.file),
      change_types: workingChanges.changes.map(c => c.status)
    };

    // Identify potential gaps in e2e coverage based on changes
    const additionalUncoveredAreas = this.identifyUncoveredAreas(workingChanges);
    const mergedUncoveredAreas = [
      ...snapshot.uncoveredAreas,
      ...additionalUncoveredAreas.filter(area =>
        !snapshot.uncoveredAreas.some(existing => existing.component === area.component)
      )
    ];

    // Update coverage areas with inferred areas from changes
    const inferredAreas = this.inferCoverageAreasFromChanges(workingChanges);
    const mergedCoverageAreas = [
      ...new Set([...snapshot.coverageSummary.coverageAreas, ...inferredAreas])
    ];

    return {
      ...snapshot,
      coverageSummary: {
        ...snapshot.coverageSummary,
        coverageAreas: mergedCoverageAreas
      },
      uncoveredAreas: mergedUncoveredAreas,
      dependencies: enhancedDependencies
    };
  }

  /**
   * Infer coverage areas from working changes
   */
  private inferCoverageAreasFromChanges(workingChanges: WorkingChanges): string[] {
    const areas = new Set<string>();

    for (const change of workingChanges.changes) {
      const file = change.file.toLowerCase();

      // Infer areas from file paths and content
      if (file.includes('auth') || file.includes('login') || file.includes('signin')) {
        areas.add('Authentication');
      }
      if (file.includes('nav') || file.includes('header') || file.includes('menu')) {
        areas.add('Navigation');
      }
      if (file.includes('form') || file.includes('contact') || file.includes('input')) {
        areas.add('Forms');
      }
      if (file.includes('user') || file.includes('profile') || file.includes('account')) {
        areas.add('User Management');
      }
      if (file.includes('api') || file.includes('service') || file.includes('endpoint')) {
        areas.add('API Integration');
      }
      if (file.includes('component') || file.includes('ui') || file.includes('button')) {
        areas.add('UI Components');
      }

      // Analyze diff content for more context
      if (change.diff) {
        const diff = change.diff.toLowerCase();
        if (diff.includes('fetch') || diff.includes('axios') || diff.includes('http')) {
          areas.add('API Integration');
        }
        if (diff.includes('onclick') || diff.includes('submit') || diff.includes('button')) {
          areas.add('User Interactions');
        }
        if (diff.includes('validation') || diff.includes('error') || diff.includes('required')) {
          areas.add('Form Validation');
        }
      }
    }

    return Array.from(areas);
  }

  /**
   * Identify areas that are not covered by existing tests
   */
  private identifyUncoveredAreas(workingChanges: WorkingChanges): Array<{ component: string, pages: string[], reason: string }> {
    const uncovered: Array<{ component: string, pages: string[], reason: string }> = [];

    for (const change of workingChanges.changes) {
      const fileName = path.basename(change.file, path.extname(change.file));
      const component = fileName.charAt(0).toUpperCase() + fileName.slice(1);

      // Determine likely pages/routes affected
      const pages: string[] = [];
      if (change.file.includes('page') || change.file.includes('route')) {
        pages.push(`/${fileName.toLowerCase()}`);
      }

      let reason = 'New or modified code without corresponding tests';
      if (change.status === 'A') {
        reason = 'New file added without test coverage';
      } else if (change.status === 'M') {
        reason = 'Modified file may need additional test coverage';
      } else if (change.status === 'D') {
        reason = 'File deleted - verify related tests are still valid';
      }

      uncovered.push({
        component,
        pages,
        reason
      });
    }

    return uncovered;
  }

  /**
   * Extract codebase context for working changes
   */
  private async extractCodebaseContext(
    workspaceDirPath: string,
    repoName: string,
    branchInfo: { branch: string, commitHash: string },
    workingChanges: WorkingChanges
  ): Promise<CodebaseContext | null> {
    try {
      console.log('[CommitTester] Extracting codebase context for', repoName);

      // Use the context extractor to get comprehensive context
      const context = await this.contextExtractor.extractCodebaseContext(
        workspaceDirPath,
        repoName,
        workingChanges,
        branchInfo
      );

      if (context) {
        console.log(`[CommitTester] Context extracted: ${context.totalContextFiles} files, ${Math.round(context.totalContextSizeBytes / 1024)}KB`);
        console.log(`[CommitTester] Focus areas: ${context.focusAreas.join(', ')}`);

        // Log architectural patterns found
        if (context.architecturalPatterns.length > 0) {
          console.log(`[CommitTester] Architectural patterns: ${context.architecturalPatterns.join(', ')}`);
        }

        // Log user journeys if found
        if (context.userJourneyMapping.length > 0) {
          console.log(`[CommitTester] User journeys: ${context.userJourneyMapping.join(', ')}`);
        }
      }

      return context;
    } catch (error) {
      console.error('[CommitTester] Error extracting codebase context:', error);
      return null;
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
  private async getCurrentBranchInfo(workspaceDir: string): Promise<{ branch: string, commitHash: string }> {
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
  private async getWorkingChanges(workspaceUri: string, workspaceDir: string, branchInfo: { branch: string, commitHash: string }): Promise<WorkingChanges> {
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

  /**
   * Generate tests for a specific commit
   */
  public async generateCommitContext(commitInfo: CommitInfo): Promise<{
    workingChanges: WorkingChanges;
    branchInfo: { branch: string, commitHash: string };
    e2eSnapshot?: E2eSnapshot | undefined;
    codebaseContext?: CodebaseContext | undefined;
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
      branchInfo: { branch: '', commitHash: '' },
      e2eSnapshot: undefined,
      codebaseContext: undefined,
      testFiles: []
    };

    try {
      console.log(`[CommitTester] Generating tests for commit ${commitInfo.hash}`);

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

      // Get commit changes using git show
      const commitChanges = await this.getCommitChanges(workspaceDir, workspaceDirPath, commitInfo);
      console.log('[CommitTester] Found changes for commit:', commitChanges.changes.length);

      console.log('[CommitTester] Branch info:', branchInfo); // TODO: remove this

      // Create working changes structure for the commit
      const workingChanges: WorkingChanges = {
        changes: commitChanges.changes,
        branchInfo: {
          branch: branchInfo.branch,
          commitHash: branchInfo.commitHash
        }
      };
      // Analyze existing e2e structure to understand current coverage
      const repoName = path.basename(workspaceDirPath);
      const e2eSnapshot = await this.createE2eSnapshot(workspaceDirPath, repoName, branchInfo, workingChanges);

      console.log('[CommitTester] E2E snapshot created:', e2eSnapshot ? 'success' : 'failed');

      // Extract codebase context for changed files and related components
      const codebaseContext = await this.extractCodebaseContext(workspaceDirPath, repoName, branchInfo, workingChanges);

      console.log('[CommitTester] Codebase context extracted:', codebaseContext ? 'success' : 'failed');
      if (codebaseContext) {
        const stats = this.contextExtractor.getExtractionStats(codebaseContext);
        console.log(`[CommitTester] Context stats: ${stats.filesAnalyzed} files, ${stats.totalSizeKB}KB, ${stats.focusAreas} focus areas`);
      }

      return {
        workingChanges,
        branchInfo: {
          branch: branchInfo.branch,
          commitHash: branchInfo.commitHash
        },
        e2eSnapshot: e2eSnapshot || undefined,
        codebaseContext: codebaseContext || undefined,
        testFiles: []
      };

    } catch (error) {
      console.error(`[CommitTester] Error generating tests for commit ${commitInfo.hash}:`, error);
      return nullResult;
    }
  }

  /**
   * Get changes for a specific commit
   */
  private async getCommitChanges(workspaceUri: string, workspaceDirPath: string, commitInfo: CommitInfo): Promise<WorkingChanges> {
    const ignoredFolders = ['node_modules', 'dist', 'build', this.testOutputDir, 'out'];
    const changes: WorkingChange[] = [];
    
    try {
      // Get the list of changed files with their status
      const command = `git show --name-status --format="" ${commitInfo.hash}`;
      const [stdout] = await this.ide.subprocess(command, workspaceDirPath);
      console.log('[CommitTester.getCommitChanges] Status output:', stdout);

      const lines = stdout.trim().split('\n').filter(line => line.trim());

      for (const line of lines) {
        const parts = line.trim().split('\t');
        if (parts.length >= 2) {
          const gitStatus = parts[0];
          const file = parts[1];
          let oldFile: string | undefined;

          // Handle renamed files (format: R100    old_file    new_file)
          if (gitStatus.startsWith('R') && parts.length >= 3) {
            oldFile = parts[1];
            const newFile = parts[2];
            console.log('[CommitTester.getCommitChanges] Renamed file:', oldFile, '->', newFile);
            // Use the new file name as the primary file
            parts[1] = newFile;
          }

          const finalFile = parts[1];

          console.log('[CommitTester.getCommitChanges] Git Status:', gitStatus);
          console.log('[CommitTester.getCommitChanges] File:', finalFile);

          // Skip ignored folders
          if (ignoredFolders.some(folder => finalFile.startsWith(folder))) {
            console.log('[CommitTester.getCommitChanges] Skipping ignored file:', finalFile);
            continue;
          }

          // Map git status to our status format (similar to git status --porcelain)
          let status: string;
          if (gitStatus.startsWith('A')) {
            status = 'A'; // Added
          } else if (gitStatus.startsWith('M')) {
            status = 'M'; // Modified
          } else if (gitStatus.startsWith('D')) {
            status = 'D'; // Deleted
          } else if (gitStatus.startsWith('R')) {
            status = 'R'; // Renamed
          } else if (gitStatus.startsWith('C')) {
            status = 'C'; // Copied
          } else {
            status = gitStatus; // Keep original for other statuses
          }

          let diff = '';

          if (status === 'A' || status === 'M' || status === 'R' || status === 'C') {
            // Get diff for added, modified, renamed, or copied files
            try {
              // Compare against parent commit to see what changed
              const parentCommand = `git show ${commitInfo.hash}^:${finalFile}`;
              const currentCommand = `git show ${commitInfo.hash}:${finalFile}`;
              
              try {
                // Try to get diff between parent and current commit
                const diffCommand = `git show ${commitInfo.hash} -- "${finalFile}"`;
                const [diffOutput] = await this.ide.subprocess(diffCommand, workspaceDirPath);
                diff = diffOutput;
              } catch (diffError) {
                // If that fails, try getting the full file content for new files
                try {
                  const [fileContent] = await this.ide.subprocess(currentCommand, workspaceDirPath);
                  diff = fileContent;
                } catch (contentError) {
                  console.error(`[CommitTester] Error getting content for file ${finalFile}: ${contentError}`);
                }
              }
            } catch (error) {
              console.error(`[CommitTester] Error getting diff for file ${finalFile}: ${error}`);
            }
          } else if (status === 'D') {
            // For deleted files, we can get the content that was removed
            try {
              const parentCommand = `git show ${commitInfo.hash}^:${finalFile}`;
              const [deletedContent] = await this.ide.subprocess(parentCommand, workspaceDirPath);
              diff = `--- Deleted file content ---`;  // For now just mark it as deleted
            } catch (error) {
              console.error(`[CommitTester] Error getting deleted file content for ${finalFile}: ${error}`);
            }
          }

          console.log('[CommitTester.getCommitChanges] Adding change:', { status, file: finalFile, diffLength: diff.length });
          changes.push({ 
            status, 
            file: finalFile, 
            diff: diff || undefined 
          });

          // For renamed files, also track the old file as deleted
          if (status === 'R' && oldFile) {
            changes.push({
              status: 'D',
              file: oldFile,
              diff: `--- File renamed to ${finalFile} ---`
            });
          }
        }
      }

      console.log(`[CommitTester.getCommitChanges] Found ${changes.length} changes for commit ${commitInfo.hash}`);

      return { 
        changes, 
        branchInfo: { 
          branch: '', 
          commitHash: commitInfo.hash 
        } 
      };
    } catch (error) {
      console.error(`[CommitTester] Error getting commit changes: ${error}`);
      return {
        changes,
        branchInfo: {
          branch: '',
          commitHash: commitInfo.hash
        }
      };
    }
  }

}
