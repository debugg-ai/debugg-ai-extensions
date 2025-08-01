import chalk from "chalk";
import * as vscode from "vscode";

import { handlePollUpdateFn, Status, Step, TerminalFormatterOptions, TerminalTest, TestState } from "../e2e-agents/types";

// Test type definitions for better formatting
export type TestType = 'e2e-test' | 'test-suite' | 'commit-suite';

// Enhanced formatter options
export interface EnhancedTerminalFormatterOptions extends TerminalFormatterOptions {
    testType?: TestType;
    showTimestamps?: boolean;
    compactMode?: boolean;
    animateProgress?: boolean;
    maxStepWidth?: number;
    showTestHierarchy?: boolean;
}

/**
 * Stateless TerminalFormatter for displaying progress and status in VS Code terminals
 * 
 * Usage Example:
 * ```typescript
 * // Create a formatter for a VS Code output channel
 * const outputChannel = vscode.window.createOutputChannel("My Process");
 * const formatter = new TerminalFormatter(outputChannel, {
 *     title: "Build Process",
 *     showProgressBar: true,
 *     stepLabelWidth: 25
 * });
 * 
 * // Create a test state
 * const state: TestState = {
 *     testObject: { uuid: "123", description: "My Test" },
 *     testResults: null,
 *     stepNumber: 1,
 *     completed: false,
 *     status: "running",
 *     steps: [
 *         { label: "Compiling", status: "success", details: "2.3s" },
 *         { label: "Testing", status: "running" }
 *     ]
 * };
 * 
 * // Print the state
 * formatter.printState(state);
 * 
 * // Print summary when complete
 * formatter.printSummary(state, "Build Complete", "All steps completed successfully");
 * ```
 */

export class TerminalFormatter {
    protected outputChannel: vscode.OutputChannel | { appendOutput: (text: string) => void };
    protected options: Required<EnhancedTerminalFormatterOptions>;
    private lastProgressUpdate: number = 0;
    private animationFrame: number = 0;

    constructor(
        outputChannel: vscode.OutputChannel | { appendOutput: (text: string) => void },
        options: EnhancedTerminalFormatterOptions = {}
    ) {
        this.outputChannel = outputChannel;

        // Set enhanced default options
        this.options = {
            title: options.title || "Progress",
            showStepNumbers: options.showStepNumbers ?? true,
            stepLabelWidth: options.stepLabelWidth || 35,
            autoClear: options.autoClear ?? true,
            showProgressBar: options.showProgressBar ?? true,
            testType: options.testType || 'e2e-test',
            showTimestamps: options.showTimestamps ?? false,
            compactMode: options.compactMode ?? false,
            animateProgress: options.animateProgress ?? false,
            maxStepWidth: options.maxStepWidth || 80,
            showTestHierarchy: options.showTestHierarchy ?? true,
            ...options
        };
    }

    /**
     * Print the current test state with enhanced formatting
     */
    printState(state: TestState): void {
        this.clearOutput();

        const header = this.formatEnhancedHeader(state);
        const timestamp = this.options.showTimestamps ? this.formatTimestamp() : '';
        
        // Determine test type and format accordingly
        const testType = this.detectTestType(state);
        this.options.testType = testType;

        let output = `${header}${timestamp}\r\r\n`;

        // Format based on test type with hierarchical structure
        if (state.tests && Array.isArray(state.tests) && state.tests.length > 0) {
            output += this.formatTestSuite(state);
        } else if (state.steps && Array.isArray(state.steps) && state.steps.length > 0) {
            output += this.formatSingleTest(state);
        } else {
            output += this.formatInitializing();
        }

        // Add progress indicators
        output += this.generateEnhancedProgressBar(state);
        
        // Add status footer
        output += this.formatStatusFooter(state);

        this.appendOutput(output);
    }

