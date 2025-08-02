import * as path from 'path';
import { IDE } from 'core/index.js';
import { E2eFrameworkInfo, FrameworkPatterns } from '../types/e2eAnalysis';

export class E2eFrameworkDetector {
  private ide: IDE;
  private frameworkPatterns: FrameworkPatterns;

  constructor(ide: IDE) {
    this.ide = ide;
    this.frameworkPatterns = {
      playwright: {
        files: ['playwright.config.js', 'playwright.config.ts'],
        imports: ['@playwright/test', 'playwright'],
        extensions: ['.spec.ts', '.spec.js', '.test.ts', '.test.js']
      },
      cypress: {
        files: ['cypress.config.js', 'cypress.config.ts', 'cypress.json'],
        imports: ['cypress'],
        extensions: ['.cy.ts', '.cy.js', '.spec.ts', '.spec.js']
      },
      jest: {
        files: ['jest.config.js', 'jest.config.ts', 'package.json'],
        imports: ['@testing-library', 'jest'],
        extensions: ['.test.ts', '.test.js', '.spec.ts', '.spec.js']
      }
    };
  }

  async detectE2eFramework(repoPath: string): Promise<E2eFrameworkInfo> {
    try {
      // Get all files in the repository
      const [filesOutput] = await this.ide.subprocess(
        'find . -type f -name "*.js" -o -name "*.ts" -o -name "*.json" | head -100',
        repoPath
      );
      
      const files = filesOutput.trim().split('\n').filter(f => f.length > 0);

      // Check for framework-specific config files
      for (const [framework, patterns] of Object.entries(this.frameworkPatterns)) {
        for (const configFile of patterns.files) {
          const found = files.find(f => f.includes(configFile));
          if (found) {
            const e2eDir = await this.findE2eDirectory(repoPath, patterns.extensions);
            const version = await this.extractFrameworkVersion(repoPath, framework);
            return {
              primary: framework,
              version,
              configFile: found.replace('./', ''),
              e2eDirectory: e2eDir
            };
          }
        }
      }

      // Fallback detection by file extensions
      const e2eFiles = files.filter(f => 
        ['.spec.ts', '.spec.js', '.test.ts', '.test.js', '.cy.js', '.cy.ts'].some(ext => f.endsWith(ext))
      );

      if (e2eFiles.length > 0) {
        if (e2eFiles.some(f => f.includes('.cy.'))) {
          return {
            primary: 'cypress',
            e2eDirectory: await this.findE2eDirectory(repoPath, ['.cy.js', '.cy.ts'])
          };
        } else if (e2eFiles.some(f => f.includes('.spec.'))) {
          return {
            primary: 'playwright',
            e2eDirectory: await this.findE2eDirectory(repoPath, ['.spec.ts', '.spec.js'])
          };
        }
      }

      return {
        primary: 'unknown',
        e2eDirectory: 'e2e'
      };

    } catch (error) {
      console.debug('Error detecting e2e framework:', error);
      return {
        primary: 'unknown',
        e2eDirectory: 'e2e'
      };
    }
  }

  private async findE2eDirectory(repoPath: string, extensions: string[]): Promise<string> {
    try {
      const extPattern = extensions.map(ext => `*${ext}`).join(' -o -name ');
      const [e2eFilesOutput] = await this.ide.subprocess(
        `find . -type f \\( -name ${extPattern} \\) | head -20`,
        repoPath
      );

      const e2eFiles = e2eFilesOutput.trim().split('\n').filter(f => f.length > 0);
      if (e2eFiles.length === 0) {
        return 'e2e';
      }

      // Find most common directory
      const dirCounts: Record<string, number> = {};
      for (const file of e2eFiles) {
        const dir = path.dirname(file).replace('./', '');
        dirCounts[dir] = (dirCounts[dir] || 0) + 1;
      }

      const mostCommon = Object.entries(dirCounts)
        .sort(([,a], [,b]) => b - a)[0]?.[0];

      return mostCommon || 'e2e';
    } catch (error) {
      return 'e2e';
    }
  }

  private async extractFrameworkVersion(repoPath: string, framework: string): Promise<string | undefined> {
    try {
      const packageJsonPath = path.join(repoPath, 'package.json');
      const packageContent = await this.ide.readFile(packageJsonPath);
      const packageData = JSON.parse(packageContent);
      
      const deps = { ...packageData.dependencies, ...packageData.devDependencies };
      
      const frameworkKeys: Record<string, string[]> = {
        playwright: ['@playwright/test', 'playwright'],
        cypress: ['cypress'],
        jest: ['jest', '@testing-library/jest-dom']
      };

      const keys = frameworkKeys[framework] || [];
      for (const key of keys) {
        if (deps[key]) {
          return deps[key].replace(/^[\^~]/, '');
        }
      }
    } catch (error) {
      // Ignore errors reading package.json
    }
    return undefined;
  }
}