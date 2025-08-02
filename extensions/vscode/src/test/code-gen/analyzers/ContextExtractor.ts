import { WorkingChanges } from 'core/debuggAIServer/types';
import { IDE } from 'core/index.js';
import { CodebaseContext, ContextExtractionOptions, FileContext } from '../types/codebaseContext';
import { CodebaseAnalyzer } from './CodebaseAnalyzer';

export class ContextExtractor {
  private ide: IDE;
  private analyzer: CodebaseAnalyzer;
  private options: ContextExtractionOptions;

  constructor(ide: IDE, options: Partial<ContextExtractionOptions> = {}) {
    this.ide = ide;
    this.options = {
      maxFileSize: 100000,
      maxParentFiles: 2,
      maxRoutingFiles: 3,
      maxConfigFiles: 2,
      timeoutMs: 15000,
      ...options
    };
    this.analyzer = new CodebaseAnalyzer(ide, this.options);
  }

  async extractCodebaseContext(
    repoPath: string,
    repoName: string,
    workingChanges: WorkingChanges,
    branchInfo: { branch: string; commitHash: string }
  ): Promise<CodebaseContext | null> {
    try {
      console.log('[ContextExtractor] Starting codebase context extraction for', repoName);
      
      const startTime = Date.now();
      
      // Extract changed files context
      const changedFiles = await this.extractChangedFilesContext(repoPath, workingChanges);
      if (changedFiles.length === 0) {
        console.log('[ContextExtractor] No valid changed files found');
        return null;
      }

      console.log(`[ContextExtractor] Extracted ${changedFiles.length} changed files`);

      // Find and extract parent components (with timeout protection)
      const parentComponents = await this.extractParentComponentsContext(repoPath, changedFiles);
      console.log(`[ContextExtractor] Found ${parentComponents.length} parent components`);

      // Find and extract routing files
      const routingFiles = await this.extractRoutingFilesContext(repoPath);
      console.log(`[ContextExtractor] Found ${routingFiles.length} routing files`);

      // Find and extract config files
      const configFiles = await this.extractConfigFilesContext(repoPath);
      console.log(`[ContextExtractor] Found ${configFiles.length} config files`);

      // Calculate totals
      const allFiles = [...changedFiles, ...parentComponents, ...routingFiles, ...configFiles];
      const totalFiles = allFiles.length;
      const totalSize = allFiles.reduce((sum, file) => sum + file.sizeBytes, 0);

      // Generate insights
      const architecturalPatterns = this.analyzer.analyzeArchitecturalPatterns(allFiles);
      const userJourneyMapping = this.analyzer.mapUserJourneys(routingFiles, changedFiles);
      const focusAreas = this.analyzer.suggestFocusAreas(changedFiles, architecturalPatterns);

      const elapsedTime = Date.now() - startTime;
      console.log(`[ContextExtractor] Context extraction completed in ${elapsedTime}ms`);

      return {
        commitHash: branchInfo.commitHash,
        commitMessage: `Working changes on ${branchInfo.branch}`,
        timestamp: new Date().toISOString(),
        repositoryName: repoName,
        changedFiles,
        parentComponents,
        routingFiles,
        configFiles,
        componentHierarchy: [], // TODO: Implement if needed
        routeMapping: [], // TODO: Implement if needed
        totalContextFiles: totalFiles,
        totalContextSizeBytes: totalSize,
        analysisTimestamp: new Date().toISOString(),
        architecturalPatterns,
        userJourneyMapping,
        focusAreas
      };

    } catch (error) {
      console.error('[ContextExtractor] Error extracting codebase context:', error);
      return null;
    }
  }

  private async extractChangedFilesContext(repoPath: string, workingChanges: WorkingChanges): Promise<FileContext[]> {
    const changedFiles: FileContext[] = [];
    const maxFiles = Math.min(workingChanges.changes.length, 10); // Limit for performance

    for (let i = 0; i < maxFiles; i++) {
      const change = workingChanges.changes[i];
      try {
        const fileContext = await this.analyzer.createFileContext(repoPath, change.file, 'changed');
        if (fileContext) {
          changedFiles.push(fileContext);
        }
      } catch (error) {
        console.debug(`[ContextExtractor] Error processing changed file ${change.file}:`, error);
      }
    }

    return changedFiles;
  }