    /**
     * Print an enhanced summary with detailed metrics
     */
    printSummary(state: TestState, title?: string, details?: string): void {
        this.clearOutput();

        // Print current state first
        this.printState(state);
        
        // Add decorative divider
        this.printEnhancedDivider("Summary & Results");

        const testType = this.detectTestType(state);
        
        if (state.tests && Array.isArray(state.tests) && state.tests.length > 0) {
            this.appendOutput("\r\n" + this.createDetailedTestsSummary(state));
        } else {
            this.appendOutput("\r\n" + this.createStepsSummary(state, title, details));
        }

        // Add performance metrics if available
        this.appendOutput("\r\n" + this.formatPerformanceMetrics(state));
        
        // Add final status with recommendations
        this.appendOutput("\r\n" + this.formatFinalStatus(state, testType));
    }

    /**
     * Create detailed test summary with metrics and insights
     */
    createDetailedTestsSummary(state: TestState): string {
        const tests = state.tests || [];
        const passed = tests.filter(t => t.outcome === 'pass').length;
        const failed = tests.filter(t => t.outcome === 'fail').length;
        const pending = tests.filter(t => t.outcome === 'pending').length;
        const skipped = tests.filter(t => t.outcome === 'skipped').length;
        const total = tests.length;
        
        const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
        const testType = this.options.testType;
        
        const typeIcon = this.getTestTypeIcon(testType);
        const typeColor = this.getTestTypeColor(testType);
        
        const summary = [
            chalk.bold(typeColor(`${typeIcon} ${this.getTestTypeDisplayName(testType)} Results`)),
            '',
            chalk.cyan('📊 Statistics:'),
            `   ${chalk.green('✅ Passed:')}    ${chalk.bold(passed.toString().padStart(3))} / ${total}`,
            `   ${chalk.red('❌ Failed:')}    ${chalk.bold(failed.toString().padStart(3))} / ${total}`,
            `   ${chalk.yellow('⏳ Pending:')}   ${chalk.bold(pending.toString().padStart(3))} / ${total}`,
            `   ${chalk.gray('⏭️ Skipped:')}   ${chalk.bold(skipped.toString().padStart(3))} / ${total}`,
            '',
            `${chalk.cyan('📈 Pass Rate:')} ${this.formatPassRate(passRate)}`,
            // `${chalk.dim('⏱️ Status:')} ${this.getStatusIcon(state.status)} ${chalk.bold(state.status.toUpperCase())}`
        ];
        
        // Add test-specific insights
        // if (testType === 'commit-suite') {
        //     summary.push('', chalk.magenta('🔄 Commit-based test suite - validating code changes'));
        // } else if (testType === 'test-suite') {
        //     summary.push('', chalk.blue('📦 Test suite - comprehensive feature validation'));
        // }
        
        return summary.join("\r\n");
    }
    
    /**
     * Create steps summary for single tests
     */
    createStepsSummary(state: TestState, title?: string, details?: string): string {
        const steps = state.steps || [];
        const completed = steps.filter(s => s.status === 'success').length;
        const failed = steps.filter(s => s.status === 'error' || s.status === 'failed').length;
        const pending = steps.filter(s => s.status === 'pending').length;
        const running = steps.filter(s => s.status === 'running').length;
        const total = steps.length;
        
        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
        const summaryTitle = title || `${this.options.title} Summary`;
        
        const summary = [
            chalk.bold(`🎯 ${summaryTitle}`),
            '',
            chalk.cyan('📊 Step Progress:'),
            `   ${chalk.green('✅ Completed:')} ${chalk.bold(completed.toString().padStart(3))} / ${total}`,
            `   ${chalk.red('❌ Failed:')}    ${chalk.bold(failed.toString().padStart(3))} / ${total}`,
            `   ${chalk.blue('🔄 Running:')}   ${chalk.bold(running.toString().padStart(3))} / ${total}`,
            `   ${chalk.yellow('⏳ Pending:')}   ${chalk.bold(pending.toString().padStart(3))} / ${total}`,
            '',
            `${chalk.cyan('📈 Completion:')} ${this.formatPassRate(completionRate)}`,
            `${chalk.dim('⏱️ Status:')} ${this.getStatusIcon(state.status)} ${chalk.bold(state.status.toUpperCase())}`,
            details ? `\r\n${chalk.dim(details)}` : ''
        ];
        
        return summary.join("\r\n");
    }

