// src/ValidatorRunner.ts
import { PythonExtension } from "@vscode/python-extension";
import { spawn } from 'child_process';
import * as vscode from 'vscode';

// test-runner.ts
export interface FailureDetail {
    testName: string;
    message: string;
    location?: vscode.Location;
}

export interface RunResult {
    filePath: string;
    ok: boolean;                 // true = all passed
    durationMs?: number;         // if you have it
    failures: FailureDetail[];   // empty when ok === true
    stdout: string;              // raw runner output
    stderr: string;
}

async function getPythonCmd(resource: vscode.Uri): Promise<string> {
    try {
        // 1️⃣ Load the Python-extension API (activates it if necessary)
        const pyApi = await PythonExtension.api();
        // 2️⃣ Ask for the interpreter currently active for this workspace/folder
        const envPath = pyApi.environments.getActiveEnvironmentPath(resource);
        // `envPath.path` is sometimes a directory, sometimes the binary, so:
        const env = await pyApi.environments.resolveEnvironment(envPath);
        if (env?.executable?.uri) {
            return env.executable.uri.fsPath;        // ✔ full path into the venv’s /bin or /Scripts
        }
        return envPath?.path ?? "python";
    } catch {
        /* Fallbacks if Python extension is absent or something goes wrong */
        const cfg = vscode.workspace.getConfiguration("python", resource);
        return (
            cfg.get<string>("defaultInterpreterPath") ||   // modern setting
            cfg.get<string>("pythonPath") ||               // legacy
            "python"
        );
    }
}

export class ValidatorRunner {
    private static controller: vscode.TestController | undefined;

    /** Lazily create (or reuse) the controller so VS Code only shows one “DebuggAI Tests” tree */
    private getController(): vscode.TestController {
        if (!ValidatorRunner.controller) {
            ValidatorRunner.controller = vscode.tests.createTestController(
                'debuggaiTests',
                'DebuggAI Tests'
            );
        }
        return ValidatorRunner.controller;
    }

    /**
     * Run Jest/Mocha/whatever for a single file *quietly* in the background.
     * @param filePath absolute path of the file to test
     */
    async runTests(filePath: string): Promise<RunResult> {
        const ctrl = this.getController();
        const request = new vscode.TestRunRequest();          // no explicit TestItems → run profile-style
        const run = ctrl.createTestRun(request);

        // inside runTests()
        const ext = vscode.Uri.file(filePath).path.split('.').pop()?.toLowerCase();

        let result: RunResult;
        if (ext === 'py') {
            // result = await this.runPythonTests(...);
            result = await this.runDjangoTests(filePath, run, ctrl);
        } else {
            result = await this.runJsTests(filePath, run, ctrl);
        }

        return result;
    }

