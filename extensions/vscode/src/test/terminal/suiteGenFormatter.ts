import chalk from "chalk";
import * as vscode from "vscode";

import { handlePollUpdateFn, Status, TestState } from "../e2e-agents/types";

import { TerminalFormatter } from "./terminalFormatter";

import type { E2eTestSuite } from "core/debuggAIServer/types";

export class SuiteGenFormatter {
    private formatter: TerminalFormatter;
    private suite: E2eTestSuite;
    private state: TestState;

    constructor(runVsTestRunner: vscode.TestRun, suite: E2eTestSuite) {
        this.formatter = new TerminalFormatter(runVsTestRunner, { 
            title: "🧪 E2E Test Progress",
            showStepNumbers: true,
            stepLabelWidth: 30,
            autoClear: true,
            showProgressBar: false
        });
        this.suite = suite;
        
        // Initialize state
        this.state = {
            testObject: {
                uuid: suite.uuid || 'unknown',
                description: suite.description || 'E2E Test Suite',
                title: suite.name || 'E2E Test Suite',
                status: suite.completed ? 'success' : 'running',
                object: suite
            },
            testResults: null,
            stepNumber: 0,
            completed: suite.completed || false,
            status: suite.completed ? 'success' : 'running',
            steps: [],
            tests: [],
            handlePollUpdate: handlePollUpdateFn
        };
    }

    updateStep(label: string, status: Status): void {
        this.state = TerminalFormatter.updateStep(this.state, label, status);
        this.formatter.printState(this.state);
    }

    addStep(label: string, status: Status = 'pending', details?: string): void {
        this.state = TerminalFormatter.addStep(this.state, label, status, details);
        this.formatter.printState(this.state);
    }

    formatMarkdownSummary(suite: E2eTestSuite): string {
        const header = chalk.bold(`🧪 Test Suite: ${suite.name ?? 'Unknown'}`);
        const description = chalk.dim(`Description: ${suite.description ?? "None"}`);
        const tests = suite.tests?.map(test => `- ${test.name ?? 'Unknown'}: ${(test as any).curRun?.outcome ?? "pending"}`).join("\n") ?? "No tests available";

        return `${header}\n${description}\n\nTests:\n\n${tests}`;
    }

    formatSuiteSummary(): string {
        const header = chalk.bold(`🧪 Test Suite: ${this.suite.name ?? 'Unknown'}`);
        const description = chalk.dim(`Description: ${this.suite.description ?? "None"}`);
        const tests = this.suite.tests?.map(test => `- ${test.name ?? 'Unknown'}: ${(test as any).curRun?.outcome ?? ""}`).join("\r\n") ?? "No tests available";

        return `${header}\r\n${description}\r\nTests:\r\n${tests}`;
    }

    printToTestRun(suite?: E2eTestSuite | null): void {
        if (suite) {
            this.suite = suite;
            this.state.testObject!.object = suite;
            this.state.completed = suite.completed || false;
            this.state.status = suite.completed ? 'success' : 'running';
        }
        
        // Clear steps and print current state
        this.state.steps = [];
        this.state.stepNumber = 0;
        this.formatter.printState(this.state);
    }

    printToSummarySection(suite: E2eTestSuite, testItem: vscode.TestItem | null): void {
        // Update state with completion
        this.state.completed = true;
        this.state.status = suite.completed ? 'success' : 'failed';
        
        // Print final state
        this.formatter.printState(this.state);
        
        // The summary section uses markdown not terminal output
        const markdown = new vscode.MarkdownString(
            `\n\n**🧪 E2E Test Completed**\n\n${this.formatMarkdownSummary(suite)}`
        );
        markdown.supportHtml = true;
        markdown.isTrusted = true;

        const duration = suite.completedAt ? new Date(suite.completedAt).getTime() - new Date(suite.timestamp).getTime() : 0;
        
        // Access the output channel through the formatter
        const outputChannel = this.formatter['outputChannel'] as any;
        
        if (testItem && outputChannel) {
            if (suite.completed) {
                outputChannel.passed(testItem, duration);
            } else {
                outputChannel.failed(testItem, new vscode.TestMessage(markdown), duration);
            }
        }

        if (outputChannel) {
            outputChannel.end();
        }
    }

    /**
     * Get the current test state
     */
    getState(): TestState {
        return { ...this.state };
    }

    /**
     * Update the test state
     */
    updateState(newState: Partial<TestState>): void {
        this.state = { ...this.state, ...newState };
        this.formatter.printState(this.state);
    }
}
