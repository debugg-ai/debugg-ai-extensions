import boxen from "boxen";
import chalk from "chalk";
import type { ConfigHandler } from "../../config/ConfigHandler.js";
import type { E2eRun, E2eTest } from "../../debuggAIServer/types";
import type { IDE, TestRun } from "../../index.js";


type StepStatus = 'pending' | 'success' | 'error' | 'failed' | 'skipped';

interface Step {
    label: string;
    status: StepStatus;
}


export class TestRunFormatter {
    private readonly ide: IDE;
    private readonly configHandler: ConfigHandler;
    private testRun: TestRun;
    private steps: Step[] = [];

    constructor(testRun: TestRun, ide: IDE, configHandler: ConfigHandler) {
        this.ide = ide;
        this.configHandler = configHandler;
        this.testRun = testRun;
    }
    private passed(result: E2eRun): boolean {
        return result.status === "completed" && result.outcome === "pass";
    }

    private formatFailures(result: E2eRun): string {
        if (this.passed(result) || !result.outcome) return "";

        return chalk.red.bold("\r\n❌ Failures:") + "\r\n" + chalk.red(`> ${result.outcome}`);
    }

    private formatStepsAsMarkdown(): string {
        if (this.steps.length === 0) return "";

        return (
            "\n\n" +
            this.steps
                .map((s, idx) => {
                    const num = chalk.dim(`Step ${idx + 1}:`);
                    const label = chalk.white(s.label.padEnd(30));
                    const icon = chalk.green("✅ Success")
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
        this.testRun.appendOutput("\x1Bc"); // ANSI clear screen
        this.testRun.appendOutput(
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

    /*
    Print the test run to the test run.
    */
    printToTestRun(result: E2eTest | null): void {
        if (result?.curRun) {
            this.testRun.appendOutput(this.formatTerminalBox(result.curRun));
        }
    }

    printToSummarySection(result: E2eTest | null): void {
        if (result?.curRun) {
            this.testRun.appendOutput(this.formatTerminalBox(result.curRun));
        }
    }
    /*
    Format the test run to a terminal box.
    */
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

    formatMarkdownSummary(test: E2eTest | null): string {
        if (!test?.curRun) return "";

        const result = test.curRun;

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
}
