import chalk from "chalk";
import type { ConfigHandler } from "../../config/ConfigHandler.js";
import type { E2eRun } from "../../debuggAIServer/types";
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
    private iconIndex = -1;

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

        const getLoadingIcon = () => {
            const icons = [
                "█▒▒▒▒▒▒▒▒▒",
                "██▒▒▒▒▒▒▒▒",
                "███▒▒▒▒▒▒▒",
                "████▒▒▒▒▒▒",
                "█████▒▒▒▒▒",
                "██████▒▒▒▒",
                "███████▒▒▒",
                "████████▒▒",
                "█████████▒",
                "██████████",
            ]
            this.iconIndex = (this.iconIndex + 1) % icons.length;
            return icons[this.iconIndex];
        }
        // Clear terminal and redraw
        this.testRun.appendOutput("\x1Bc"); // ANSI clear screen
        this.testRun.appendOutput(
            chalk.bold("🧪 E2E Test Progress") +
            `\r\n${this.steps
                .map((s, i) => {
                    const icon =
                        s.status === "pending"
                            ? chalk.yellow(getLoadingIcon())
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
    Format the test run information with a summary of the results,
    formatted specifically for the terminal. eg with \r\n instead of \n
    */
    formatRunSummaryForTerminal(result: E2eRun | null): string {
        if (!result) return "";

        const outcomeDisplay = this.passed(result)
            ? chalk.green.bold("✅ Test Passed")
            : chalk.red.bold("❌ Test Failed");

        return [
            `🧪 Test Name: ${result.test?.name ?? "Unknown"}`,
            `📄 Description: ${result.test?.description ?? "None"}`,
            `⏱ Duration: ${result.metrics?.executionTime ?? 0}s`,
            `🔎 Status: ${result.status}`,
            `📊 Outcome: ${outcomeDisplay}`,
            this.formatFailures(result),
        ]
            .filter(Boolean)
            .join("\r\n")
            .trim();
    }

    /*
    Format the test run information with a summary of the results,
    formatted specifically for the markdown.
    */
    formatRunSummaryForMarkdown(e2eRun: E2eRun | null): string {
        if (!e2eRun) return "";

        const result = e2eRun;

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
}
