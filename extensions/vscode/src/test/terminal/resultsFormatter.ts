import boxen from "boxen";
import chalk from "chalk";
import * as vscode from "vscode";

import type { E2eRun } from "core/debuggAIServer/types";


type StepStatus = 'pending' | 'success' | 'error' | 'failed' | 'skipped';

interface Step {
    label: string;
    status: StepStatus;
}

export class RunResultFormatter {
    // private terminal: vscode.Terminal;
    private runVsTestRunner: vscode.TestRun;
    private steps: Step[] = [];

    constructor(runVsTestRunner: vscode.TestRun) {
        this.runVsTestRunner = runVsTestRunner;
    }
    private passed(result: E2eRun): boolean {
        return result.status === "completed" && result.outcome === "pass";
    }

    private formatFailures(result: E2eRun): string {
        if (this.passed(result) || !result.outcome) {return "";}

        return chalk.red.bold("\r\n❌ Failures:") + "\r\n" + chalk.red(`> ${result.outcome}`);
    }

    private formatStepsAsMarkdown(): string {
        if (this.steps.length === 0) {return "";}

        return (
            "\n\n" +
            this.steps
                .map((s, idx) => {
                    const num = chalk.dim(`Step ${idx + 1}:`);
                    const label = chalk.white(s.label.padEnd(30));
                    const icon = chalk.green("✅ Success");
                        // s.status === "pending"
                        //     ? chalk.yellow("⏳ Pending")
                        //     : s.status === "success"
                        //         ? chalk.green("✅ Success")
                        //         : chalk.red("❌ Failed");

                    return `${num} ${label} ${icon}`;
                })
                .join("\n\n")
        );
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

    formatTerminalBox(result: E2eRun): string {
        const header = this.passed(result)
            ? chalk.green.bold("✅ Test Passed")
            : chalk.red.bold("❌ Test Failed");

        const body = [
            chalk.bold("Test: ") + result.test?.name,
            chalk.bold("Description: ") + (result.test?.description ?? "None"),
            chalk.bold("Duration: ") + `${result.metrics?.executionTime ?? 0}s`,
            chalk.bold("Status: ") + result.status,
            chalk.bold("Outcome: ") + result.outcome,
            this.formatStepsAsMarkdown(),
            this.passed(result) ? "" : this.formatFailures(result),
        ]
            .filter(Boolean)
            .join("\n");

        return boxen(`${header}\r\n${body}`, {
            padding: 1,
            borderStyle: "round",
            borderColor: this.passed(result) ? "green" : "red",
        });
    }

    formatMarkdownSummary(result: E2eRun): string {
        return [
            `🧪 **Test Name:** ${result.test?.name ?? "Unknown"}`,
            `📄 **Description:** ${result.test?.description ?? "None"}`,
            `⏱ **Duration:** ${result.metrics?.executionTime ?? 0}s`,
            `🔎 **Status:** ${result.status}`,
            `📊 **Outcome:** ${result.outcome}`,
            this.formatStepsAsMarkdown(),
            this.formatFailures(result),
        ]
            .filter(Boolean)
            .join("\n")
            .trim();
    }

    /*
    Terminal uses different formatting than markdown.
    */
    terminalSummary(result: E2eRun): string {
        return [
            `🧪 Test Name: ${result.test?.name ?? "Unknown"}`,
            `📄 Description: ${result.test?.description ?? "None"}`,
            `⏱ Duration: ${result.metrics?.executionTime ?? 0}s`,
            `🔎 Status: ${result.status}`,
            `📊 Outcome: ${result.outcome}`,
            this.formatFailures(result),
        ]
            .filter(Boolean)
            .join("\r\n")
            .trim();
    }
    appendToTestRun(result: E2eRun, run: vscode.TestRun, testItem: vscode.TestItem): void {
        const markdown = new vscode.MarkdownString(
            `\n\n**🧪 E2E Test Completed**\n\n${this.formatMarkdownSummary(result)}`
        );
        markdown.supportHtml = true;
        markdown.isTrusted = true;

        run.appendOutput("\r\n");
        run.appendOutput(this.terminalSummary(result) + "\r\n");

        if (this.passed(result)) {
            run.passed(testItem, result.metrics?.executionTime ?? 0);
        } else {
            run.failed(testItem, new vscode.TestMessage(markdown), result.metrics?.executionTime ?? 0);
        }

        run.end();
    }

}
