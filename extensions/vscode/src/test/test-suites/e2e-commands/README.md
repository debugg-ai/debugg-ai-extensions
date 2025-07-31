# E2E Commands Migration Test Framework

A comprehensive test framework for validating the migration of VS Code extension E2E commands from the old direct implementation architecture to the new modular AiE2eAgent + RemoteTestHandler architecture.

## 🎯 Purpose

This test framework ensures feature parity and validates that the migration from:
- **Old Architecture**: E2eTestRunner, E2eSuiteGenerator, E2eTestHandler (direct implementations)
- **New Architecture**: AiE2eAgent + RemoteTestHandler + E2eRemoteTestHandler (modular architecture)

maintains all existing functionality while adding new capabilities.

## 📋 Commands Under Test

1. `debugg-ai.createNewE2eTest` (line 1295)
2. `debugg-ai.runE2eTest` (line 1337)
3. `debugg-ai.runE2eSuiteGenerator` (line 1370)
4. `debugg-ai.runE2eTestSuite` (line 1416)
5. `debugg-ai.generateTestsForWorkingChanges` (line 1562)

## 🏗️ Test Structure

```
e2e-commands/
├── testUtils.ts                          # Mock utilities and helpers
├── createNewE2eTest.test.ts              # Unit tests for test creation
├── runE2eTest.test.ts                    # Unit tests for test execution
├── runE2eSuiteGenerator.test.ts          # Unit tests for suite generation
├── runE2eTestSuite.test.ts               # Unit tests for suite execution
├── generateTestsForWorkingChanges.test.ts # Unit tests for working changes
├── integration.test.ts                   # End-to-end workflow tests
├── migration.test.ts                     # Architecture comparison tests
├── index.test.ts                         # Test suite orchestrator
└── README.md                             # This documentation
```

## 🧪 Test Categories

### Unit Tests
- **Happy Path**: All commands execute successfully with valid inputs
- **Error Handling**: Network failures, invalid inputs, configuration errors
- **Edge Cases**: Empty inputs, special characters, concurrent operations
- **Configuration**: Port management, config loading, defaults

### Integration Tests
- **Complete Workflows**: Multi-command sequences (create → generate → run)
- **Repository Context**: File handling, workspace management, repo info
- **User Experience**: UI flows, messages, progress indicators
- **Error Recovery**: Graceful degradation, retry scenarios

### Migration Validation Tests
- **Feature Parity**: Old vs new architecture comparison
- **Backward Compatibility**: Existing functionality preservation
- **Performance**: Timing characteristics comparison
- **Error Consistency**: Error handling across architectures

## 🚀 Usage

### Run All Tests
```bash
cd extensions/vscode
npm test -- --testPathPattern=e2e-commands
```

### Run Specific Test Suite
```bash
# Individual command tests
npm test -- createNewE2eTest.test.ts
npm test -- runE2eTest.test.ts
npm test -- runE2eSuiteGenerator.test.ts
npm test -- runE2eTestSuite.test.ts
npm test -- generateTestsForWorkingChanges.test.ts

# Integration and migration tests
npm test -- integration.test.ts
npm test -- migration.test.ts
```

### Run with Coverage
```bash
npm run test:coverage -- --testPathPattern=e2e-commands
```

### Debug Tests
```bash
npm test -- --testPathPattern=e2e-commands --verbose --no-cache
```

## 🛠️ Mock Architecture

### VS Code APIs
- `vscode.window`: Input prompts, messages, status bar, quick pick
- `vscode.commands`: Command registration and execution
- `vscode.workspace`: Workspace folders, file system access

### DebuggAI Server Client
- `client.e2es.*`: All E2E service endpoints
- `client.getRepoInfo()`: Repository information
- `client.issues.*`: Issue tracking services

### Old Architecture Components
- `E2eTestRunner`: Direct test creation and execution
- `E2eSuiteGenerator`: Direct suite generation and running
- `E2eTestHandler`: Core E2E test handling logic

### New Architecture Components
- `AiE2eAgent`: Central AI agent for E2E operations
- `RemoteTestHandler`: Remote test execution management
- `CommitTester`: Working changes analysis and test generation

### External Services
- `NgrokTunnelClient`: Tunnel management for local testing
- `fetch`: Network requests for test script downloads

