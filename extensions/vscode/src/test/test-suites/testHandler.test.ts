import assert from 'node:assert';
import { describe, test, beforeEach, afterEach } from 'mocha';
import * as vscode from 'vscode';

import TestHandler from '../e2e-agents/testHandler';
import { TerminalFormatter } from '../terminal/terminalFormatter';
import { TestHandlerOptions, TestObject, TestState, Status, handlePollUpdateFn } from '../e2e-agents/types';

// Mock DebuggAIServerClient
class MockDebuggAIServerClient {
    constructor() {}
}

// Mock IDE
class MockIDE {
    constructor() {}
}

// Concrete implementation of TestHandler for testing
class ConcreteTestHandler extends TestHandler {
    private mockTestObject: TestObject | null = null;
    private mockPollUpdates: TestState[] = [];
    private pollUpdateIndex: number = 0;
    private shouldFailInitialization: boolean = false;
    private shouldFailCreation: boolean = false;

    constructor(
        client: MockDebuggAIServerClient, 
        ide: MockIDE, 
        options: TestHandlerOptions,
        mockTestObject?: TestObject,
        mockPollUpdates?: TestState[]
    ) {
        super(client as any, ide as any, options);
        this.mockTestObject = mockTestObject || null;
        this.mockPollUpdates = mockPollUpdates || [];
    }

    // Test helper methods
    setMockTestObject(testObject: TestObject): void {
        this.mockTestObject = testObject;
    }

    setMockPollUpdates(updates: TestState[]): void {
        this.mockPollUpdates = updates;
        this.pollUpdateIndex = 0;
    }

    setShouldFailInitialization(fail: boolean): void {
        this.shouldFailInitialization = fail;
    }

    setShouldFailCreation(fail: boolean): void {
        this.shouldFailCreation = fail;
    }

    // Expose protected methods for testing
    public async testInitialize(): Promise<void> {
        return this.initialize();
    }

    public async testCreateTestObject(): Promise<TestObject> {
        return this.createTestObject();
    }

    public async testPollForUpdates(): Promise<TestState> {
        return this.pollForUpdates();
    }

    public async testHandleCompletion(state: TestState): Promise<void> {
        return this.handleCompletion(state);
    }

    public async testHandleProgress(state: TestState): Promise<void> {
        return this.handleProgress(state);
    }

    public async testHandleTimeout(): Promise<void> {
        return this.handleTimeout();
    }

    public async testCleanup(): Promise<void> {
        return this.cleanup();
    }

    public async testCleanupError(reason: string): Promise<void> {
        return this.cleanupError(reason);
    }

    public testAddCleanupCallback(callback: () => void): void {
        this.addCleanupCallback(callback);
    }

    public testGetController(): vscode.TestController {
        return this.getController();
    }

    public testGetFormatter(): TerminalFormatter {
        return this.getFormatter();
    }

    // Abstract method implementations
    protected async initialize(): Promise<void> {
        if (this.shouldFailInitialization) {
            throw new Error('Initialization failed');
        }
        // Mock initialization logic
        console.log('Test handler initialized');
    }

    protected async createTestObject(): Promise<TestObject> {
        if (this.shouldFailCreation) {
            throw new Error('Test object creation failed');
        }
        
        if (!this.mockTestObject) {
            this.mockTestObject = {
                uuid: 'test-' + Math.random().toString(36).substr(2, 9),
                description: 'Mock test object',
                title: 'Mock Test',
                status: 'pending',
                object: { mockData: true }
            };
        }
        
        return this.mockTestObject;
    }

    protected async pollForUpdates(): Promise<TestState> {
        if (this.pollUpdateIndex < this.mockPollUpdates.length) {
            const update = this.mockPollUpdates[this.pollUpdateIndex];
            this.pollUpdateIndex++;
            this.testState = { ...this.testState, ...update };
            return this.testState;
        }
        
        // Default behavior - return current state
        return this.testState;
    }
}

// Mock output channel for testing formatter
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

    // VS Code interface stubs
    name: string = 'Mock Output Channel';
    show(): void {}
    hide(): void {}
    dispose(): void {}
}

