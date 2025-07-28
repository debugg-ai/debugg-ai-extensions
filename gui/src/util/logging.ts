/**
 * Development logging utility for debugging component loading states
 * This utility provides structured logging that can be easily disabled in production
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  component?: string;
  action?: string;
  data?: any;
}

class Logger {
  private isDevelopment: boolean;
  private componentName: string;

  constructor(componentName: string) {
    this.componentName = componentName;
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${this.componentName} ${timestamp}]`;
    
    if (context) {
      return `${prefix} ${level.toUpperCase()}: ${message}`;
    }
    
    return `${prefix} ${level.toUpperCase()}: ${message}`;
  }

  debug(message: string, context?: LogContext): void {
    if (!this.isDevelopment) return;
    
    const formattedMessage = this.formatMessage('debug', message, context);
    console.log(formattedMessage, context?.data || '');
  }

  info(message: string, context?: LogContext): void {
    const formattedMessage = this.formatMessage('info', message, context);
    console.info(formattedMessage, context?.data || '');
  }

  warn(message: string, context?: LogContext): void {
    const formattedMessage = this.formatMessage('warn', message, context);
    console.warn(formattedMessage, context?.data || '');
  }

  error(message: string, context?: LogContext): void {
    const formattedMessage = this.formatMessage('error', message, context);
    console.error(formattedMessage, context?.data || '');
  }

  // Legacy method for backward compatibility with existing debug logs
  log(message: string, data?: any): void {
    this.debug(message, { data });
  }
}

/**
 * Create a logger instance for a specific component
 */
export function createLogger(componentName: string): Logger {
  return new Logger(componentName);
}

/**
 * Pre-configured logger for E2eCommitSuiteDetailPage
 */
export const e2eCommitSuiteLogger = createLogger('E2eCommitSuiteDetailPage');

/**
 * Performance monitoring utility
 */
export class PerformanceMonitor {
  private startTimes: Map<string, number> = new Map();

  start(operation: string): void {
    this.startTimes.set(operation, performance.now());
  }

  end(operation: string, logger?: Logger): number {
    const startTime = this.startTimes.get(operation);
    if (!startTime) {
      console.warn(`Performance monitor: No start time found for operation "${operation}"`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.startTimes.delete(operation);

    if (logger) {
      logger.debug(`Performance: ${operation} completed`, { data: { duration: `${duration.toFixed(2)}ms` } });
    }

    return duration;
  }
}

export const performanceMonitor = new PerformanceMonitor();