    /**
     * Print test results
     */
    printResults(state: TestState): void {
        if (!state.testResults) {
            return;
        }

        const results = [
            chalk.bold(`📋 Test Results: ${state.testResults.title || state.testResults.description}`),
            chalk.dim(`UUID: ${state.testResults.uuid}`),
            state.testResults.formattedResults
        ].join("\r\n");

        this.appendOutput("\r\n" + results);
    }

    /**
     * Print a simple message
     */
    printMessage(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
        const icons = {
            info: 'ℹ️',
            success: '✅',
            warning: '⚠️',
            error: '❌'
        };

        const colors = {
            info: chalk.blue,
            success: chalk.green,
            warning: chalk.yellow,
            error: chalk.red
        };

        const formattedMessage = `${icons[type]} ${colors[type](message)}`;
        this.appendOutput("\r\n" + formattedMessage);
    }

    /**
     * Print enhanced section divider
     */
    printEnhancedDivider(title?: string): void {
        const maxWidth = Math.min(80, this.options.maxStepWidth || 80);
        
        if (title) {
            const titleLength = title.length;
            const sideLength = Math.max(2, Math.floor((maxWidth - titleLength - 2) / 2));
            const leftSide = '═'.repeat(sideLength);
            const rightSide = '═'.repeat(maxWidth - titleLength - sideLength - 2);
            const divider = `\r\n${chalk.cyan(leftSide)} ${chalk.bold.white(title)} ${chalk.cyan(rightSide)}\r\n`;
            this.appendOutput(divider);
        } else {
            const divider = `\r\n${chalk.gray('═'.repeat(maxWidth))}\r\n`;
            this.appendOutput(divider);
        }
    }
    
    /**
     * Print legacy divider for backward compatibility
     */
    printDivider(title?: string): void {
        this.printEnhancedDivider(title);
    }

    /**
     * Format enhanced header with test type distinction
     */
    private formatEnhancedHeader(state: TestState): string {
        const title = state.testObject?.title || state.testObject?.description || this.options.title;
        const testType = this.detectTestType(state);
        const typeIcon = this.getTestTypeIcon(testType);
        const typeColor = this.getTestTypeColor(testType);
        const status = this.getEnhancedStatusIcon(state.status);
        
        // Create title with type indicator
        const titleText = chalk.bold(typeColor(`${typeIcon} ${title}`));
        const statusText = `${status} ${chalk.dim(this.getTestTypeDisplayName(testType))}`;
        
        let headerLines = [
            chalk.gray('═'.repeat(Math.min(80, this.options.maxStepWidth || 80))),
            `${titleText} ${statusText}`,
        ];
        
        if (state.testObject?.uuid) {
            const uuid = chalk.dim(`ID: ${state.testObject.uuid.slice(0, 12)}`);
            headerLines.push(uuid);
        }
        
        headerLines.push(chalk.gray('─'.repeat(Math.min(80, this.options.maxStepWidth || 80))));
        
        return headerLines.join("\r\n");
    }

    /**
     * Format test suite with hierarchical structure
     */
    private formatTestSuite(state: TestState): string {
        const tests = state.tests || [];
        if (tests.length === 0) {
            return chalk.dim('   No tests available');
        }
        
        const output: string[] = [];
        const testType = this.options.testType;
        
        if (testType === 'commit-suite') {
            output.push(chalk.magenta.bold('🔄 Commit Test Suite'));
            output.push(chalk.dim(`   Validating ${tests.length} generated test(s)\r\n`));
        } else if (testType === 'test-suite') {
            output.push(chalk.blue.bold('📦 Feature Test Suite'));
            output.push(chalk.dim(`   Running ${tests.length} comprehensive test(s)\r\n`));
        }
        
        tests.forEach((test, index) => {
            output.push(this.formatTestWithHierarchy(test, index, tests.length));
            if (index < tests.length - 1) {
                output.push(''); // Add spacing between tests
            }
        });
        
        return output.join("\r\n");
    }
    
