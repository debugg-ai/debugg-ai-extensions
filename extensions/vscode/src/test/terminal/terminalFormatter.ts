import chalk from "chalk";
import * as vscode from "vscode";
import { handlePollUpdateFn, Status, Step, TerminalFormatterOptions, TestState } from "../e2e-agents/types";

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
    protected options: Required<TerminalFormatterOptions>;

    constructor(
        outputChannel: vscode.OutputChannel | { appendOutput: (text: string) => void },
        options: TerminalFormatterOptions = {}
    ) {
        this.outputChannel = outputChannel;
        
        // Set default options
        this.options = {
            title: options.title || "Progress",
            showStepNumbers: options.showStepNumbers ?? true,
            stepLabelWidth: options.stepLabelWidth || 30,
            autoClear: options.autoClear ?? true,
            showProgressBar: options.showProgressBar ?? false,
            ...options
        };
    }

    /**
     * Print the current test state
     */
    printState(state: TestState): void {
        this.clearOutput();
        
        const header = this.formatHeader(state);
        const stepsOutput = this.formatSteps(state.steps);
        const progressBar = this.generateProgressBar(state.steps);
        
        const output = `${header}\r\n${stepsOutput}${progressBar}`;
        
        this.appendOutput(output);
    }

    /**
     * Print a summary of the test state
     */
    printSummary(state: TestState, title?: string, details?: string): void {
        const summaryTitle = title || `${this.options.title} Summary`;
        const completed = state.steps.filter(s => s.status === 'success').length;
        const failed = state.steps.filter(s => s.status === 'error' || s.status === 'failed').length;
        const skipped = state.steps.filter(s => s.status === 'skipped').length;
        const total = state.steps.length;
        
        const summary = [
            chalk.bold(`📊 ${summaryTitle}`),
            chalk.dim(`Total Steps: ${total}`),
            chalk.green(`✅ Completed: ${completed}`),
            chalk.red(`❌ Failed: ${failed}`),
            chalk.gray(`⏭️ Skipped: ${skipped}`),
            chalk.dim(`⏱️ Overall Status: ${this.getStatusIcon(state.status)} ${state.status}`),
            details ? `\n${details}` : ''
        ].join("\r\n");
        
        this.appendOutput("\r\n" + summary);
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
     * Print a section divider
     */
    printDivider(title?: string): void {
        const divider = title 
            ? `\n${chalk.gray('─'.repeat(20))} ${chalk.bold(title)} ${chalk.gray('─'.repeat(20))}\n`
            : `\n${chalk.gray('─'.repeat(50))}\n`;
        
        this.appendOutput(divider);
    }

    /**
     * Format the header with test object info and status
     */
    private formatHeader(state: TestState): string {
        const title = state.testObject?.title || state.testObject?.description || this.options.title;
        const status = this.getStatusIcon(state.status);
        const statusText = chalk.bold(`${status} ${title}`);
        
        if (state.testObject?.uuid) {
            const uuid = chalk.dim(`(${state.testObject.uuid.slice(0, 8)})`);
            return `${statusText} ${uuid}`;
        }
        
        return statusText;
    }

    /**
     * Format all steps
     */
    private formatSteps(steps: Step[]): string {
        if (steps.length === 0) {
            return chalk.dim("No steps available");
        }
        
        return steps.map((step, i) => this.formatStep(step, i)).join("\r\n");
    }

    /**
     * Format a single step
     */
    private formatStep(step: Step, index: number): string {
        const icon = this.getStatusIcon(step.status);
        const stepNumber = this.options.showStepNumbers ? `${chalk.dim(`Step ${index + 1}:`)} ` : '';
        const label = step.label.padEnd(this.options.stepLabelWidth);
        const details = step.details ? ` ${chalk.dim(`(${step.details})`)}` : '';
        
        return `${stepNumber}${label} ${icon}${details}`;
    }

    /**
     * Get step status icon
     */
    private getStatusIcon(status: Status): string {
        switch (status) {
            case 'pending':
                return chalk.yellow("⏳");
            case 'running':
                return chalk.blue("🔄");
            case 'success':
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
     * Generate progress bar
     */
    private generateProgressBar(steps: Step[]): string {
        if (!this.options.showProgressBar) {
            return '';
        }

        const completed = steps.filter(s => s.status === 'success').length;
        const total = steps.length;
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
        
        const barWidth = 20;
        const filledWidth = Math.round((percentage / 100) * barWidth);
        const emptyWidth = barWidth - filledWidth;
        
        const filled = '█'.repeat(filledWidth);
        const empty = '░'.repeat(emptyWidth);
        
        return `\n${chalk.cyan('Progress:')} [${chalk.green(filled)}${chalk.gray(empty)}] ${percentage}% (${completed}/${total})`;
    }

    /**
     * Clear the terminal output
     */
    private clearOutput(): void {
        if (this.options.autoClear) {
            this.appendOutput("\x1Bc"); // ANSI clear screen
        }
    }

    /**
     * Append text to output
     */
    private appendOutput(text: string): void {
        if ('appendOutput' in this.outputChannel) {
            this.outputChannel.appendOutput(text);
        } else {
            this.outputChannel.append(text);
        }
    }

    /**
     * Create a simple test state for basic progress tracking
     */
    static createSimpleState(
        title: string, 
        steps: Step[], 
        status: Status = 'running',
        completed: boolean = false
    ): TestState {
        return {
            testObject: {
                uuid: `simple-${Date.now()}`,
                description: title,
                title: title,
                status: status,
                object: { title, steps, status, completed }
            },
            testResults: null,
            stepNumber: steps.length,
            completed,
            status,
            steps,
            handlePollUpdate: handlePollUpdateFn
        };
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

    /**
     * Check if all steps are completed
     */
    static isCompleted(state: TestState): boolean {
        return state.steps.length > 0 && state.steps.every(s => 
            s.status === 'success' || s.status === 'skipped'
        );
    }

    /**
     * Check if any steps failed
     */
    static hasFailures(state: TestState): boolean {
        return state.steps.some(s => s.status === 'error' || s.status === 'failed');
    }

    /**
     * Get step by label
     */
    static getStep(state: TestState, label: string): Step | undefined {
        return state.steps.find(s => s.label === label);
    }
}