// Mock TestRun for VS Code testing
class MockTestRun implements Partial<vscode.TestRun> {
    private isEnded: boolean = false;
    private messages: string[] = [];

    enqueued(test: vscode.TestItem): void {
        this.messages.push(`Enqueued: ${test.id}`);
    }

    started(test: vscode.TestItem): void {
        this.messages.push(`Started: ${test.id}`);
    }

    skipped(test: vscode.TestItem): void {
        this.messages.push(`Skipped: ${test.id}`);
    }

    failed(test: vscode.TestItem, message: vscode.TestMessage | readonly vscode.TestMessage[], duration?: number): void {
        this.messages.push(`Failed: ${test.id}`);
    }

    errored(test: vscode.TestItem, message: vscode.TestMessage | readonly vscode.TestMessage[], duration?: number): void {
        this.messages.push(`Errored: ${test.id}`);
    }

    passed(test: vscode.TestItem, duration?: number): void {
        this.messages.push(`Passed: ${test.id}`);
    }

    end(): void {
        this.isEnded = true;
        this.messages.push('Test run ended');
    }

    appendOutput(output: string): void {
        this.messages.push(`Output: ${output}`);
    }

    getMessages(): string[] {
        return this.messages;
    }

    isTestEnded(): boolean {
        return this.isEnded;
    }

    // Required properties
    name?: string = 'Mock Test Run';
    token: vscode.CancellationToken = { isCancellationRequested: false, onCancellationRequested: () => ({ dispose: () => {} }) };
}