    /**
     * Format single test with enhanced structure
     */
    private formatTestWithHierarchy(test: TerminalTest, index: number, total: number): string {
        const isLast = index === total - 1;
        const prefix = isLast ? '└──' : '├──';
        const connector = isLast ? '   ' : '│  ';
        
        const statusIcon = this.getEnhancedStatusIcon(test.status);
        const outcomeIcon = this.getOutcomeIcon(test.outcome);
        
        const titleLine = `${chalk.cyan(prefix)} ${statusIcon} ${chalk.bold(test.title || `Test ${index + 1}`)} ${outcomeIcon}`;
        
        const lines = [titleLine];
        
        if (test.description && !this.options.compactMode) {
            lines.push(`${chalk.cyan(connector)}    ${chalk.dim(test.description)}`);
        }
        
        // Add step progress for each test
        if (test.steps && test.steps.length > 0) {
            const stepsSummary = this.formatTestStepsSummary(test.steps);
            lines.push(`${chalk.cyan(connector)}    ${stepsSummary}`);
            
            if (this.options.showTestHierarchy && !this.options.compactMode) {
                const formattedSteps = this.formatNestedSteps(test.steps, connector);
                if (formattedSteps) {
                    lines.push(formattedSteps);
                }
            }
        }
        
        return lines.join("\r\n");
    }
    
    /**
     * Format single test execution
     */
    private formatSingleTest(state: TestState): string {
        const steps = state.steps || [];
        if (steps.length === 0) {
            return this.formatInitializing();
        }
        
        const output: string[] = [];
        output.push(chalk.blue.bold('🎯 Test Execution Steps'));
        output.push('');
        
        steps.forEach((step, index) => {
            output.push(this.formatEnhancedStep(step, index, steps.length));
        });
        
        return output.join("\r\n");
    }
    /**
     * Format enhanced step with better visual hierarchy
     */
    private formatEnhancedStep(step: Step, index: number, total: number): string {
        const isLast = index === total - 1;
        const prefix = isLast ? '└──' : '├──';
        const icon = this.getEnhancedStatusIcon(step.status);
        const stepNumber = this.options.showStepNumbers ? chalk.dim(`[${(index + 1).toString().padStart(2)}]`) : '';
        
        let label = step.label || `Step ${index + 1}`;
        if (label.length > this.options.stepLabelWidth) {
            label = label.substring(0, this.options.stepLabelWidth - 3) + '...';
        }
        
        const details = step.details ? chalk.dim(` • ${step.details}`) : '';
        const statusColor = this.getStatusColor(step.status);
        
        return `   ${chalk.cyan(prefix)} ${stepNumber} ${statusColor(label)} ${icon}${details}`;
    }
    
    /**
     * Format nested steps for hierarchical display
     */
    private formatNestedSteps(steps: Step[], parentConnector: string): string {
        if (!steps || steps.length === 0 || this.options.compactMode) {
            return '';
        }
        
        const nestedSteps = steps.map((step, index) => {
            const isLast = index === steps.length - 1;
            const stepPrefix = isLast ? '└──' : '├──';
            const icon = this.getEnhancedStatusIcon(step.status);
            
            // Use the actual step label if available, with better fallbacks
            let label = step.label;
            if (!label || label.trim() === '') {
                label = `Step ${index + 1}`;
            }
            
            // Truncate long labels for nested display
            if (label.length > 50) {
                label = label.substring(0, 47) + '...';
            }
            
            // Add step details if available and not too verbose
            let details = '';
            if (step.details && step.details.length < 30) {
                details = chalk.dim(` • ${step.details}`);
            }
            
            return `${parentConnector}    ${chalk.gray(stepPrefix)} ${icon} ${chalk.dim(label)}${details}`;
        });
        
        return nestedSteps.join("\r\n");
    }
    
    /**
     * Format test steps summary for overview
     */
    private formatTestStepsSummary(steps: Step[]): string {
        if (!steps || steps.length === 0) {
            return `${chalk.dim('Steps:')} ${chalk.gray('No steps')} ${chalk.dim('(0/0)')}`;
        }

        const completed = steps.filter(s => s.status === 'success' || s.status === 'completed').length;
        const failed = steps.filter(s => s.status === 'error' || s.status === 'failed').length;
        const running = steps.filter(s => s.status === 'running').length;
        const pending = steps.filter(s => s.status === 'pending').length;
        const total = steps.length;
        
        const parts: string[] = [];
        
        // Show progress counts with status indicators
        if (completed > 0) parts.push(chalk.green(`${completed} ✅`));
        if (failed > 0) parts.push(chalk.red(`${failed} ❌`));
        if (running > 0) parts.push(chalk.blue(`${running} 🔄`));
        if (pending > 0) parts.push(chalk.yellow(`${pending} ⏳`));
        
        // If no parts have been added, it means we have steps but they're in an unexpected state
        const summary = parts.length > 0 ? parts.join(' ') : chalk.dim(`${total} steps`);
        
        // Show progress as completed+failed/total (active progress) not just completed/total
        const progress = completed + failed; // Progress = steps that have finished (either success or failure)
        
        return `${chalk.dim('Steps:')} ${summary}`;
    }

