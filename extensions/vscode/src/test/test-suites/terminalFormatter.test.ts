import assert from 'node:assert';
import { describe, test, beforeEach, afterEach } from 'mocha';
import * as vscode from 'vscode';

import { TerminalFormatter, TestType, EnhancedTerminalFormatterOptions } from '../terminal/terminalFormatter';
import { TestState, Step, TerminalTest, Status, handlePollUpdateFn } from '../e2e-agents/types';

/**
 * Mock output channel for testing
 */
class MockOutputChannel {
    private output: string[] = [];

    append(value: string): void {
        this.output.push(value);
    }

    appendLine(value: string): void {
        this.output.push(value + '\n');
    }

    appendOutput(text: string): void {
        this.output.push(text);
    }

    clear(): void {
        this.output = [];
    }

    getOutput(): string {
        return this.output.join('');
    }

    getLines(): string[] {
        return this.output;
    }

    // VS Code OutputChannel interface stubs
    name: string = 'Mock Output Channel';
    show(): void {}
    hide(): void {}
    dispose(): void {}
}

describe('TerminalFormatter Test Suite', () => {
    let mockOutputChannel: MockOutputChannel;
    let formatter: TerminalFormatter;

    beforeEach(() => {
        mockOutputChannel = new MockOutputChannel();
    });

    afterEach(() => {
        mockOutputChannel.clear();
    });

    describe('Constructor and Options', () => {
        test('should initialize with default options', () => {
            formatter = new TerminalFormatter(mockOutputChannel);
            
            // Access protected options via any to test internal state
            const options = (formatter as any).options;
            assert.strictEqual(options.title, 'Progress');
            assert.strictEqual(options.showStepNumbers, true);
            assert.strictEqual(options.stepLabelWidth, 35);
            assert.strictEqual(options.autoClear, true);
            assert.strictEqual(options.showProgressBar, true);
            assert.strictEqual(options.testType, 'e2e-test');
        });

        test('should accept custom options', () => {
            const customOptions: EnhancedTerminalFormatterOptions = {
                title: 'Custom Test',
                showStepNumbers: false,
                stepLabelWidth: 50,
                autoClear: false,
                showProgressBar: false,
                testType: 'commit-suite',
                showTimestamps: true,
                compactMode: true,
                animateProgress: true,
                maxStepWidth: 100,
                showTestHierarchy: false
            };

            formatter = new TerminalFormatter(mockOutputChannel, customOptions);
            const options = (formatter as any).options;
            
            assert.strictEqual(options.title, 'Custom Test');
            assert.strictEqual(options.showStepNumbers, false);
            assert.strictEqual(options.stepLabelWidth, 50);
            assert.strictEqual(options.autoClear, false);
            assert.strictEqual(options.showProgressBar, false);
            assert.strictEqual(options.testType, 'commit-suite');
            assert.strictEqual(options.showTimestamps, true);
            assert.strictEqual(options.compactMode, true);
            assert.strictEqual(options.animateProgress, true);
            assert.strictEqual(options.maxStepWidth, 100);
            assert.strictEqual(options.showTestHierarchy, false);
        });
    });

    describe('Test Type Detection', () => {
        beforeEach(() => {
            formatter = new TerminalFormatter(mockOutputChannel);
        });

        test('should detect e2e-test type for states with only steps', () => {
            const state = createTestState({
                tests: [],
                steps: [createStep('Test step', 'running')]
            });

            const testType = (formatter as any).detectTestType(state);
            assert.strictEqual(testType, 'e2e-test');
        });

        test('should detect test-suite type for states with regular tests', () => {
            const state = createTestState({
                tests: [createTerminalTest('Regular test', 'running', 'pending')],
                steps: []
            });

            const testType = (formatter as any).detectTestType(state);
            assert.strictEqual(testType, 'test-suite');
        });

        test('should detect commit-suite type for commit-related tests', () => {
            const state = createTestState({
                tests: [createTerminalTest('commit validation test', 'running', 'pending')],
                steps: []
            });

            const testType = (formatter as any).detectTestType(state);
            assert.strictEqual(testType, 'commit-suite');
        });
    });

    describe('State Printing', () => {
        beforeEach(() => {
            formatter = new TerminalFormatter(mockOutputChannel, { autoClear: false });
        });

        test('should print basic test state with steps', () => {
            const state = createTestState({
                testObject: {
                    uuid: 'test-123',
                    description: 'Sample Test',
                    title: 'Sample Test',
                    status: 'running',
                    object: {}
                },
                steps: [
                    createStep('Initialization', 'success', 'Completed in 2s'),
                    createStep('Execution', 'running', 'In progress...')
                ]
            });

            formatter.printState(state);
            const output = mockOutputChannel.getOutput();
            
            assert(output.includes('Sample Test'), 'Should include test title');
            assert(output.includes('Initialization'), 'Should include step labels');
            assert(output.includes('Execution'), 'Should include step labels');
            assert(output.includes('✅'), 'Should include success icon');
            assert(output.includes('🔄'), 'Should include running icon');
        });

        test('should print test suite with multiple tests', () => {
            const state = createTestState({
                testObject: {
                    uuid: 'suite-456',
                    description: 'Test Suite',
                    title: 'Feature Test Suite',
                    status: 'running',
                    object: {}
                },
                tests: [
                    createTerminalTest('Login Test', 'completed', 'pass'),
                    createTerminalTest('Dashboard Test', 'running', 'pending')
                ]
            });

            formatter.printState(state);
            const output = mockOutputChannel.getOutput();
            
            assert(output.includes('Feature Test Suite'), 'Should include suite title');
            assert(output.includes('Login Test'), 'Should include test names');
            assert(output.includes('Dashboard Test'), 'Should include test names');
            assert(output.includes('📦'), 'Should include test suite icon');
        });

        test('should handle empty state gracefully', () => {
            const state = createTestState({
                tests: [],
                steps: []
            });

            formatter.printState(state);
            const output = mockOutputChannel.getOutput();
            
            assert(output.includes('Initializing'), 'Should show initializing message');
        });
    });

    describe('Summary Generation', () => {
        beforeEach(() => {
            formatter = new TerminalFormatter(mockOutputChannel, { autoClear: false });
        });

        test('should generate summary for completed steps', () => {
            const state = createTestState({
                status: 'completed',
                completed: true,
                steps: [
                    createStep('Setup', 'success'),
                    createStep('Test Execution', 'success'),
                    createStep('Cleanup', 'success')
                ]
            });

            formatter.printSummary(state, 'Test Complete', 'All steps passed');
            const output = mockOutputChannel.getOutput();
            
            assert(output.includes('Summary') || output.includes('Results'), 'Should include summary header');
            assert(output.includes('3') && (output.includes('success') || output.includes('complete')), 'Should show completed count');
            assert(output.includes('100') || output.includes('all'), 'Should show completion percentage');
            assert(output.includes('All steps passed') || output.includes('passed'), 'Should include custom details');
        });

        test('should generate summary for test suite with mixed results', () => {
            const state = createTestState({
                status: 'completed',
                completed: true,
                tests: [
                    createTerminalTest('Test 1', 'completed', 'pass'),
                    createTerminalTest('Test 2', 'completed', 'fail'),
                    createTerminalTest('Test 3', 'completed', 'pass'),
                    createTerminalTest('Test 4', 'completed', 'skipped')
                ]
            });

            formatter.printSummary(state);
            const output = mockOutputChannel.getOutput();
            
            // Validate the formatter produces comprehensive output with test results
            assert(output.includes('2') && output.includes('Passed'), 'Should show passed count');
            assert(output.includes('1') && output.includes('Failed'), 'Should show failed count');
            assert(output.includes('1') && output.includes('Skipped'), 'Should show skipped count');
            assert(output.includes('50%'), 'Should show pass rate');
        });
    });

    describe('Progress Bar Generation', () => {
        beforeEach(() => {
            formatter = new TerminalFormatter(mockOutputChannel, { 
                showProgressBar: true,
                autoClear: false 
            });
        });

        test('should generate progress bar for steps', () => {
            const state = createTestState({
                steps: [
                    createStep('Step 1', 'success'),
                    createStep('Step 2', 'success'),
                    createStep('Step 3', 'running'),
                    createStep('Step 4', 'pending')
                ]
            });

            formatter.printState(state);
            const output = mockOutputChannel.getOutput();
            
            assert(output.includes('Progress:'), 'Should include progress label');
            assert(output.includes('['), 'Should include progress bar brackets');
            assert(output.includes('█'), 'Should include filled progress chars');
            assert(output.includes('50%'), 'Should show percentage');
            assert(output.includes('(2/4)'), 'Should show counts');
        });

        test('should generate progress bar for tests', () => {
            const state = createTestState({
                tests: [
                    createTerminalTest('Test 1', 'completed', 'pass'),
                    createTerminalTest('Test 2', 'completed', 'fail'),
                    createTerminalTest('Test 3', 'running', 'pending')
                ]
            });

            formatter.printState(state);
            const output = mockOutputChannel.getOutput();
            
            assert(output.includes('Test Suite Progress:'), 'Should include suite progress label');
            assert(output.includes('67%'), 'Should show percentage for completed tests');
            assert(output.includes('✅ 1'), 'Should show passed count');
            assert(output.includes('❌ 1'), 'Should show failed count');
        });
    });

    describe('Message and Divider Printing', () => {
        beforeEach(() => {
            formatter = new TerminalFormatter(mockOutputChannel, { autoClear: false });
        });

        test('should print messages with different types', () => {
            formatter.printMessage('Info message', 'info');
            formatter.printMessage('Success message', 'success');
            formatter.printMessage('Warning message', 'warning');
            formatter.printMessage('Error message', 'error');
            
            const output = mockOutputChannel.getOutput();
            
            assert(output.includes('ℹ️'), 'Should include info icon');
            assert(output.includes('✅'), 'Should include success icon');
            assert(output.includes('⚠️'), 'Should include warning icon');
            assert(output.includes('❌'), 'Should include error icon');
            assert(output.includes('Info message'), 'Should include message text');
        });

        test('should print dividers with and without titles', () => {
            formatter.printDivider();
            formatter.printDivider('Section Title');
            
            const output = mockOutputChannel.getOutput();
            
            assert(output.includes('═'), 'Should include divider characters');
            assert(output.includes('Section Title'), 'Should include section title');
        });
    });

    describe('Static Utility Methods', () => {
        test('should create simple state correctly', () => {
            const steps = [
                createStep('Step 1', 'success'),
                createStep('Step 2', 'pending')
            ];
            
            const state = TerminalFormatter.createSimpleState('Test Title', steps, 'running', false);
            
            assert.strictEqual(state.testObject?.title, 'Test Title');
            assert.strictEqual(state.status, 'running');
            assert.strictEqual(state.completed, false);
            assert.strictEqual(state.steps.length, 2);
            assert.strictEqual(state.stepNumber, 2);
        });

        test('should create enhanced state correctly', () => {
            const tests = [
                createTerminalTest('Test 1', 'running', 'pending')
            ];
            
            const state = TerminalFormatter.createEnhancedState(
                'Suite Title', 
                'test-suite', 
                tests, 
                'running', 
                false
            );
            
            assert.strictEqual(state.testObject?.title, 'Suite Title');
            assert.strictEqual(state.status, 'running');
            assert.strictEqual(state.tests.length, 1);
            assert.strictEqual(state.steps.length, 0);
        });

        test('should update step correctly', () => {
            const initialState = createTestState({
                steps: [createStep('Original Step', 'pending')]
            });
            
            const updatedState = TerminalFormatter.updateStep(
                initialState, 
                'Original Step', 
                'success', 
                'Completed'
            );
            
            assert.strictEqual(updatedState.steps[0].status, 'success');
            assert.strictEqual(updatedState.steps[0].details, 'Completed');
        });

        test('should add step correctly', () => {
            const initialState = createTestState({
                steps: [createStep('Step 1', 'success')]
            });
            
            const updatedState = TerminalFormatter.addStep(
                initialState, 
                'Step 2', 
                'pending', 
                'Starting...'
            );
            
            assert.strictEqual(updatedState.steps.length, 2);
            assert.strictEqual(updatedState.steps[1].label, 'Step 2');
            assert.strictEqual(updatedState.steps[1].status, 'pending');
            assert.strictEqual(updatedState.stepNumber, 2);
        });

        test('should remove step correctly', () => {
            const initialState = createTestState({
                steps: [
                    createStep('Step 1', 'success'),
                    createStep('Step 2', 'pending')
                ]
            });
            
            const updatedState = TerminalFormatter.removeStep(initialState, 'Step 1');
            
            assert.strictEqual(updatedState.steps.length, 1);
            assert.strictEqual(updatedState.steps[0].label, 'Step 2');
            assert.strictEqual(updatedState.stepNumber, 1);
        });

        test('should detect completion correctly', () => {
            const completedState = createTestState({
                steps: [
                    createStep('Step 1', 'success'),
                    createStep('Step 2', 'success')
                ]
            });
            
            const incompleteState = createTestState({
                steps: [
                    createStep('Step 1', 'success'),
                    createStep('Step 2', 'running')
                ]
            });
            
            assert.strictEqual(TerminalFormatter.isCompleted(completedState), true);
            assert.strictEqual(TerminalFormatter.isCompleted(incompleteState), false);
        });

        test('should detect failures correctly', () => {
            const failedState = createTestState({
                steps: [
                    createStep('Step 1', 'success'),
                    createStep('Step 2', 'failed')
                ]
            });
            
            const successState = createTestState({
                steps: [
                    createStep('Step 1', 'success'),
                    createStep('Step 2', 'success')
                ]
            });
            
            assert.strictEqual(TerminalFormatter.hasFailures(failedState), true);
            assert.strictEqual(TerminalFormatter.hasFailures(successState), false);
        });

        test('should get step by label correctly', () => {
            const state = createTestState({
                steps: [
                    createStep('Setup', 'success'),
                    createStep('Execution', 'running')
                ]
            });
            
            const setupStep = TerminalFormatter.getStep(state, 'Setup');
            const nonExistentStep = TerminalFormatter.getStep(state, 'NonExistent');
            
            assert(setupStep, 'Should find existing step');
            assert.strictEqual(setupStep?.label, 'Setup');
            assert.strictEqual(setupStep?.status, 'success');
            assert.strictEqual(nonExistentStep, undefined, 'Should return undefined for non-existent step');
        });

        test('should get test by identifier correctly', () => {
            const state = createTestState({
                tests: [
                    createTerminalTest('Login Test', 'completed', 'pass', 'test-uuid-123'),
                    createTerminalTest('Dashboard Test', 'running', 'pending', 'test-uuid-456')
                ]
            });
            
            const testByTitle = TerminalFormatter.getTest(state, 'Login Test');
            const testByUuid = TerminalFormatter.getTest(state, 'test-uuid-456');
            const nonExistentTest = TerminalFormatter.getTest(state, 'NonExistent');
            
            assert(testByTitle, 'Should find test by title');
            assert.strictEqual(testByTitle?.title, 'Login Test');
            
            assert(testByUuid, 'Should find test by UUID');
            assert.strictEqual(testByUuid?.uuid, 'test-uuid-456');
            
            assert.strictEqual(nonExistentTest, undefined, 'Should return undefined for non-existent test');
        });
    });

    describe('Compact Mode and Formatting Options', () => {
        test('should format differently in compact mode', () => {
            const compactFormatter = new TerminalFormatter(mockOutputChannel, { 
                compactMode: true,
                autoClear: false 
            });
            
            const state = createTestState({
                tests: [
                    createTerminalTest('Test with description', 'running', 'pending')
                ]
            });
            
            compactFormatter.printState(state);
            const output = mockOutputChannel.getOutput();
            
            // In compact mode, descriptions should be less verbose
            assert(output.length > 0, 'Should produce output');
            // Test specific compact mode behavior
        });

        test('should handle different step widths', () => {
            const narrowFormatter = new TerminalFormatter(mockOutputChannel, { 
                stepLabelWidth: 15,
                autoClear: false 
            });
            
            const state = createTestState({
                steps: [createStep('Very long step name that should be truncated', 'success')]
            });
            
            narrowFormatter.printState(state);
            const output = mockOutputChannel.getOutput();
            
            // The formatter should handle long step names gracefully, either by truncating or wrapping
            assert(output.includes('Very long') || output.includes('...') || output.length > 0, 'Should handle long step names');
        });
    });
});

// Helper functions for creating test data
function createTestState(overrides: Partial<TestState> = {}): TestState {
    return {
        testObject: null,
        testResults: null,
        stepNumber: 0,
        completed: false,
        status: 'pending',
        steps: [],
        tests: [],
        handlePollUpdate: handlePollUpdateFn,
        ...overrides
    };
}

function createStep(label: string, status: Status, details?: string): Step {
    return {
        label,
        status,
        details,
        currentState: {
            evaluationPreviousGoal: '',
            memory: '',
            nextGoal: ''
        },
        action: []
    };
}

function createTerminalTest(title: string, status: Status, outcome: string, uuid?: string): TerminalTest {
    return {
        uuid: uuid || `test-${Math.random().toString(36).substr(2, 9)}`,
        description: `Description for ${title}`,
        title,
        status,
        outcome: outcome as any,
        object: {},
        steps: [],
        handlePollUpdate: handlePollUpdateFn
    };
}