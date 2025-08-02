import * as path from 'path';
import { IDE } from 'core/index.js';
import { FileContext, ComponentHierarchy, RouteMapping, ContextExtractionOptions } from '../types/codebaseContext';

export class CodebaseAnalyzer {
  private ide: IDE;
  private options: ContextExtractionOptions;

  private filePriorities: Record<string, number> = {
    'tsx': 10, 'jsx': 10, 'ts': 9, 'js': 9,
    'vue': 10, 'svelte': 10,
    'py': 8, 'rb': 7, 'java': 6, 'cs': 6,
    'html': 5, 'css': 4, 'scss': 4, 'less': 4,
    'json': 3, 'yaml': 3, 'yml': 3,
    'md': 2, 'txt': 1
  };

  private routingPatterns: string[] = [
    'router', 'routes', 'routing', 'app', 'main', 'index',
    'navigation', 'menu', 'layout', '_app', '_document'
  ];

  private configPatterns: string[] = [
    'package.json', 'tsconfig.json', 'webpack.config', 'vite.config',
    'next.config', 'tailwind.config', '.env'
  ];

  constructor(ide: IDE, options: Partial<ContextExtractionOptions> = {}) {
    this.ide = ide;
    this.options = {
      maxFileSize: 100000,
      maxParentFiles: 5,
      maxRoutingFiles: 3,
      maxConfigFiles: 2,
      timeoutMs: 10000,
      ...options
    };
  }

  getFileLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase().substring(1);
    
    const languageMap: Record<string, string> = {
      'ts': 'typescript', 'tsx': 'typescript-react',
      'js': 'javascript', 'jsx': 'javascript-react',
      'py': 'python', 'rb': 'ruby', 'java': 'java',
      'cs': 'csharp', 'cpp': 'cpp', 'c': 'c',
      'vue': 'vue', 'svelte': 'svelte',
      'html': 'html', 'css': 'css', 'scss': 'scss',
      'json': 'json', 'yaml': 'yaml', 'yml': 'yaml',
      'md': 'markdown', 'txt': 'text'
    };
    
