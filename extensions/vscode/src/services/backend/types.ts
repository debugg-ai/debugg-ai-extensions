
export interface Issue {
    id: number;
    project: number;
    title?: string;
    message?: string;
    environment: string;
    status: 'open' | 'ongoing' | 'resolved' | 'archived';
    level: 'debug' | 'info' | 'warning' | 'error' | 'fatal';
    priority: 'low' | 'medium' | 'high';
    eventsCount: number;
    filePath: string;
    firstSeen: string;
    lastSeen: string;
    tags?: Record<string, any>;
    participants: number[];
    timestamp: string;
    lastMod: string;
}

export interface PaginatedResponse<T> {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
}

/**
 * Paginated response for issues
 */
export interface PaginatedIssueResponse extends PaginatedResponse<Issue> {
}

export interface IssueSuggestion extends Issue {
    uuid: string;
    lineNumber: string;
    columnNumber: string;
    suggestions: string;
    suggestion: string;
    overview: string;
}

export interface PaginatedIssueSuggestionResponse {
    count: number;
    next: string | null;
    previous: string | null;
    results: IssueSuggestion[];
}


export type Level = 'debug' | 'info' | 'warning' | 'error';


export interface LogOverview {
    title: string;
    message: string;
    args: unknown[];                       // e.g. ['foo', 'bar']
    kwargs: Record<string, unknown>;       // e.g. { baz: 'qux' }

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


export interface FileResult {
    id: number;
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