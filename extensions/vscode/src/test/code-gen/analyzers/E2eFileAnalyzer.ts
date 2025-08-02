import { IDE } from 'core/index.js';
import * as path from 'path';
import { CoverageSummary, E2eCase, E2eFile, E2ePatterns, E2eSnapshot } from '../types/e2eAnalysis';
import { E2eFrameworkDetector } from './E2eFrameworkDetector';

export class E2eFileAnalyzer {
  private ide: IDE;
  private frameworkDetector: E2eFrameworkDetector;
  
  private e2eDescribePatterns = [
    /describe\s*\(\s*['"`]([^'"`]+)['"`]/g,
    /test\s*\(\s*['"`]([^'"`]+)['"`]/g,
    /it\s*\(\s*['"`]([^'"`]+)['"`]/g
  ];
  
  private componentPatterns = [
    /getByTestId\s*\(\s*['"`]([^'"`]+)['"`]/g,
    /locator\s*\(\s*['"`]([^'"`]+)['"`]/g,
    /cy\.get\s*\(\s*['"`]([^'"`]+)['"`]/g,
    /querySelector\s*\(\s*['"`]([^'"`]+)['"`]/g
  ];
  
  private pagePatterns = [
    /goto\s*\(\s*['"`]([^'"`]+)['"`]/g,
    /visit\s*\(\s*['"`]([^'"`]+)['"`]/g,
    /navigate\s*\(\s*['"`]([^'"`]+)['"`]/g,
    /page\.goto\s*\(\s*['"`]([^'"`]+)['"`]/g
  ];

  constructor(ide: IDE) {
    this.ide = ide;
    this.frameworkDetector = new E2eFrameworkDetector(ide);
  }

  async detectE2eFramework(repoPath: string) {
    return this.frameworkDetector.detectE2eFramework(repoPath);
  }

  async extractE2eFiles(repoPath: string, limitFiles: number = 5): Promise<E2eFile[]> {
    try {
      // Find e2e files
      const [e2eFilesOutput] = await this.ide.subprocess(
        'find . -type f \\( -name "*.spec.ts" -o -name "*.spec.js" -o -name "*.test.ts" -o -name "*.test.js" -o -name "*.cy.ts" -o -name "*.cy.js" \\) | head -' + limitFiles,
        repoPath
      );

      const e2eFilePaths = e2eFilesOutput.trim().split('\n').filter(f => f.length > 0);
      const extractedE2eFiles: E2eFile[] = [];

      for (const e2eFilePath of e2eFilePaths) {
        try {
          const e2eInfo = await this.analyzeE2eFile(repoPath, e2eFilePath);
          if (e2eInfo) {
            extractedE2eFiles.push(e2eInfo);
          }
        } catch (error) {
          console.debug(`Error analyzing e2e file ${e2eFilePath}:`, error);
        }
      }

      return extractedE2eFiles;
    } catch (error) {
      console.debug('Error extracting e2e files:', error);
      return [];
    }
  }

  private async analyzeE2eFile(repoPath: string, e2eFilePath: string): Promise<E2eFile | null> {
    try {
      const fullPath = path.join(repoPath, e2eFilePath.replace('./', ''));
      const content = await this.ide.readFile(fullPath);

      const e2eName = this.extractE2eName(e2eFilePath, content);
      const description = this.extractDescription(content);
      const components = this.extractComponents(content);
      const pages = this.extractPages(content);
      const e2eCases = this.extractE2eCases(content);
      const lastModified = await this.getFileModificationDate(repoPath, e2eFilePath);

      return {
        e2eFile: e2eFilePath.replace('./', ''),
        e2eName,
        description,
        componentsCovered: components,
        pagesCovered: pages,
        e2eCases,
        lastModified,
        status: 'passing' // Default status, could be enhanced
      };
    } catch (error) {
      console.debug(`Error analyzing e2e file ${e2eFilePath}:`, error);
      return null;
    }
  }

  private extractE2eName(filePath: string, content: string): string {
    // Try to find main describe block
    for (const pattern of this.e2eDescribePatterns) {
      pattern.lastIndex = 0; // Reset regex
      const matches = [...content.matchAll(pattern)];
      const describeMatches = matches.filter(m => m[0].includes('describe'));
      if (describeMatches.length > 0) {
        return describeMatches[0][1];
      }
    }

    // Fallback to file name
    return path.basename(filePath, path.extname(filePath))
      .replace(/\.(spec|test)$/, '')
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  private extractDescription(content: string): string {
    // Look for comment blocks
    const commentPattern = /\/\*\*(.*?)\*\//s;
    const commentMatch = content.match(commentPattern);
    if (commentMatch) {
      const desc = commentMatch[1].replace(/\*/g, '').trim();
      if (desc.length > 10) {
        return desc.substring(0, 200);
      }
    }

    // Look for first describe block
    const describePattern = /describe\s*\(\s*['"`]([^'"`]+)['"`]/;
    const describeMatch = content.match(describePattern);
    if (describeMatch) {
      return `Tests ${describeMatch[1].toLowerCase()}`;
    }

    return 'End-to-end suite';
  }

  private extractComponents(content: string): string[] {
    const components = new Set<string>();

    for (const pattern of this.componentPatterns) {
      pattern.lastIndex = 0; // Reset regex
      const matches = [...content.matchAll(pattern)];
      for (const match of matches) {
        let component = match[1];
        
        // Clean up component names
        if (component.startsWith('[data-testid=')) {
          component = component.replace(/^\[data-testid=(['"`]?)([^'"`\]]+)\1\]$/, '$2');
        }
        
        if (component.includes('-') || component.includes('_')) {
          components.add(this.cleanComponentName(component));
        }
      }
    }

    // Look for React component patterns
    const reactPattern = /<(\w+)/g;
    const reactMatches = [...content.matchAll(reactPattern)];
    for (const match of reactMatches) {
      if (match[1][0] === match[1][0].toUpperCase()) { // React components start with uppercase
        components.add(match[1]);
      }
    }

    return Array.from(components).slice(0, 10); // Limit to 10 components
  }

  private cleanComponentName(name: string): string {
    // Convert kebab-case or snake_case to PascalCase
    const parts = name.split(/[-_]/);
    return parts.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
  }

  private extractPages(content: string): string[] {
    const pages = new Set<string>();

    for (const pattern of this.pagePatterns) {
      pattern.lastIndex = 0; // Reset regex
      const matches = [...content.matchAll(pattern)];
      for (const match of matches) {
        const url = match[1];
        if (url.startsWith('/') || url.startsWith('http')) {
          pages.add(url);
        }
      }
    }

    // Look for relative paths
    const pathPattern = /['"`](\/[^'"`\s]+)['"`]/g;
    const pathMatches = [...content.matchAll(pathPattern)];
    for (const match of pathMatches) {
      const url = match[1];
      if (url.length > 1 && !url.endsWith('.js') && !url.endsWith('.css')) {
        pages.add(url);
      }
    }

    return Array.from(pages).slice(0, 5); // Limit to 5 pages
  }

  private extractE2eCases(content: string): E2eCase[] {
    const e2eCases: E2eCase[] = [];

    // Find test/it blocks
    const e2ePattern = /(?:test|it)\s*\(\s*['"`]([^'"`]+)['"`]/g;
    const matches = [...content.matchAll(e2ePattern)];

    for (const match of matches.slice(0, 10)) { // Limit to 10 e2e cases
      e2eCases.push({
        name: match[1],
        description: `E2E case: ${match[1].toLowerCase()}`
      });
    }

    return e2eCases;
  }

  private async getFileModificationDate(repoPath: string, filePath: string): Promise<string> {
    try {
      const [dateOutput] = await this.ide.subprocess(
        `git log -1 --format=%ai -- "${filePath}"`,
        repoPath
      );

      if (dateOutput.trim()) {
        try {
          const date = new Date(dateOutput.trim().split(' ')[0]);
          return date.toISOString();
        } catch {
          return new Date().toISOString();
        }
      }
    } catch (error) {
      // Ignore git log errors
    }
    return new Date().toISOString();
  }

  async createE2eSnapshot(repoPath: string, repoName: string, branchInfo: {branch: string, commitHash: string}): Promise<E2eSnapshot | null> {
    try {
      // Detect e2e framework
      const frameworkInfo = await this.frameworkDetector.detectE2eFramework(repoPath);
      
      // Extract e2e files
      const e2eFiles = await this.extractE2eFiles(repoPath);
      
      if (e2eFiles.length === 0) {
        return null;
      }

      // Create repository info
      const repoInfo = {
        name: repoName,
        path: repoPath,
        branch: branchInfo.branch,
        commitHash: branchInfo.commitHash,
        lastUpdated: new Date().toISOString()
      };

      // Calculate coverage summary
      const coverageSummary: CoverageSummary = {
        totalE2eFiles: e2eFiles.length,
        passingE2eFiles: e2eFiles.filter(t => t.status === 'passing').length,
        failingE2eFiles: e2eFiles.filter(t => t.status === 'failing').length,
        totalComponentsCovered: new Set(e2eFiles.flatMap(t => t.componentsCovered)).size,
        totalPagesCovered: new Set(e2eFiles.flatMap(t => t.pagesCovered)).size,
        coverageAreas: this.extractCoverageAreas(e2eFiles)
      };

      // Create e2e patterns
      const e2ePatterns: E2ePatterns = {
        namingConvention: this.detectNamingConvention(e2eFiles),
        commonSelectors: {
          buttons: "[data-testid*='button']",
          forms: "[data-testid*='form']",
          inputs: "[data-testid*='input']",
          modals: "[data-testid*='modal']"
        },
        pageObjectModel: await this.detectPageObjectPattern(repoPath),
        dataStrategy: 'fixtures'
      };

      // Dependencies would need package.json analysis
      const dependencies = {
        e2e_utilities: frameworkInfo.primary !== 'unknown' ? [`@${frameworkInfo.primary}/test`] : [],
        assertions: ['expect']
      };

      return {
        repository: repoInfo,
        e2eFramework: frameworkInfo,
        currentE2eFiles: e2eFiles,
        coverageSummary,
        uncoveredAreas: [], // Could be enhanced
        e2ePatterns,
        dependencies
      };
    } catch (error) {
      console.debug('Error creating e2e snapshot:', error);
      return null;
    }
  }

  private extractCoverageAreas(e2eFiles: E2eFile[]): string[] {
    const areas = new Set<string>();
    
    for (const e2eFile of e2eFiles) {
      const pathParts = e2eFile.e2eFile.toLowerCase().split('/');
      for (const part of pathParts) {
        if (['auth', 'authentication', 'login'].includes(part)) {
          areas.add('Authentication');
        } else if (['nav', 'navigation', 'header', 'menu'].includes(part)) {
          areas.add('Navigation');
        } else if (['form', 'forms', 'contact'].includes(part)) {
          areas.add('Forms');
        } else if (['user', 'profile', 'account'].includes(part)) {
          areas.add('User Management');
        } else if (['shop', 'cart', 'checkout', 'payment'].includes(part)) {
          areas.add('E-commerce');
        }
      }
    }
    
    return Array.from(areas).sort();
  }

  private detectNamingConvention(e2eFiles: E2eFile[]): string {
    if (e2eFiles.length === 0) return 'unknown';

    const kebabCase = e2eFiles.filter(f => f.e2eFile.includes('-')).length;
    const snakeCase = e2eFiles.filter(f => f.e2eFile.includes('_')).length;
    const camelCase = e2eFiles.filter(f => /[A-Z]/.test(path.basename(f.e2eFile))).length;

    if (kebabCase > snakeCase && kebabCase > camelCase) {
      return 'kebab-case.spec.ts';
    } else if (snakeCase > camelCase) {
      return 'snake_case.spec.ts';
    } else {
      return 'descriptive.spec.ts';
    }
  }

  private async detectPageObjectPattern(repoPath: string): Promise<boolean> {
    try {
      const [filesOutput] = await this.ide.subprocess(
        'find . -type f -name "*.js" -o -name "*.ts" | xargs grep -l "page.*object\\|pageobject" -i 2>/dev/null || true',
        repoPath
      );
      return filesOutput.trim().length > 0;
    } catch {
      return false;
    }
  }
}