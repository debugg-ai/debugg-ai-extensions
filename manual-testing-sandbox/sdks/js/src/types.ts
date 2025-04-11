export type DebuggAiLoggerOptions = {
    endpoint: string;
    hostName: string;
    environment: string;
    level: string;
}

export type DebuggAiLogger = {
    init: (options: DebuggAiLoggerOptions) => Promise<void>;
    log: (message: string, ...args: any[]) => void;
    info: (message: string, ...args: any[]) => void;
    warn: (message: string, ...args: any[]) => void;
    error: (message: string, ...args: any[]) => void;
}