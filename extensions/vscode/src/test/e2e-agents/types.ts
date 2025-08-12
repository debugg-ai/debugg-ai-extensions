import * as vscode from 'vscode';

export type Status = 'completed' | 'pending' | 'success' | 'error' | 'failed' | 'skipped' | 'running';
export type Outcome = 'pending' | 'skipped' | 'unknown' | 'pass' | 'fail' | 'error';


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

/* 
    TestObject is the basic info needed to setup a 
    vscode test without restricting the type of test.
*/
export interface TestObject {
    uuid: string;
    description: string;
    title?: string;
    status: Status;
    object: any;
}

export interface TestResults {
    uuid: string;
    description: string;
    title?: string;
    results: any;
    formattedResults: string;
}

export interface TestHandlerOptions {
    testParams?: Record<string, any>;
    timeoutMinutes?: number;
    title?: string;
    showProgressBar?: boolean;
    stepLabelWidth?: number;
    pollingInterval?: number;
    testOutputDir?: string;
}

export interface RemoteTestHandlerOptions {
    remoteTunnelUrl?: string;
    localTunnelPort?: number;
    remoteTunnelKey?: string;
}

export type StepAction = {
    input_text: {
        index: number;
        text: string;
    } | {
        click_element_by_index: {
            index: number;
        };
    };
};


export interface Step {
    label: string;
    status: Status; // Status of the step, not the overall test.
    details?: string;
    currentState: {
        evaluationPreviousGoal: string;
        memory: string;
        nextGoal: string;
    };
    action: StepAction[];
}


export const handlePollUpdateFn = (steps: Step[], newStep: Step) => {
    if (steps.length === 0) {
        // If no steps, just add the new step
        return [newStep];
    } else if (steps[steps.length - 1]?.details === newStep?.details) {
        // If the last step is the same as the new step, update the last step
        return steps.map((step, index) => {
            if (index === steps.length - 1) {
                return newStep;
            }
            return step;
        });
    } else {
        // If the last step is not the same as the new step, add the new step
        return [...steps, newStep];
    }
};

export interface TerminalTest {
    uuid: string;
    description: string;
    title?: string;
    status: Status;
    outcome: Outcome;
    object: any;
    steps: Step[];
    handlePollUpdate: typeof handlePollUpdateFn;
}

/* 
    TestState is the current state of the test.
*/
export interface TestState {
    testObject: TestObject | null;
    testResults: TestResults | null;
    stepNumber: number;
    completed: boolean; // true = done, false = running
    status: Status;  // Overall status, not just the current step.
    tests: TerminalTest[];  // Tests that are being run.
    steps: Step[];
    handlePollUpdate: typeof handlePollUpdateFn;
}

export interface TerminalFormatterOptions {
    title?: string;
    showStepNumbers?: boolean;
    stepLabelWidth?: number;
    autoClear?: boolean;
    showProgressBar?: boolean;
}

export interface E2eTestHandlerOptions extends RemoteTestHandlerOptions {
    // E2E specific options can be added here
}

export interface E2eObjectCallbacks {
    createObject: (description?: string, params?: Record<string, any>) => Promise<TestObject>;
    pollObject: (uuid: string, params?: Record<string, any>) => Promise<TestObject>;
    parseStatusFromObject: (prevState: TestState, updatedObj: TestObject) => TestState;
}

export interface RepositoryInfo {
    repoName: string;
    repoPath: string;
    branchName: string;
    filePath: string;
}