## 📊 Test Coverage Goals

- **Unit Tests**: 90%+ coverage of command logic
- **Integration Tests**: All major user workflows
- **Error Scenarios**: All error paths and edge cases
- **Migration Validation**: Feature parity verification

## 🔍 Key Testing Patterns

### Command Testing Pattern
```typescript
test('should execute command with valid inputs', async () => {
  // Arrange
  const testDescription = 'Test description';
  executor.configHandler.loadConfig = jest.fn().mockResolvedValue({
    config: { debuggAiServerPort: 3000 }
  });

  // Act
  await executor.executeCommand('debugg-ai.createNewE2eTest', testDescription);

  // Assert
  expect(mockComponent.method).toHaveBeenCalledWith(testDescription, 3000);
  E2eCommandAssertions.assertInformationMessage(executor.window, 'Success message');
});
```

### Error Handling Pattern
```typescript
test('should handle errors gracefully', async () => {
  // Arrange
  const errorMessage = 'Network error';
  mockComponent.method = jest.fn().mockRejectedValue(new Error(errorMessage));

  // Act
  await executor.executeCommand('command-name');

  // Assert
  E2eCommandAssertions.assertErrorMessage(executor.window, errorMessage);
});
```

### Migration Comparison Pattern
```typescript
test('should produce equivalent results between architectures', async () => {
  // Act
  const oldResult = await oldArchitecture.method(params);
  const newResult = await newArchitecture.method(params);

  // Assert
  expect(oldResult).toEqual(expect.objectContaining(expectedResult));
  expect(newResult).toEqual(expect.objectContaining(expectedResult));
  expect(oldResult.key).toBe(newResult.key);
});
```

## 🎯 Migration Checklist

Use this test framework to validate:

- [ ] All existing command functionality preserved
- [ ] New architecture components integrated correctly
- [ ] Error handling maintains user-friendly messages
- [ ] Configuration management remains consistent
- [ ] Performance characteristics are acceptable
- [ ] User interface flows remain intuitive
- [ ] Repository context handling works correctly
- [ ] Test file generation and saving functions properly
- [ ] Concurrent operations are handled safely
- [ ] Edge cases and error scenarios are covered

## 🐛 Debugging Tests

### Common Issues

1. **Mock not working**: Ensure mocks are setup in `beforeEach`
2. **Async timing**: Use `await` for all async operations
3. **State leakage**: Call `cleanupE2eCommandTests()` in `afterEach`
4. **VS Code API mocking**: Check mock implementations in `testUtils.ts`

### Debug Helpers

```typescript
// Enable detailed logging
console.log('Test state:', executor.client.e2es);
console.log('Mock calls:', mockComponent.method.mock.calls);

// Verify mock setup
expect(mockComponent.method).toHaveBeenCalledTimes(1);
expect(mockComponent.method).toHaveBeenCalledWith(expectedParams);
```

## 📈 Extending the Framework

### Adding New Command Tests

1. Create `newCommand.test.ts` following existing patterns
2. Add mock implementations to `testUtils.ts`
3. Include in `index.test.ts` imports
4. Add migration comparison in `migration.test.ts`

### Adding New Test Scenarios

1. Follow the AAA pattern (Arrange, Act, Assert)
2. Use descriptive test names: `should do X when Y happens`
3. Group related tests in `describe` blocks
4. Use `E2eCommandAssertions` for consistent validation

### Customizing Mocks

```typescript
// Override mock behavior for specific tests
executor.client.e2es.createE2eTest = jest.fn().mockImplementation(async (desc) => {
  // Custom mock logic
  return { uuid: 'custom-id', description: desc };
});
```

## 🤝 Contributing

When adding tests:

1. Follow existing naming conventions
2. Include both happy path and error scenarios
3. Add JSDoc comments for complex test logic
4. Update this README if adding new test categories
5. Ensure all tests are deterministic and isolated

## 📚 References

- [Jest Testing Framework](https://jestjs.io/docs/getting-started)
- [VS Code Extension Testing](https://code.visualstudio.com/api/working-with-extensions/testing-extension)
- [DebuggAI Architecture Documentation](../../../CLAUDE.md)

This test framework provides comprehensive coverage and confidence for the architecture migration while maintaining the quality and reliability of the E2E testing functionality.