    private async runJsTests(
        filePath: string,
        run: vscode.TestRun,
        ctrl: vscode.TestController,
    ): Promise<RunResult> {

        return new Promise((resolve) => {
            const tokenSource = new vscode.CancellationTokenSource();
            try {
                // Change this command to match your test runner
                const cp = spawn('npm', ['test', '--', filePath, '--json'], {
                    cwd: vscode.workspace.rootPath,
                    stdio: ['ignore', 'pipe', 'pipe'],
                });

                tokenSource.token.onCancellationRequested(() => cp.kill('SIGINT'));

                let raw = '';
                cp.stdout.on('data', d => (raw += d.toString()));

                let stdout = '';
                let stderr = '';
                cp.stdout.on('data', d => (stdout += d));
                cp.stderr.on('data', d => (stderr += d));

                cp.on('close', (code: number) => {
                    if (raw.trim().length === 0) {
                        run.appendOutput(`No JSON output - exit code ${code}\n`);
                        run.end();
                        return;
                    }

                    const results = JSON.parse(raw);
                    // Create minimal TestItem on-the-fly so the Test Explorer shows a green / red bullet
                    const itemId = vscode.Uri.file(filePath).toString();
                    const tItem =
                        ctrl.items.get(itemId) ??
                        ctrl.createTestItem(itemId, results.name ?? filePath, vscode.Uri.file(filePath));

                    run.enqueued(tItem);


                    // ---------- parse runner output ----------
                    let failures: FailureDetail[] = [];
                    let ok = (code === 0);

                    if (stdout.trim()) {
                        try {
                            const json = JSON.parse(stdout);
                            ok = json.success;
                            if (!ok) {
                                failures = [{
                                    testName: json.name ?? filePath,
                                    message: json.message ?? 'Test failed',
                                    // attach location if your JSON has it
                                }];
                            }
                        } catch { /* not JSON ⇒ fall back to exit code */ }
                    }

                    // ---------- update UI ----------
                    if (ok) {
                        run.passed(tItem);
                    } else {
                        failures.forEach(f => {
                            const msg = new vscode.TestMessage(f.message);
                            if (f.location) { msg.location = f.location; }
                            run.failed(tItem, msg);
                        });
                    }
                    run.end();

                    // ---------- give the full picture back ----------
                    resolve({
                        filePath,
                        ok,
                        durationMs: undefined,          // fill if your JSON provides it
                        failures,
                        stdout,
                        stderr,
                    });
                });
            } catch (err) {
                run.appendOutput(String(err) + '\n');
                run.end();
            }
        });
    }

    /**
     * Run an arbitrary Python test-file with **pytest** (or fallback to exit-code)
     * and return a structured `RunResult` while still updating the VS Code
     * Testing UI.
     *
     * Requires the plugin `pytest-json-report` (`pip install pytest-json-report`)
     * so we can parse rich results from stdout.
     */
    private async runPythonTests(
        filePath: string,
        run: vscode.TestRun,
        ctrl: vscode.TestController,
    ): Promise<RunResult> {

        /* which interpreter is selected in VS Code’s status-bar? */
        const pythonCmd = await getPythonCmd(vscode.Uri.file(filePath));

        // ────────────────── create/queue a TestItem ──────────────────
        const itemId = vscode.Uri.file(filePath).toString();
        const tItem =
            ctrl.items.get(itemId) ??
            ctrl.createTestItem(itemId, filePath.split(/[\\/]/).pop()!, vscode.Uri.file(filePath));

        run.enqueued(tItem);

        // ────────────────── spawn pytest (JSON report → stdout) ──────────────────
        return new Promise<RunResult>((resolve) => {
            const cp = spawn(
                pythonCmd,
                [
                    '-m', 'pytest',
                    filePath,
                    '--json-report',
                    '--json-report-file', '-'    // “-” = write JSON to stdout
                ],
                { cwd: vscode.workspace.rootPath, stdio: ['ignore', 'pipe', 'pipe'] }
            );

            let stdout = '';
            let stderr = '';

            cp.stdout.on('data', d => {
                const txt = d.toString();
                stdout += txt;
                run.appendOutput(txt);          // mirror live output to panel
            });
            cp.stderr.on('data', d => {
                const txt = d.toString();
                stderr += txt;
                run.appendOutput(txt);
            });

            cp.on('close', (code: number) => {
                let ok = code === 0;
                let durationMs: number | undefined;
                const failures: FailureDetail[] = [];

                /* ─── try to parse JSON report ─────────────────────────── */
                try {
                    const report = JSON.parse(stdout);
                    ok = report.exitcode === 0;
                    durationMs = Math.round((report.duration ?? 0) * 1000);

                    for (const t of report.tests ?? []) {
                        if (t.outcome !== 'passed') {
                            failures.push({
                                testName: t.nodeid,
                                message: (t.call?.longrepr ?? t.outcome) as string,
                                // pytest’s JSON doesn’t include exact line numbers by default
                            });
                        }
                    }
                } catch {
                    /* not JSON (plugin missing?) – fall back to exit-code only */
                    if (!ok) {
                        failures.push({
                            testName: filePath,
                            message: `pytest exited with code ${code}`,
                        });
                    }
                }

                /* ─── update Test Explorer UI ──────────────────────────── */
                if (ok) {
                    run.passed(tItem, durationMs);
                } else {
                    failures.forEach(f => run.failed(tItem, new vscode.TestMessage(f.message), durationMs));
                }
                run.end();

                /* ─── hand structured data back to caller ─────────────── */
                resolve({
                    filePath,
                    ok,
                    durationMs,
                    failures,
                    stdout,
                    stderr,
                });
            });
        });
    }
    
