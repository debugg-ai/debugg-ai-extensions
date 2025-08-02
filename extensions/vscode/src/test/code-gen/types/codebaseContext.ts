export interface FileContext {
  filePath: string;
  fileType: 'changed' | 'parent' | 'router' | 'config';
  content: string;
  sizeBytes: number;
  language: string;
  purpose: string;
  exports: string[];
  imports: string[];
  routes: string[];
}

export interface ComponentHierarchy {
  componentName: string;
  filePath: string;
  parentComponents: string[];
  childComponents: string[];
  pagesUsedIn: string[];
}

export interface RouteMapping {
  routePath: string;
  component: string;
  filePath: string;
  routeType: 'page' | 'api' | 'middleware';
  params: string[];
  guards: string[];
}

export interface CodebaseContext {
  commitHash: string;
  commitMessage: string;
  timestamp: string;
  repositoryName: string;
  
  // Core context data
  changedFiles: FileContext[];
  parentComponents: FileContext[];
  routingFiles: FileContext[];
  configFiles: FileContext[];
  
  // Structural analysis
  componentHierarchy: ComponentHierarchy[];
  routeMapping: RouteMapping[];
  
  // Analysis metadata
  totalContextFiles: number;
  totalContextSizeBytes: number;
  analysisTimestamp: string;
  
  // Contextual insights for AI
  architecturalPatterns: string[];
  userJourneyMapping: string[];
  focusAreas: string[];
}

export interface ContextExtractionOptions {
  maxFileSize: number;
  maxParentFiles: number;
  maxRoutingFiles: number;
  maxConfigFiles: number;
  timeoutMs: number;
}