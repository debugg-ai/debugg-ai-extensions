
export interface PaginatedResponse<T> {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
}

export interface Issue {
    uuid: string;
    project: number;
    title?: string;
    message?: string;
    environment: string;
    status: "open" | "ongoing" | "resolved" | "archived";
    level: Level;
    priority: "low" | "medium" | "high" | "alert";
    lineNumber: number;
    columnNumber: number;
    eventsCount: number;
    filePath: string;
    firstSeen: string;
    lastSeen: string;
    tags?: Record<string, any>;
    participants: number[];
    timestamp: string;
    lastMod: string;
    overview: LogOverview;
    solution?: IssueSolution;
    suggestions?: IssueSuggestion[];
}

/**
 * Snippet update for a file change
 */
export interface SnippetUpdate {
    startLine: number; // 1-indexed
    endLine: number; // 1-indexed
    newContent: string;
    prevContent: string;
}

/**
 * File change for an issue solution
 */
export interface FileChange {
    filePath: string;
    snippetsToUpdate: SnippetUpdate[];
}

/**
 * Fix for an issue
 */
export interface IssueSolution {
    uuid: string;
    changes: FileChange[];
}
/**
 * Issue suggestion
 */
export interface IssueSuggestion {
    filePath: string;
    errorCount: number;
    lineNumber: string;
    columnNumber: string;
    message: string;
}

/**
 * Paginated response for issues
 */
export interface PaginatedIssueResponse extends PaginatedResponse<Issue> {
}

/**
 * Paginated response for issue suggestions
 */
export interface PaginatedIssueSuggestionResponse extends PaginatedResponse<IssueSuggestion> {
}


export type Level = "DEBUG" | "INFO" | "WARNING" | "ERROR" | "FATAL" | "METRIC";


export interface LogOverview {
    title: string;
    message: string;
    args: unknown[];                       // e.g. ['foo', 'bar']
    kwargs: Record<string, unknown>;       // e.g. { baz: 'qux' }
    stackTrace: string | null;             // e.g. "File "backend/transactions/tasks.py", line 10, in <module>\n    raise Exception('test')\nException: test"

    exceptionType?: string | null;        // e.g. "AttributeError"
    handled?: string | null;               // e.g. "no"
    mechanism?: string | null;             // e.g. "celery"
    environment?: string | null;           // e.g. "production"
    traceId?: string | null;              // e.g. "6318bd31dbf843b48380bbfe3979233b"
    celeryTaskId?: string | null;        // e.g. "396bf247-f397-4ef3-a0b7-b9d77a803ed2"
    runtimeVersion?: string | null;       // e.g. "3.11.5"
    serverName?: string | null;           // e.g. "ip-10-0-1-25.us-east-2.compute.internal"
    eventId?: string | null;             // e.g. "fda64423"
    timestamp?: string | null;             // e.g. "2023-03-10T06:20:21.000Z"
    level?: Level | null;                 // e.g. "error", "warning"
    filePath?: string | null;             // e.g. "backend/transactions/tasks.py"
    messagePreview?: string | null;       // e.g. "AttributeError: 'NoneType' object..."
}

// TODO: Remove this
export interface FileResult {
    uuid: string;
    company: number;
    level: Level | null;
    title: string;
    message: string | null;
    lineNumber: number | null;
    columnNumber: number | null;
    errorCount: number;
    suggestions: Array<{
        lineNumber: number;
        message: string;
        filePath: string;
        errorCount: number;
    }>;
    overview: LogOverview;
}