    /**
     * Get enhanced status icon with animations
     */
    private getEnhancedStatusIcon(status: Status): string {
        const animations = this.options.animateProgress;
        
        switch (status) {
            case 'pending':
                return chalk.yellow("⏳");
            case 'running':
                if (animations) {
                    const spinners = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
                    const frame = Math.floor(Date.now() / 100) % spinners.length;
                    return chalk.blue(spinners[frame]);
                }
                return chalk.blue("🔄");
            case 'success':
            case 'completed':
                return chalk.green("✅");
            case 'error':
            case 'failed':
                return chalk.red("❌");
            case 'skipped':
                return chalk.gray("⏭️");
            default:
                return chalk.gray("•");
        }
    }
    
    /**
     * Get legacy status icon for backward compatibility
     */
    private getStatusIcon(status: Status): string {
        return this.getEnhancedStatusIcon(status);
    }
    
    /**
     * Get status color function
     */
    private getStatusColor(status: Status): chalk.ChalkFunction {
        switch (status) {
            case 'pending':
                return chalk.yellow;
            case 'running':
                return chalk.blue;
            case 'success':
            case 'completed':
                return chalk.green;
            case 'error':
            case 'failed':
                return chalk.red;
            case 'skipped':
                return chalk.gray;
            default:
                return chalk.white;
        }
    }
    
    /**
     * Get outcome icon for test results
     */
    private getOutcomeIcon(outcome?: string): string {
        if (!outcome) return '';
        
        switch (outcome.toLowerCase()) {
            case 'pass':
            case 'passed':
                return chalk.green('✅');
            case 'fail':
            case 'failed':
                return chalk.red('❌');
            case 'skip':
            case 'skipped':
                return chalk.gray('⏭️');
            case 'pending':
                return chalk.yellow('⏳');
            default:
                return chalk.dim('•');
        }
    }

    /**
     * Generate enhanced progress bar with detailed metrics
     */
    private generateEnhancedProgressBar(state: TestState): string {
        if (!this.options.showProgressBar) {
            return '';
        }
        
        let progressData;
        let label = 'Progress';
        
        if (state.tests && Array.isArray(state.tests) && state.tests.length > 0) {
            progressData = this.calculateTestsProgress(state.tests);
            label = 'Test Suite Progress';
        } else {
            progressData = this.calculateStepsProgress(state.steps || []);
            label = 'Execution Progress';
        }
        
        const { completed, failed, total, percentage } = progressData;
        const barWidth = Math.min(40, this.options.maxStepWidth ? this.options.maxStepWidth - 30 : 40);
        
        // Handle zero division and create segmented progress bar
        if (total === 0) {
            return '';
        }
        
        const successWidth = Math.max(0, Math.round((completed / total) * barWidth));
        const failedWidth = Math.max(0, Math.round((failed / total) * barWidth));
        const remainingWidth = Math.max(0, barWidth - successWidth - failedWidth);
        
        const successBar = '█'.repeat(successWidth);
        const failedBar = '█'.repeat(failedWidth);
        const emptyBar = '░'.repeat(remainingWidth);
        
        const progressBar = `[${chalk.green(successBar)}${chalk.red(failedBar)}${chalk.gray(emptyBar)}]`;
        const percentageText = `${percentage}%`;
        const countsText = `(${completed + failed}/${total})`;
        
        const lines = [
            '',
            chalk.cyan.bold(`📊 ${label}:`),
            `   ${progressBar} ${chalk.bold(percentageText)} ${chalk.dim(countsText)}`
        ];
        
        // Add detailed breakdown
        if (completed > 0 || failed > 0) {
            const breakdown: string[] = [];
            if (completed > 0) breakdown.push(chalk.green(`✅ ${completed}`));
            if (failed > 0) breakdown.push(chalk.red(`❌ ${failed}`));
            const pending = total - completed - failed;
            if (pending > 0) breakdown.push(chalk.yellow(`⏳ ${pending}`));
            
            lines.push(`   ${breakdown.join(' • ')}`);
        }
        
        return lines.join("\r\n");
    }
    
