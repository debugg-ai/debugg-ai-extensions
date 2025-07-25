// import * as vscode from 'vscode';
// import { TestState } from '../e2e-agents/types';
// import { TerminalFormatter } from './terminalFormatter';

// /**
//  * Example usage of the stateless TerminalFormatter
//  */
// export class TerminalFormatterExample {
    
//     /**
//      * Example 1: Basic usage with a simple test state
//      */
//     static basicExample(): void {
//         const outputChannel = vscode.window.createOutputChannel("Example Test");
//         const formatter = new TerminalFormatter(outputChannel, {
//             title: "🔧 Build Process",
//             showProgressBar: true,
//             stepLabelWidth: 25
//         });

//         // Create initial state
//         let state: TestState = TerminalFormatter.createSimpleState(
//             "Building My App",
//             [
//                 { label: "Installing dependencies", status: "pending" },
//                 { label: "Compiling TypeScript", status: "pending" },
//                 { label: "Running tests", status: "pending" }
//             ],
//             "running"
//         );

//         // Print initial state
//         formatter.printState(state);

//         // Simulate progress
//         setTimeout(() => {
//             state = TerminalFormatter.updateStep(state, "Installing dependencies", "success", "2.3s");
//             formatter.printState(state);
//         }, 1000);

//         setTimeout(() => {
//             state = TerminalFormatter.updateStep(state, "Compiling TypeScript", "running");
//             formatter.printState(state);
//         }, 2000);

//         setTimeout(() => {
//             state = TerminalFormatter.updateStep(state, "Compiling TypeScript", "success", "1.8s");
//             state = TerminalFormatter.updateStep(state, "Running tests", "running");
//             formatter.printState(state);
//         }, 4000);

//         setTimeout(() => {
//             state = TerminalFormatter.updateStep(state, "Running tests", "success", "15 tests passed");
//             state.status = "success";
//             state.completed = true;
            
//             formatter.printState(state);
//             formatter.printSummary(state, "Build Complete", "All steps completed successfully");
//         }, 6000);
//     }

//     /**
//      * Example 2: Using with VS Code test run
//      */
//     static testRunExample(testRun: vscode.TestRun): void {
//         const formatter = new TerminalFormatter(testRun, {
//             title: "🧪 Unit Tests",
//             showStepNumbers: true,
//             stepLabelWidth: 30,
//             showProgressBar: true
//         });

//         // Create test state
//         let state: TestState = {
//             testObject: {
//                 uuid: "test-123",
//                 description: "Unit Test Suite",
//                 title: "Unit Tests",
//                 object: { name: "Unit Tests" }
//             },
//             testResults: null,
//             stepNumber: 0,
//             completed: false,
//             status: "running",
//             steps: []
//         };

//         // Add steps dynamically
//         state = TerminalFormatter.addStep(state, "Setup test environment", "running");
//         formatter.printState(state);

//         setTimeout(() => {
//             state = TerminalFormatter.updateStep(state, "Setup test environment", "success");
//             state = TerminalFormatter.addStep(state, "Running test cases", "running");
//             formatter.printState(state);
//         }, 1000);

//         setTimeout(() => {
//             state = TerminalFormatter.updateStep(state, "Running test cases", "success", "5/5 passed");
//             state.status = "success";
//             state.completed = true;
            
//             formatter.printState(state);
//             formatter.printSummary(state, "Tests Passed", "All test cases completed successfully");
//         }, 3000);
//     }

//     /**
//      * Example 3: Error handling
//      */
//     static errorExample(): void {
//         const outputChannel = vscode.window.createOutputChannel("Error Example");
//         const formatter = new TerminalFormatter(outputChannel, {
//             title: "⚠️ Error Recovery",
//             showProgressBar: true
//         });

//         let state: TestState = TerminalFormatter.createSimpleState(
//             "Error Recovery Process",
//             [
//                 { label: "Attempting operation", status: "running" },
//                 { label: "Handling error", status: "pending" },
//                 { label: "Recovery complete", status: "pending" }
//             ],
//             "running"
//         );

//         formatter.printState(state);

//         setTimeout(() => {
//             state = TerminalFormatter.updateStep(state, "Attempting operation", "error", "Connection failed");
//             state = TerminalFormatter.updateStep(state, "Handling error", "running");
//             state.status = "error";
//             formatter.printState(state);
//         }, 1000);

//         setTimeout(() => {
//             state = TerminalFormatter.updateStep(state, "Handling error", "success", "Retry successful");
//             state = TerminalFormatter.updateStep(state, "Recovery complete", "success");
//             state.status = "success";
//             state.completed = true;
            
//             formatter.printState(state);
//             formatter.printSummary(state, "Recovery Complete", "Successfully recovered from error");
//         }, 3000);
//     }

//     /**
//      * Example 4: Complex test results
//      */
//     static complexResultsExample(): void {
//         const outputChannel = vscode.window.createOutputChannel("Complex Results");
//         const formatter = new TerminalFormatter(outputChannel, {
//             title: "📊 Performance Test",
//             showProgressBar: true,
//             stepLabelWidth: 35
//         });

//         let state: TestState = {
//             testObject: {
//                 uuid: "perf-test-456",
//                 description: "Performance Benchmark",
//                 title: "Performance Test",
//                 object: { type: "benchmark" }
//             },
//             testResults: null,
//             stepNumber: 0,
//             completed: false,
//             status: "running",
//             steps: []
//         };

//         // Add steps
//         state = TerminalFormatter.addStep(state, "Warming up system", "running");
//         formatter.printState(state);

//         setTimeout(() => {
//             state = TerminalFormatter.updateStep(state, "Warming up system", "success", "2.1s");
//             state = TerminalFormatter.addStep(state, "Running benchmarks", "running");
//             formatter.printState(state);
//         }, 2000);

//         setTimeout(() => {
//             state = TerminalFormatter.updateStep(state, "Running benchmarks", "success", "10 iterations");
//             state = TerminalFormatter.addStep(state, "Analyzing results", "running");
//             formatter.printState(state);
//         }, 5000);

//         setTimeout(() => {
//             state = TerminalFormatter.updateStep(state, "Analyzing results", "success", "Complete");
            
//             // Add test results
//             state.testResults = {
//                 uuid: "results-789",
//                 description: "Performance Analysis",
//                 title: "Benchmark Results",
//                 results: {
//                     averageTime: "1.2s",
//                     throughput: "1000 req/s",
//                     memoryUsage: "45MB"
//                 },
//                 formattedResults: `
// Performance Results:
// ├── Average Response Time: 1.2s
// ├── Throughput: 1000 requests/second
// ├── Memory Usage: 45MB
// └── Status: PASSED
//                 `.trim()
//             };
            
//             state.status = "success";
//             state.completed = true;
            
//             formatter.printState(state);
//             formatter.printResults(state);
//             formatter.printSummary(state, "Performance Test Complete", "All benchmarks passed");
//         }, 8000);
//     }
// } 