import chalk from "chalk";
import type { E2eTestSuite } from "core/debuggAIServer/types";
import * as vscode from "vscode";


type StepStatus = 'pending' | 'success' | 'error' | 'failed' | 'skipped';

interface Step {
    label: string;
    status: StepStatus;
}

export class SuiteGenFormatter {
    private runVsTestRunner: vscode.TestRun;
    private suite: E2eTestSuite;
    private steps: Step[] = [];

    constructor(runVsTestRunner: vscode.TestRun, suite: E2eTestSuite) {
        this.runVsTestRunner = runVsTestRunner;
        this.suite = suite;
    }

    updateStep(label: string, status: StepStatus): void {
        const existing = this.steps.find((s) => s.label === label);
        if (existing) {
            existing.status = status;
        } else {
            this.steps.push({ label, status });
        }

        console.log('updating step. steps ->', this.steps);

        // Clear terminal and redraw
        this.runVsTestRunner.appendOutput("\x1Bc"); // ANSI clear screen
        this.runVsTestRunner.appendOutput(
            chalk.bold("🧪 E2E Test Progress") +
            `\r\n${this.steps
                .map((s, i) => {
                    const icon =
                        s.status === "pending"
                            ? chalk.yellow("⏳")
                            : s.status === "success"
                                ? chalk.green("✅")
                                : chalk.red("❌");
                    return `${chalk.dim(`Step ${i + 1}:`)} ${s.label.padEnd(
                        30
                    )} ${icon}`;
                })
                .join("\r\n")}`
        );
    }

    formatMarkdownSummary(suite: E2eTestSuite): string {
        const header = chalk.bold(`🧪 Test Suite: ${suite.name}`);
        const description = chalk.dim(`Description: ${suite.description ?? "None"}`);
        const tests = suite.tests?.map(test => `- ${test.name}: ${test.curRun?.outcome ?? "pending"}`).join("\n") ?? "No tests available";

        return `${header}\n${description}\n\nTests:\n\n${tests}`;
    }
    formatSuiteSummary(): string {
        const header = chalk.bold(`🧪 Test Suite: ${this.suite.name}`);
        const description = chalk.dim(`Description: ${this.suite.description ?? "None"}`);
        const tests = this.suite.tests?.map(test => `- ${test.name}: ${test.curRun?.outcome ?? "pending"}`).join("\r\n") ?? "No tests available";

        return `${header}\r\n${description}\r\nTests:\r\n${tests}`;
    }
    printToTestRun(suite?: E2eTestSuite | null): void {
        if (suite) {
            this.suite = suite;
        }
        this.runVsTestRunner.appendOutput("\x1Bc"); // ANSI clear screen
        this.runVsTestRunner.appendOutput("\r\n");
        this.runVsTestRunner.appendOutput(this.formatSuiteSummary() + "\r\n");
    }

    printToSummarySection(suite: E2eTestSuite, testItem: vscode.TestItem | null): void {
        // The summary section uses markdown not terminal output

        const markdown = new vscode.MarkdownString(
            `\n\n**🧪 E2E Test Completed**\n\n${this.formatMarkdownSummary(suite)}`
        );
        markdown.supportHtml = true;
        markdown.isTrusted = true;

        const duration = suite.completedAt ? new Date(suite.completedAt).getTime() - new Date(suite.timestamp).getTime() : 0;
        if (testItem) {
            if (suite.completed) {
                this.runVsTestRunner.passed(testItem, duration);
            } else {
                this.runVsTestRunner.failed(testItem, new vscode.TestMessage(markdown), duration);
            }
        }

        this.runVsTestRunner.end();
    }
}