    /**
     * Calculate progress for tests
     */
    private calculateTestsProgress(tests: TerminalTest[]) {
        const completed = tests.filter(t => t.outcome === 'pass').length;
        const failed = tests.filter(t => t.outcome === 'fail').length;
        const pending = tests.filter(t => t.outcome === 'pending' || (!t.outcome && t.status !== 'completed')).length;
        const total = tests.length;
        
        // For test suites, calculate percentage based on tests that have finished (completed + failed) vs total
        const finished = completed + failed;
        const percentage = total > 0 ? Math.round((finished / total) * 100) : 0;
        
        return { completed, failed, total, percentage };
    }
    
    /**
     * Calculate progress for steps
     */
    private calculateStepsProgress(steps: Step[]) {
        const completed = steps.filter(s => s.status === 'success' || s.status === 'completed').length;
        const failed = steps.filter(s => s.status === 'error' || s.status === 'failed').length;
        const total = steps.length;
        
        // Calculate percentage based on steps that have finished (completed + failed) vs total
        const finished = completed + failed;
        const percentage = total > 0 ? Math.round((finished / total) * 100) : 0;
        
        return { completed, failed, total, percentage };
    }

    /**
     * Clear the terminal output with smooth transition
     */
    private clearOutput(): void {
        if (this.options.autoClear) {
            // Throttle clear operations to avoid flicker
            const now = Date.now();
            if (now - this.lastProgressUpdate > 100) {
                this.appendOutput("\x1Bc"); // ANSI clear screen
                this.lastProgressUpdate = now;
            }
        }
    }

    /**
     * Append text to output with formatting
     */
    private appendOutput(text: string): void {
        // Ensure proper line endings for VS Code output channels WRONG. OUTPUT USES \r\n
        // const formattedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const formattedText = text;

        if ('appendOutput' in this.outputChannel) {
            this.outputChannel.appendOutput(formattedText);
        } else {
            this.outputChannel.append(formattedText);
        }
    }

    /**
     * Create a simple test state for basic progress tracking (backward compatibility)
     */
    static createSimpleState(
        title: string,
        steps: Step[],
        status: Status = 'running',
        completed: boolean = false
    ): TestState {
        return TerminalFormatter.createEnhancedState(title, 'e2e-test', steps, status, completed);
    }

    /**
     * Update a step in a test state
     */
    static updateStep(state: TestState, label: string, status: Status, details?: string, currentState?: any, action?: any): TestState {
        const updatedSteps = [...state.steps];
        const existingIndex = updatedSteps.findIndex(s => s.label === label);

        if (existingIndex !== -1) {
            updatedSteps[existingIndex] = {
                ...updatedSteps[existingIndex],
                status,
                details,
                currentState,
                action
            };
        } else {
            updatedSteps.push({ label, status, details, currentState, action });
        }

        return {
            ...state,
            steps: updatedSteps,
            stepNumber: updatedSteps.length
        };
    }

    /**
     * Add a step to a test state
     */
    static addStep(state: TestState, label: string, status: Status = 'pending', details?: string, currentState?: any, action?: any): TestState {
        const newStep: Step = { label, status, details, currentState, action };
        return {
            ...state,
            steps: [...state.steps, newStep],
            stepNumber: state.steps.length + 1
        };
    }

    /**
     * Remove a step from a test state
     */
    static removeStep(state: TestState, label: string): TestState {
        const updatedSteps = state.steps.filter(s => s.label !== label);
        return {
            ...state,
            steps: updatedSteps,
            stepNumber: updatedSteps.length
        };
    }

    // ========================================
    // New Helper Methods for Enhanced Formatting
    // ========================================
    