    /**
     * Execute `manage.py test <dottedPath>` and return a rich summary.
     * Everything printed to stdout OR stderr is accumulated in `output`.
     */
    private async runDjangoTests(
        filePath: string,
        run: vscode.TestRun,
        ctrl: vscode.TestController,
    ): Promise<RunResult> {

        /** currently-selected interpreter in VS Code’s status-bar */
        const pythonCmd = await getPythonCmd(vscode.Uri.file(filePath));

        /* convert “…/app/tests/test_models.py” → “app.tests.test_models” */
        const relative = filePath.replace(vscode.workspace.rootPath || '', '');
        const dottedPath = relative
            .replace(/\.py$/, '')
            .split(/[\\/]/)
            .filter(Boolean)
            .join('.');

        /** VS Code TestItem plumbing (so the Explorer shows red/green) */
        const itemId = vscode.Uri.file(filePath).toString();
        const tItem =
            ctrl.items.get(itemId) ??
            ctrl.createTestItem(itemId, filePath.split(/[\\/]/).pop()!, vscode.Uri.file(filePath));
        run.enqueued(tItem);

        /* run Django’s test runner */
        return new Promise<RunResult>((resolve) => {

            const cp = spawn(
                pythonCmd,
                ['manage.py', 'test', dottedPath, '--no-input', '--verbosity', '2'],
                { cwd: vscode.workspace.rootPath, stdio: ['ignore', 'pipe', 'pipe'] }
            );

            /*  collect EVERYTHING that hits stdout or stderr  */
            let stdout = '';
            let stderr = '';
            let output = '';          // merged (for easier parsing & return)

            const grab = (chunk: Buffer | string) => {
                const txt = chunk.toString();
                output += txt;
                run.appendOutput(txt);          // live mirror to panel
            };

            cp.stdout.on('data', d => { stdout += d.toString(); grab(d); });
            cp.stderr.on('data', d => { stderr += d.toString(); grab(d); });

            cp.on('close', (code: number) => {
                const ok = code === 0;
                const failures: FailureDetail[] = [];

                if (!ok) {
                    /* very simple extract: everything between first “ERROR/FAIL” and summary */
                    const match = output.match(/(FAIL|ERROR)[\s\S]*/);
                    failures.push({
                        testName: dottedPath,
                        message: match ? match[0] : output.trim(), // full trace if no match
                    });
                }

                /* update UI */
                if (ok) {
                    run.passed(tItem);
                } else {
                    run.failed(tItem, new vscode.TestMessage(failures[0].message));
                }
                run.end();

                /* return structured summary */
                resolve({
                    filePath,
                    ok,
                    durationMs: undefined,
                    failures,
                    stdout,
                    stderr,
                    // add everything merged if that’s easier for callers:
                    // output,
                });
            });
        });
    }


    // getFileProblems()
    public getFileProblems(uri: vscode.Uri): vscode.Diagnostic[] {
        // Returns an array of Diagnostic objects (errors, warnings, infos, hints)
        return vscode.languages.getDiagnostics(uri);
    }

    // Example: fetch problems for the active editor’s file
    public getActiveFileProblems(): void {
        const active = vscode.window.activeTextEditor;
        if (active) {
            const problems = this.getFileProblems(active.document.uri);
            problems.forEach(d => {
                console.log(
                    `${vscode.DiagnosticSeverity[d.severity]}: ${d.message} ` +
                    `(${d.range.start.line + 1}:${d.range.start.character + 1})`
                );
            });
        }
    }
}

export default ValidatorRunner;
