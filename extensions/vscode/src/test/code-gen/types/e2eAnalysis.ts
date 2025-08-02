export interface E2eCase {
  name: string;
  description: string;
}

export interface E2eFile {
  e2eFile: string;
  e2eName: string;
  description: string;
  componentsCovered: string[];
  pagesCovered: string[];
  e2eCases: E2eCase[];
  lastModified: string;
  status: 'passing' | 'failing' | 'pending';
  failureReason?: string;
}

export interface E2eFrameworkInfo {
  primary: string;
  version?: string;
  configFile?: string;
  e2eDirectory: string;
}

export interface CoverageSummary {
  totalE2eFiles: number;
  passingE2eFiles: number;
  failingE2eFiles: number;
  totalComponentsCovered: number;
  totalPagesCovered: number;
  coverageAreas: string[];
}

export interface UncoveredArea {
  component: string;
  pages: string[];
  reason: string;
}

export interface E2ePatterns {
  namingConvention: string;
  commonSelectors: Record<string, string>;
  pageObjectModel: boolean;
  dataStrategy: string;
}

export interface E2eSnapshot {
  repository: {
    name: string;
    path: string;
    branch: string;
    commitHash: string;
    lastUpdated: string;
  };
  e2eFramework: E2eFrameworkInfo;
  currentE2eFiles: E2eFile[];
  coverageSummary: CoverageSummary;
  uncoveredAreas: UncoveredArea[];
  e2ePatterns: E2ePatterns;
  dependencies: Record<string, string[]>;
}

export interface FrameworkPattern {
  files: string[];
  imports: string[];
  extensions: string[];
}

export interface FrameworkPatterns {
  playwright: FrameworkPattern;
  cypress: FrameworkPattern;
  jest: FrameworkPattern;
}