    /**
     * Detect test type from state
     */
    private detectTestType(state: TestState): TestType {
        if (state.tests && Array.isArray(state.tests) && state.tests.length > 0) {
            // Look for commit-related indicators
            const hasCommitTests = state.tests.some(t => 
                t.description?.includes('commit') || 
                t.title?.includes('commit') ||
                (t.object && typeof t.object.testScript === 'string' && t.object.testScript.includes('commit'))
            ) || state.testObject?.object?.description?.includes('commit');
            
            if (hasCommitTests) {
                return 'commit-suite';
            }
            
            return 'test-suite';
        }
        
        return 'e2e-test';
    }
    
    /**
     * Get test type icon
     */
    private getTestTypeIcon(testType: TestType): string {
        switch (testType) {
            case 'e2e-test':
                return '🎯';
            case 'test-suite':
                return '📦';
            case 'commit-suite':
                return '🔄';
            default:
                return '🧪';
        }
    }
    
    /**
     * Get test type color function
     */
    private getTestTypeColor(testType: TestType): chalk.ChalkFunction {
        switch (testType) {
            case 'e2e-test':
                return chalk.blue;
            case 'test-suite':
                return chalk.cyan;
            case 'commit-suite':
                return chalk.magenta;
            default:
                return chalk.white;
        }
    }
    
    /**
     * Get test type display name
     */
    private getTestTypeDisplayName(testType: TestType): string {
        switch (testType) {
            case 'e2e-test':
                return 'E2E Test';
            case 'test-suite':
                return 'Test Suite';
            case 'commit-suite':
                return 'Commit Test Suite';
            default:
                return 'Test';
        }
    }
    
    /**
     * Format timestamp
     */
    private formatTimestamp(): string {
        const now = new Date();
        const time = now.toLocaleTimeString('en-US', { 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
        });
        return chalk.dim(` • ${time}`);
    }
    
    /**
     * Format initializing state
     */
    private formatInitializing(): string {
        const spinner = this.options.animateProgress ? 
            chalk.blue('⠋') : chalk.blue('🔄');
        return `   ${spinner} ${chalk.dim('Initializing test execution...')}`;
    }
    
    /**
     * Format status footer
     */
    private formatStatusFooter(state: TestState): string {
        const testType = this.options.testType;
        const statusIcon = this.getEnhancedStatusIcon(state.status);
        const typeIcon = this.getTestTypeIcon(testType);
        
        const lines = [
            '',
            chalk.gray('─'.repeat(Math.min(80, this.options.maxStepWidth || 80))),
            `${statusIcon} ${chalk.bold('Status:')} ${chalk.bold(state.status.toUpperCase())} ${typeIcon} ${chalk.dim(this.getTestTypeDisplayName(testType))}`
        ];
        
        return lines.join("\r\n");
    }
    
    /**
     * Format pass rate with color coding
     */
    private formatPassRate(percentage: number): string {
        let color: chalk.ChalkFunction;
        let icon: string;
        
        if (percentage >= 90) {
            color = chalk.green;
            icon = '🎆';
        } else if (percentage >= 70) {
            color = chalk.yellow;
            icon = '👍';
        } else if (percentage >= 50) {
            color = chalk.hex('#FFA500'); // Orange color
            icon = '⚠️';
        } else {
            color = chalk.red;
            icon = '🚨';
        }
        
        return `${chalk.bold(color(`${percentage}%`))} ${icon}`;
    }
    
    /**
     * Format performance metrics
     */
    private formatPerformanceMetrics(state: TestState): string {
        // This is a placeholder for future performance metrics
        // Could include execution time, memory usage, etc.
        const lines = [
            chalk.cyan.bold('⏱️ Performance:'),
            chalk.dim(`   Execution time: ${this.calculateExecutionTime(state)}`),
        ];
        
        return lines.join("\r\n");
    }
    
    public calculateTotalExecutionMs(state: TestState): number {
        let now = new Date();
        let start = new Date(state.testObject?.object?.timestamp || 0);
        return now.getTime() - start.getTime();
    }