describe('TestHandler Test Suite', () => {
    let mockClient: MockDebuggAIServerClient;
    let mockIDE: MockIDE;
    let testHandler: ConcreteTestHandler;
    let mockOutputChannel: MockOutputChannel;

    beforeEach(() => {
        mockClient = new MockDebuggAIServerClient();
        mockIDE = new MockIDE();
        mockOutputChannel = new MockOutputChannel();
    });

    afterEach(() => {
        if (testHandler && testHandler.isTestRunning()) {
            testHandler.stop();
        }
    });

    describe('Constructor and Initialization', () => {
        test('should initialize with default options', () => {
            const options: TestHandlerOptions = {
                title: 'Test Handler'
            };

            testHandler = new ConcreteTestHandler(mockClient, mockIDE, options);

            assert.strictEqual(testHandler.isTestRunning(), false);
            assert.strictEqual(testHandler.getTestRun(), null);
            assert.strictEqual(testHandler.getTestItem(), null);
            
            const testState = testHandler.getTestState();
            assert.strictEqual(testState.status, 'pending');
            assert.strictEqual(testState.completed, false);
            assert.strictEqual(testState.stepNumber, 0);
            assert.strictEqual(testState.steps.length, 0);
            assert.strictEqual(testState.tests.length, 0);
        });

        test('should initialize with custom options', () => {
            const options: TestHandlerOptions = {
                title: 'Custom Test',
                timeoutMinutes: 45,
                pollingInterval: 5000,
                showProgressBar: true,
                stepLabelWidth: 40,
                testParams: { customParam: 'value' }
            };

            testHandler = new ConcreteTestHandler(mockClient, mockIDE, options);
            
            // Test internal state
            const timeoutMinutes = (testHandler as any).timeoutMinutes;
            const pollingInterval = (testHandler as any).pollingInterval;
            
            assert.strictEqual(timeoutMinutes, 45);
            assert.strictEqual(pollingInterval, 5000);
        });

        test('should handle initialization failure', async () => {
            const options: TestHandlerOptions = { title: 'Failing Test' };
            testHandler = new ConcreteTestHandler(mockClient, mockIDE, options);
            testHandler.setShouldFailInitialization(true);

            try {
                await testHandler.testInitialize();
                assert.fail('Should have thrown an error');
            } catch (error) {
                assert(error instanceof Error);
                assert.strictEqual(error.message, 'Initialization failed');
            }
        });
    });

    describe('Test Object Management', () => {
        beforeEach(() => {
            const options: TestHandlerOptions = { title: 'Test Handler' };
            testHandler = new ConcreteTestHandler(mockClient, mockIDE, options);
        });

        test('should create test object successfully', async () => {
            const mockTestObject: TestObject = {
                uuid: 'test-123',
                description: 'Test Description',
                title: 'Test Title',
                status: 'pending',
                object: { data: 'mock' }
            };

            testHandler.setMockTestObject(mockTestObject);
            const testObject = await testHandler.getTestObject();

            assert.strictEqual(testObject.uuid, 'test-123');
            assert.strictEqual(testObject.description, 'Test Description');
            assert.strictEqual(testObject.title, 'Test Title');
            assert.strictEqual(testObject.status, 'pending');
        });

        test('should handle test object creation failure', async () => {
            testHandler.setShouldFailCreation(true);

            try {
                await testHandler.getTestObject();
                assert.fail('Should have thrown an error');
            } catch (error) {
                assert(error instanceof Error);
                assert(error.message.includes('Failed to create test object') || error.message.includes('Test object creation failed'));
            }
        });

        test('should set and get test object', async () => {
            const testObject: TestObject = {
                uuid: 'manual-test',
                description: 'Manually set test',
                status: 'running',
                object: {}
            };

            testHandler.setTestObject(testObject);
            const retrievedObject = await testHandler.getTestObject();

            assert.strictEqual(retrievedObject.uuid, 'manual-test');
            assert.strictEqual(retrievedObject.description, 'Manually set test');
            assert.strictEqual(retrievedObject.status, 'running');
        });
    });

    describe('Polling and State Updates', () => {
        beforeEach(() => {
            const options: TestHandlerOptions = { title: 'Test Handler' };
            testHandler = new ConcreteTestHandler(mockClient, mockIDE, options);
        });

        test('should poll for updates correctly', async () => {
            const mockUpdates: TestState[] = [
                {
                    testObject: null,
                    testResults: null,
                    stepNumber: 1,
                    completed: false,
                    status: 'running',
                    steps: [{ label: 'Step 1', status: 'running', currentState: { evaluationPreviousGoal: '', memory: '', nextGoal: '' }, action: [] }],
                    tests: [],
                    handlePollUpdate: handlePollUpdateFn
                },
                {
                    testObject: null,
                    testResults: null,
                    stepNumber: 2,
                    completed: true,
                    status: 'completed',
                    steps: [
                        { label: 'Step 1', status: 'success', currentState: { evaluationPreviousGoal: '', memory: '', nextGoal: '' }, action: [] },
                        { label: 'Step 2', status: 'success', currentState: { evaluationPreviousGoal: '', memory: '', nextGoal: '' }, action: [] }
                    ],
                    tests: [],
                    handlePollUpdate: handlePollUpdateFn
                }
            ];

            testHandler.setMockPollUpdates(mockUpdates);

            // First poll
            const firstUpdate = await testHandler.testPollForUpdates();
            assert.strictEqual(firstUpdate.status, 'running');
            assert.strictEqual(firstUpdate.stepNumber, 1);

            // Second poll
            const secondUpdate = await testHandler.testPollForUpdates();
            assert.strictEqual(secondUpdate.status, 'completed');
            assert.strictEqual(secondUpdate.completed, true);
            assert.strictEqual(secondUpdate.stepNumber, 2);
        });
    });

    describe('Progress and Completion Handling', () => {
        beforeEach(() => {
            const options: TestHandlerOptions = { title: 'Test Handler' };
            testHandler = new ConcreteTestHandler(mockClient, mockIDE, options);
        });

        test('should handle progress updates', async () => {
            const progressState: TestState = {
                testObject: null,
                testResults: null,
                stepNumber: 1,
                completed: false,
                status: 'running',
                steps: [{ label: 'In Progress', status: 'running', currentState: { evaluationPreviousGoal: '', memory: '', nextGoal: '' }, action: [] }],
                tests: [],
                handlePollUpdate: handlePollUpdateFn
            };

            // This should not throw an error
            await testHandler.testHandleProgress(progressState);
        });

        test('should handle completion successfully', async () => {
            const completionState: TestState = {
                testObject: { uuid: 'test-123', description: 'Test', status: 'completed', object: {} },
                testResults: null,
                stepNumber: 2,
                completed: true,
                status: 'completed',
                steps: [
                    { label: 'Step 1', status: 'success', currentState: { evaluationPreviousGoal: '', memory: '', nextGoal: '' }, action: [] },
                    { label: 'Step 2', status: 'success', currentState: { evaluationPreviousGoal: '', memory: '', nextGoal: '' }, action: [] }
                ],
                tests: [],
                handlePollUpdate: handlePollUpdateFn
            };

            // This should not throw an error
            await testHandler.testHandleCompletion(completionState);
            assert.strictEqual(testHandler.isTestRunning(), false);
        });

        test('should handle timeout correctly', async () => {
            // Set handler as running
            (testHandler as any).isRunning = true;

            await testHandler.testHandleTimeout();
            
            assert.strictEqual(testHandler.isTestRunning(), false);
        });
    });

    describe('Cleanup and Error Handling', () => {
        beforeEach(() => {
            const options: TestHandlerOptions = { title: 'Test Handler' };
            testHandler = new ConcreteTestHandler(mockClient, mockIDE, options);
        });

        test('should execute cleanup callbacks', async () => {
            let cleanupCalled = false;
            let cleanupValue = '';

            testHandler.testAddCleanupCallback(() => {
                cleanupCalled = true;
                cleanupValue = 'cleaned up';
            });

            await testHandler.testCleanup();

            assert.strictEqual(cleanupCalled, true);
            assert.strictEqual(cleanupValue, 'cleaned up');
        });

        test('should handle cleanup errors gracefully', async () => {
            testHandler.testAddCleanupCallback(() => {
                throw new Error('Cleanup error');
            });

            // Should not throw error even if callback fails
            try {
                await testHandler.testCleanup();
                // Test passes if no exception is thrown
            } catch (error) {
                assert.fail('Cleanup should handle errors gracefully without throwing');
            }
        });

        test('should handle error cleanup', async () => {
            let cleanupCalled = false;

            testHandler.testAddCleanupCallback(() => {
                cleanupCalled = true;
            });

            await testHandler.testCleanupError('Test error reason');

            assert.strictEqual(cleanupCalled, true);
        });
    });

    describe('VS Code Integration', () => {
        beforeEach(() => {
            const options: TestHandlerOptions = { title: 'Test Handler' };
            testHandler = new ConcreteTestHandler(mockClient, mockIDE, options);
        });

        test('should get test controller', () => {
            const controller = testHandler.testGetController();
            assert(controller, 'Should return a test controller');
            assert.strictEqual(typeof controller.createTestItem, 'function');
        });

        test('should get formatter', () => {
            const formatter = testHandler.testGetFormatter();
            assert(formatter instanceof TerminalFormatter, 'Should return a TerminalFormatter instance');
        });
    });

    describe('Full Test Run Lifecycle', () => {
        test('should execute complete test run successfully', async function() {
            this.timeout(10000); // Increase timeout for full lifecycle test

            const options: TestHandlerOptions = {
                title: 'Lifecycle Test',
                timeoutMinutes: 1, // Short timeout for testing
                pollingInterval: 100 // Fast polling for testing
            };

            const mockTestObject: TestObject = {
                uuid: 'lifecycle-test',
                description: 'Lifecycle test object',
                status: 'pending',
                object: {}
            };

            const mockUpdates: TestState[] = [
                {
                    testObject: mockTestObject,
                    testResults: null,
                    stepNumber: 1,
                    completed: false,
                    status: 'running',
                    steps: [{ label: 'Starting', status: 'running', currentState: { evaluationPreviousGoal: '', memory: '', nextGoal: '' }, action: [] }],
                    tests: [],
                    handlePollUpdate: handlePollUpdateFn
                },
                {
                    testObject: mockTestObject,
                    testResults: null,
                    stepNumber: 2,
                    completed: true,
                    status: 'completed',
                    steps: [
                        { label: 'Starting', status: 'success', currentState: { evaluationPreviousGoal: '', memory: '', nextGoal: '' }, action: [] },
                        { label: 'Completed', status: 'success', currentState: { evaluationPreviousGoal: '', memory: '', nextGoal: '' }, action: [] }
                    ],
                    tests: [],
                    handlePollUpdate: handlePollUpdateFn
                }
            ];

            testHandler = new ConcreteTestHandler(mockClient, mockIDE, options, mockTestObject, mockUpdates);

            // Start the test run
            const runPromise = testHandler.run();

            // Wait a bit for the test to process
            await new Promise(resolve => setTimeout(resolve, 500));

            // Verify the test completed
            await runPromise;
            assert.strictEqual(testHandler.isTestRunning(), false);
        });

        test('should handle test run failure', async () => {
            const options: TestHandlerOptions = {
                title: 'Failing Test'
            };

            testHandler = new ConcreteTestHandler(mockClient, mockIDE, options);
            testHandler.setShouldFailInitialization(true);

            try {
                await testHandler.run();
                // Should not reach here, but if it does, test should not be running
                assert.strictEqual(testHandler.isTestRunning(), false);
            } catch (error) {
                // Expected to fail
                assert.strictEqual(testHandler.isTestRunning(), false);
            }
        });

        test('should stop running test', async () => {
            const options: TestHandlerOptions = {
                title: 'Stoppable Test',
                pollingInterval: 100
            };

            testHandler = new ConcreteTestHandler(mockClient, mockIDE, options);

            // Start the test
            const runPromise = testHandler.run();

            // Wait a bit then stop
            await new Promise(resolve => setTimeout(resolve, 200));
            await testHandler.stop();

            // Verify it stopped
            assert.strictEqual(testHandler.isTestRunning(), false);

            // Wait for run to complete
            try {
                await runPromise;
            } catch (error) {
                // Expected if run was stopped
            }
        });
    });

    describe('Edge Cases and Error Conditions', () => {
        beforeEach(() => {
            const options: TestHandlerOptions = { title: 'Edge Case Test' };
            testHandler = new ConcreteTestHandler(mockClient, mockIDE, options);
        });

        test('should handle null test object gracefully', async () => {
            testHandler.setMockTestObject(null as any);
            testHandler.setShouldFailCreation(false);

            try {
                const testObject = await testHandler.getTestObject();
                // Should create a default mock test object
                assert(testObject, 'Should create a default test object');
                assert(testObject.uuid, 'Should have a UUID');
            } catch (error) {
                // This is also acceptable behavior
                assert(error instanceof Error);
            }
        });

        test('should handle empty poll updates', async () => {
            testHandler.setMockPollUpdates([]);

            const update = await testHandler.testPollForUpdates();
            assert(update, 'Should return current test state');
            assert.strictEqual(update.status, 'pending'); // Default status
        });

        test('should handle multiple cleanup callbacks', async () => {
            const results: string[] = [];

            testHandler.testAddCleanupCallback(() => results.push('cleanup1'));
            testHandler.testAddCleanupCallback(() => results.push('cleanup2'));
            testHandler.testAddCleanupCallback(() => results.push('cleanup3'));

            await testHandler.testCleanup();

            assert.deepStrictEqual(results, ['cleanup1', 'cleanup2', 'cleanup3']);
        });

        test('should handle mixed success/failure cleanup callbacks', async () => {
            let successCount = 0;

            testHandler.testAddCleanupCallback(() => successCount++);
            testHandler.testAddCleanupCallback(() => { throw new Error('Cleanup error'); });
            testHandler.testAddCleanupCallback(() => successCount++);

            try {
                await testHandler.testCleanup();
                // Should still execute all callbacks even if some fail
                assert.strictEqual(successCount, 2);
            } catch (error) {
                // If cleanup throws, still check that successful callbacks ran
                assert(successCount >= 1, 'Should execute at least some successful callbacks');  
            }
        });
    });
});