  private async extractParentComponentsContext(repoPath: string, changedFiles: FileContext[]): Promise<FileContext[]> {
    const parentComponents: FileContext[] = [];

    try {
      const changedFilePaths = changedFiles.map(f => f.filePath);
      const parentFilePaths = await this.analyzer.findParentComponents(repoPath, changedFilePaths);

      for (const parentPath of parentFilePaths.slice(0, this.options.maxParentFiles)) {
        try {
          const fileContext = await this.analyzer.createFileContext(repoPath, parentPath, 'parent');
          if (fileContext) {
            parentComponents.push(fileContext);
          }
        } catch (error) {
          console.debug(`[ContextExtractor] Error processing parent file ${parentPath}:`, error);
        }
      }
    } catch (error) {
      console.debug('[ContextExtractor] Error finding parent components:', error);
    }

    return parentComponents;
  }

  private async extractRoutingFilesContext(repoPath: string): Promise<FileContext[]> {
    const routingFiles: FileContext[] = [];

    try {
      const routingFilePaths = await this.analyzer.findRoutingFiles(repoPath);

      for (const routingPath of routingFilePaths.slice(0, this.options.maxRoutingFiles)) {
        try {
          const fileContext = await this.analyzer.createFileContext(repoPath, routingPath, 'router');
          if (fileContext) {
            routingFiles.push(fileContext);
          }
        } catch (error) {
          console.debug(`[ContextExtractor] Error processing routing file ${routingPath}:`, error);
        }
      }
    } catch (error) {
      console.debug('[ContextExtractor] Error finding routing files:', error);
    }

    return routingFiles;
  }

  private async extractConfigFilesContext(repoPath: string): Promise<FileContext[]> {
    const configFiles: FileContext[] = [];

    try {
      const configFilePaths = await this.analyzer.findConfigFiles(repoPath);

      for (const configPath of configFilePaths.slice(0, this.options.maxConfigFiles)) {
        try {
          const fileContext = await this.analyzer.createFileContext(repoPath, configPath, 'config');
          if (fileContext) {
            configFiles.push(fileContext);
          }
        } catch (error) {
          console.debug(`[ContextExtractor] Error processing config file ${configPath}:`, error);
        }
      }
    } catch (error) {
      console.debug('[ContextExtractor] Error finding config files:', error);
    }

    return configFiles;
  }

  /**
   * Extract minimal context for performance-critical scenarios
   */
  async extractMinimalContext(
    repoPath: string,
    repoName: string,
    workingChanges: WorkingChanges,
    branchInfo: { branch: string; commitHash: string }
  ): Promise<CodebaseContext | null> {
    try {
      console.log('[ContextExtractor] Extracting minimal context for', repoName);
      
      // Only extract changed files for minimal context
      const changedFiles = await this.extractChangedFilesContext(repoPath, workingChanges);
      
      if (changedFiles.length === 0) {
        return null;
      }

      // Basic analysis
      const totalFiles = changedFiles.length;
      const totalSize = changedFiles.reduce((sum, file) => sum + file.sizeBytes, 0);
      const architecturalPatterns = this.analyzer.analyzeArchitecturalPatterns(changedFiles);
      const focusAreas = this.analyzer.suggestFocusAreas(changedFiles, architecturalPatterns);

      return {
        commitHash: branchInfo.commitHash,
        commitMessage: `Minimal context for working changes on ${branchInfo.branch}`,
        timestamp: new Date().toISOString(),
        repositoryName: repoName,
        changedFiles,
        parentComponents: [],
        routingFiles: [],
        configFiles: [],
        componentHierarchy: [],
        routeMapping: [],
        totalContextFiles: totalFiles,
        totalContextSizeBytes: totalSize,
        analysisTimestamp: new Date().toISOString(),
        architecturalPatterns,
        userJourneyMapping: [],
        focusAreas
      };

    } catch (error) {
      console.error('[ContextExtractor] Error extracting minimal context:', error);
      return null;
    }
  }

  /**
   * Get context extraction statistics
   */
  getExtractionStats(context: CodebaseContext | null): {
    filesAnalyzed: number;
    totalSizeKB: number;
    architecturalPatterns: number;
    focusAreas: number;
  } {
    if (!context) {
      return { filesAnalyzed: 0, totalSizeKB: 0, architecturalPatterns: 0, focusAreas: 0 };
    }

    return {
      filesAnalyzed: context.totalContextFiles,
      totalSizeKB: Math.round(context.totalContextSizeBytes / 1024),
      architecturalPatterns: context.architecturalPatterns.length,
      focusAreas: context.focusAreas.length
    };
  }
}