    /**
     * Calculate estimated execution time
     */
    public calculateExecutionTime(state: TestState): string {
        // Simple estimation based on test complexity
        const baseTime = 30; // seconds
        let multiplier = 1;
        
        if (state.tests && state.tests.length > 0) {
            multiplier = state.tests.length;
        } else if (state.steps && state.steps.length > 0) {
            multiplier = Math.max(1, state.steps.length * 0.5);
        }
        
        const estimatedSeconds = Math.round(baseTime * multiplier);
        
        if (estimatedSeconds < 60) {
            return `~${estimatedSeconds}s`;
        } else {
            const minutes = Math.floor(estimatedSeconds / 60);
            const seconds = estimatedSeconds % 60;
            return `~${minutes}m ${seconds}s`;
        }
    }
    
    /**
     * Format final status with recommendations
     */
    private formatFinalStatus(state: TestState, testType: TestType): string {
        const lines: string[] = [];
        const typeIcon = this.getTestTypeIcon(testType);
        const statusIcon = this.getEnhancedStatusIcon(state.status);
        
        lines.push(chalk.cyan.bold(`${typeIcon} Final Status:`));
        
        if (state.status === 'completed') {
            // lines.push(chalk.green(`   ${statusIcon} ${this.getTestTypeDisplayName(testType)} completed successfully!`));
            
            if (testType === 'commit-suite') {
                lines.push(chalk.dim('   → Your code change tests completed'));
            } else if (testType === 'test-suite') {
                lines.push(chalk.dim('   → All test scenarios completed'));
            } else {
                lines.push(chalk.dim('   → E2E test execution finished'));
            }
        } else if (state.status === 'failed' || state.status === 'error') {
            lines.push(chalk.red(`   ${statusIcon} ${this.getTestTypeDisplayName(testType)} encountered issues`));
            lines.push(chalk.dim('   → Review the failed steps above for details'));
        } else if (state.status === 'running') {
            lines.push(chalk.blue(`   ${statusIcon} ${this.getTestTypeDisplayName(testType)} is still in progress`));
            lines.push(chalk.dim('   → Please wait for completion'));
        }
        
        return lines.join("\r\n");
    }

    // ========================================
    // Static Utility Methods (Enhanced)
    // ========================================
    
    /**
     * Check if all steps are completed
     */
    static isCompleted(state: TestState): boolean {
        if (state.tests && Array.isArray(state.tests) && state.tests.length > 0) {
            return state.tests.every(t => 
                t.outcome === 'pass' || t.outcome === 'skipped'
            );
        }
        
        return state.steps && Array.isArray(state.steps) && state.steps.length > 0 && state.steps.every(s =>
            s.status === 'success' || s.status === 'skipped'
        );
    }

    /**
     * Check if any steps failed
     */
    static hasFailures(state: TestState): boolean {
        if (state.tests && Array.isArray(state.tests) && state.tests.length > 0) {
            return state.tests.some(t => t.outcome === 'fail');
        }
        
        return state.steps && Array.isArray(state.steps) && state.steps.some(s => s.status === 'error' || s.status === 'failed');
    }

    /**
     * Get step by label
     */
    static getStep(state: TestState, label: string): Step | undefined {
        return state.steps && Array.isArray(state.steps) ? state.steps.find(s => s.label === label) : undefined;
    }
    
    /**
     * Get test by title or UUID
     */
    static getTest(state: TestState, identifier: string): TerminalTest | undefined {
        if (!state.tests || !Array.isArray(state.tests)) return undefined;
        
        return state.tests.find(t => 
            t.title === identifier || 
            t.uuid === identifier ||
            t.description === identifier
        );
    }
    
    /**
     * Create enhanced state with test type detection
     */
    static createEnhancedState(
        title: string,
        testType: TestType,
        data: Step[] | TerminalTest[],
        status: Status = 'running',
        completed: boolean = false
    ): TestState {
        const isTestArray = Array.isArray(data) && data.length > 0 && 'uuid' in data[0];
        
        return {
            testObject: {
                uuid: `${testType}-${Date.now()}`,
                description: title,
                title: title,
                status: status,
                object: { title, testType, status, completed }
            },
            testResults: null,
            stepNumber: isTestArray ? 0 : (data as Step[]).length,
            completed,
            status,
            steps: isTestArray ? [] : (data as Step[]),
            tests: isTestArray ? (data as TerminalTest[]) : [],
            handlePollUpdate: handlePollUpdateFn
        };
    }
}