    return languageMap[ext] || 'unknown';
  }

  extractExports(content: string, language: string): string[] {
    const exports: string[] = [];
    
    if (language.includes('typescript') || language.includes('javascript')) {
      const patterns = [
        /export\s+(?:default\s+)?(?:function|class|const|let|var)\s+(\w+)/g,
        /export\s+\{\s*([^}]+)\s*\}/g,
        /export\s+default\s+(\w+)/g
      ];
      
      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          if (match[1]) {
            if (match[1].includes(',')) {
              exports.push(...match[1].split(',').map(name => name.trim()));
            } else {
              exports.push(match[1]);
            }
          }
        }
      }
    } else if (language === 'python') {
      const patterns = [
        /class\s+(\w+)/g,
        /def\s+(\w+)/g
      ];
      
      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          exports.push(match[1]);
        }
      }
    }
    
    return Array.from(new Set(exports));
  }

  extractImports(content: string, language: string): string[] {
    const imports: string[] = [];
    
    if (language.includes('typescript') || language.includes('javascript')) {
      const patterns = [
        /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g,
        /import\s+['"]([^'"]+)['"]/g,
        /require\(['"]([^'"]+)['"]\)/g
      ];
      
      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          imports.push(match[1]);
        }
      }
    } else if (language === 'python') {
      const patterns = [
        /from\s+(\S+)\s+import/g,
        /import\s+(\S+)/g
      ];
      
      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          imports.push(match[1]);
        }
      }
    }
    
    return Array.from(new Set(imports));
  }

  extractRoutes(content: string, language: string): string[] {
    const routes: string[] = [];
    
    if (language.includes('typescript') || language.includes('javascript')) {
      const patterns = [
        /path:\s*['"]([/\w\-:]+)['"]/g,
        /route\s*:\s*['"]([/\w\-:]+)['"]/g,
        /<Route\s+path=['"]([^'"]+)['"]/g,
        /router\.(?:get|post|put|delete)\(['"]([^'"]+)['"]/g,
        /app\.(?:get|post|put|delete)\(['"]([^'"]+)['"]/g
      ];
      
      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          const route = match[1];
          if (route.startsWith('/') && route.length > 1) {
            routes.push(route);
          }
        }
      }
    }
    
    return Array.from(new Set(routes));
  }

  determineFilePurpose(filePath: string, content: string, language: string): string {
    const pathLower = filePath.toLowerCase();
    const contentSample = content.substring(0, 1000).toLowerCase();
    
    if (pathLower.includes('test') || pathLower.includes('spec')) {
      return 'e2e';
    } else if (this.routingPatterns.some(pattern => pathLower.includes(pattern))) {
      return 'routing';
    } else if (pathLower.includes('component')) {
      return 'component';
    } else if (pathLower.includes('page') || pathLower.includes('view')) {
      return 'page';
    } else if (pathLower.includes('service') || pathLower.includes('api')) {
      return 'service';
    } else if (pathLower.includes('util') || pathLower.includes('helper')) {
      return 'utility';
    } else if (this.configPatterns.some(pattern => pathLower.includes(pattern))) {
      return 'configuration';
    } else if (pathLower.includes('layout')) {
      return 'layout';
    } else if (pathLower.includes('hook')) {
      return 'hook';
    } else if (pathLower.includes('context') || pathLower.includes('provider')) {
      return 'context';
    } else if (pathLower.includes('store') || pathLower.includes('state')) {
      return 'state-management';
    } else if (contentSample.includes('react') || contentSample.includes('component')) {
      return 'react-component';
    } else if (contentSample.includes('vue')) {
      return 'vue-component';
    } else {
      return 'module';
    }
  }

  async findParentComponents(repoPath: string, changedFiles: string[]): Promise<string[]> {
    const parentFiles = new Set<string>();
    const maxFiles = Math.min(changedFiles.length, 10); // Limit scope
    
    for (let i = 0; i < maxFiles; i++) {
      const changedFile = changedFiles[i];
      const fileName = path.basename(changedFile, path.extname(changedFile));
      
      try {
        // Search for imports with timeout
        const [output] = await Promise.race([
          this.ide.subprocess(
            `grep -r -l --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --max-count=10 "from.*${fileName}" . || true`,
            repoPath
          ),
          new Promise<[string, string]>((_, reject) => 
            setTimeout(() => reject(new Error('timeout')), this.options.timeoutMs)
          )
        ]);
        
        if (output) {
          const lines = output.trim().split('\n').filter(line => line && !line.includes(changedFile));
          for (const line of lines.slice(0, this.options.maxParentFiles)) {
            parentFiles.add(line.replace(repoPath + '/', '').replace('./', ''));
          }
        }
      } catch (error) {
        // Continue on error or timeout
        console.debug(`Error finding parents for ${changedFile}:`, error);
      }
    }
    
    return Array.from(parentFiles).slice(0, this.options.maxParentFiles);
  }

  async findRoutingFiles(repoPath: string): Promise<string[]> {
    const routingFiles: string[] = [];
    
    try {
      // Use a single find command with limited results
      const patterns = this.routingPatterns.slice(0, 5).map(p => `-name "*${p}*"`).join(' -o ');
      const [output] = await Promise.race([
        this.ide.subprocess(
          `find . -type f \\( ${patterns} \\) -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | head -${this.options.maxRoutingFiles}`,
          repoPath
        ),
        new Promise<[string, string]>((_, reject) => 
          setTimeout(() => reject(new Error('timeout')), this.options.timeoutMs)
        )
      ]);
      
      if (output) {
        const lines = output.trim().split('\n').filter(line => 
          line && !line.includes('node_modules') && !line.includes('.git')
        );
        routingFiles.push(...lines.slice(0, this.options.maxRoutingFiles));
      }
    } catch (error) {
      console.debug('Error finding routing files:', error);
    }
    
    return routingFiles.map(f => f.replace('./', ''));
  }

  async findConfigFiles(repoPath: string): Promise<string[]> {
    const configFiles: string[] = [];
    
    try {
      const patterns = this.configPatterns.slice(0, 4).map(p => `-name "${p}*"`).join(' -o ');
      const [output] = await Promise.race([
        this.ide.subprocess(
          `find . -maxdepth 2 -type f \\( ${patterns} \\) | head -${this.options.maxConfigFiles}`,
          repoPath
        ),
        new Promise<[string, string]>((_, reject) => 
          setTimeout(() => reject(new Error('timeout')), this.options.timeoutMs)
        )
      ]);
      
      if (output) {
        const lines = output.trim().split('\n').filter(line => 
          line && !line.includes('node_modules') && !line.includes('.git')
        );
        configFiles.push(...lines.slice(0, this.options.maxConfigFiles));
      }
    } catch (error) {
      console.debug('Error finding config files:', error);
    }
    
    return configFiles.map(f => f.replace('./', ''));
  }

  async readFileContent(repoPath: string, filePath: string): Promise<{ content: string; sizeBytes: number }> {
    try {
      const fullPath = path.join(repoPath, filePath);
      const content = await this.ide.readFile(fullPath);
      const sizeBytes = Buffer.byteLength(content, 'utf8');
      
      if (sizeBytes > this.options.maxFileSize) {
        return { content: '', sizeBytes: 0 };
      }
      
      return { content, sizeBytes };
    } catch (error) {
      console.debug(`Error reading file ${filePath}:`, error);
      return { content: '', sizeBytes: 0 };
    }
  }

  async createFileContext(repoPath: string, filePath: string, fileType: FileContext['fileType']): Promise<FileContext | null> {
    const { content, sizeBytes } = await this.readFileContent(repoPath, filePath);
    
    if (!content) {
      return null;
    }
    
    const language = this.getFileLanguage(filePath);
    const purpose = this.determineFilePurpose(filePath, content, language);
    const exports = this.extractExports(content, language);
    const imports = this.extractImports(content, language);
    const routes = this.extractRoutes(content, language);
    
    return {
      filePath: filePath.replace(/^\.\//, ''),
      fileType,
      content,
      sizeBytes,
      language,
      purpose,
      exports,
      imports,
      routes
    };
  }

  analyzeArchitecturalPatterns(allFiles: FileContext[]): string[] {
    const patterns: string[] = [];
    
    // Framework detection
    const frameworks = new Set<string>();
    for (const file of allFiles) {
      for (const imp of file.imports) {
        const impLower = imp.toLowerCase();
        if (impLower.includes('react')) frameworks.add('React');
        else if (impLower.includes('vue')) frameworks.add('Vue');
        else if (impLower.includes('angular')) frameworks.add('Angular');
        else if (impLower.includes('svelte')) frameworks.add('Svelte');
        else if (impLower.includes('next')) frameworks.add('Next.js');
        else if (impLower.includes('nuxt')) frameworks.add('Nuxt.js');
      }
    }
    
    if (frameworks.size > 0) {
      patterns.push(`Frontend framework: ${Array.from(frameworks).join(', ')}`);
    }
    
    // Architecture patterns
    const hasComponents = allFiles.some(f => f.purpose.includes('component'));
    const hasServices = allFiles.some(f => f.purpose.includes('service'));
    const hasStateManagement = allFiles.some(f => f.purpose.includes('state'));
    const hasRouting = allFiles.some(f => f.purpose.includes('routing'));
    
    if (hasComponents && hasServices) patterns.push('Component-Service architecture');
    if (hasStateManagement) patterns.push('State management pattern');
    if (hasRouting) patterns.push('Client-side routing');
    
    return patterns;
  }

  mapUserJourneys(routingFiles: FileContext[], changedFiles: FileContext[]): string[] {
    const journeys: string[] = [];
    
    const allRoutes = [...routingFiles, ...changedFiles].flatMap(f => f.routes);
    
    const authRoutes = allRoutes.filter(r => /login|register|auth|signin|signup/i.test(r));
    const adminRoutes = allRoutes.filter(r => /admin|dashboard|manage/i.test(r));
    const userRoutes = allRoutes.filter(r => /profile|account|user|settings/i.test(r));
    
    if (authRoutes.length > 0) {
      journeys.push(`Authentication flow: ${authRoutes.slice(0, 3).join(' -> ')}`);
    }
    if (adminRoutes.length > 0) {
      journeys.push(`Admin workflow: ${adminRoutes.slice(0, 3).join(' -> ')}`);
    }
    if (userRoutes.length > 0) {
      journeys.push(`User management: ${userRoutes.slice(0, 3).join(' -> ')}`);
    }
    
    return journeys;
  }

  suggestFocusAreas(changedFiles: FileContext[], architecturalPatterns: string[]): string[] {
    const focusAreas: string[] = [];
    
    const changedPurposes = changedFiles.map(f => f.purpose);
    
    if (changedPurposes.some(p => p.includes('component'))) {
      focusAreas.push('Component rendering and interaction');
    }
    if (changedPurposes.some(p => p.includes('service'))) {
      focusAreas.push('API integration and data flow');
    }
    if (changedPurposes.some(p => p.includes('routing'))) {
      focusAreas.push('Navigation and URL state');
    }
    if (changedPurposes.some(p => p.includes('state'))) {
      focusAreas.push('State management and persistence');
    }
    if (changedFiles.some(f => /auth/i.test(f.filePath))) {
      focusAreas.push('Authentication and authorization');
    }
    
    // Framework-specific suggestions
    const patternsStr = architecturalPatterns.join(' ');
    if (patternsStr.includes('React')) {
      focusAreas.push('React component lifecycle and hooks');
    }
    if (patternsStr.includes('Vue')) {
      focusAreas.push('Vue component reactivity');
    }
    
    return focusAreas;
  }
}