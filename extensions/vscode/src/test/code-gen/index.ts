// Main exports for e2e analysis functionality
export { E2eFileAnalyzer } from './analyzers/E2eFileAnalyzer';
export { E2eFrameworkDetector } from './analyzers/E2eFrameworkDetector';
export * from './types/e2eAnalysis';

// Codebase context analysis functionality
export { CodebaseAnalyzer } from './analyzers/CodebaseAnalyzer';
export { ContextExtractor } from './analyzers/ContextExtractor';
export * from './types/codebaseContext';

// Re-export CommitTester for backward compatibility
export { CommitTester } from './commitTester';