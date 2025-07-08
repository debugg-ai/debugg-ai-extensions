# Commit Tester

The Commit Tester is a VS Code extension feature that **automatically monitors git commits** and generates E2E tests using the DebuggAI server.

## Features

- **🔄 Automatic Commit Monitoring**: Automatically starts monitoring git commits when the extension loads
- **🤖 Test Generation**: Automatically generates Playwright tests based on commit changes
- **📝 Working Changes Testing**: Generate tests for uncommitted changes in your working directory
- **📁 File Extraction**: Extracts and saves generated test files to a configurable directory
- **🧠 Smart Test Detection**: Identifies test files from AI-generated content
- **⚙️ Configurable**: Can be enabled/disabled via VS Code settings

## How It Works

1. **Automatic Start**: When the DebuggAI extension loads, it automatically starts monitoring git repositories
2. **File Watching**: Uses file system watching to detect changes in `.git/logs/HEAD`
3. **Commit Analysis**: When a new commit is detected, it extracts commit information (message, author, files, diff)
4. **Test Generation**: Sends the commit information to the DebuggAI server to generate relevant E2E tests
5. **File Saving**: Extracts test files from the AI response and saves them to the configured output directory

## Configuration

### Enable/Disable Commit Testing

You can control whether commit testing runs automatically:

1. Open VS Code Settings (`Cmd/Ctrl + ,`)
2. Search for "debugg-ai.enableCommitTesting"
3. Toggle the setting on/off

**Default**: `true` (enabled)

### Test Output Directory

By default, test files are saved to `tests/playwright/` in your workspace root. You can change this using the command:

```
debugg-ai.setCommitTestOutputDirectory
```

## Commands

### Manual Control (Optional)

Since commit testing starts automatically, these commands are mainly for manual control:

#### Start Commit Testing
```
debugg-ai.startCommitTesting
```
Manually starts monitoring git commits (if not already running).

#### Stop Commit Testing
```
debugg-ai.stopCommitTesting
```
Stops the commit monitoring process.

#### Get Commit Testing Status
```
debugg-ai.getCommitTestingStatus
```
Shows the current status of commit testing and output directory.

#### Set Test Output Directory
```
debugg-ai.setCommitTestOutputDirectory
```
Change where generated test files are saved.

#### Generate Tests for Working Changes
```
debugg-ai.generateTestsForWorkingChanges
```
Generate E2E tests for current uncommitted changes in your working directory. This is useful for:
- Testing changes before committing them
- Generating tests for features you're actively developing
- Getting immediate feedback on your current work

**How it works:**
1. Analyzes your current git status (modified, added, deleted files)
2. Extracts diffs for changed files
3. Creates a comprehensive test description based on your working changes
4. Generates E2E tests using the DebuggAI server
5. Saves test files to your configured output directory

**Use cases:**
- **Pre-commit testing**: Generate tests before committing to ensure your changes are well-tested
- **Feature development**: Get test coverage for features you're actively working on
- **Bug fixes**: Generate tests that verify your bug fixes work correctly
- **Code reviews**: Create tests that demonstrate the functionality you've added

## Generated Test Files

The commit tester generates Playwright test files that:

- **Test the functionality** that was added, modified, or fixed in the commit
- **Include both positive and negative test cases**
- **Test edge cases and error conditions**
- **Follow best practices** for E2E testing
- **Include proper assertions** and error handling

### File Naming

Generated test files follow this pattern:
- `auto-generated-test-{timestamp}.{extension}` (if no filename provided)
- Preserves original filenames when detected in AI response

### Supported Languages

- JavaScript (`.js`)
- TypeScript (`.ts`)
- Python (`.py`)
- Java (`.java`)
- C# (`.cs`)

## Example Workflows

### Automatic Commit Testing Workflow

1. **Make changes** to your code
2. **Commit the changes** using git
3. **Automatic detection** - The commit tester detects the new commit
4. **Test generation** - DebuggAI analyzes the changes and generates relevant tests
5. **File saving** - Test files are automatically saved to your test directory
6. **Notification** - You receive a notification showing how many test files were generated

### Working Changes Testing Workflow

1. **Make changes** to your code (don't commit yet)
2. **Run the command** - Use `debugg-ai.generateTestsForWorkingChanges`
3. **Analysis** - The system analyzes your uncommitted changes
4. **Test generation** - DebuggAI generates tests based on your current work
5. **Review and commit** - Review the generated tests, then commit your changes
6. **Automatic testing** - The commit tester will also generate tests when you commit

This workflow is perfect for:
- **Iterative development** - Get test feedback while you're still working
- **Quality assurance** - Ensure your changes are well-tested before committing
- **Feature validation** - Verify that your new features work as expected

## Troubleshooting

### Commit Testing Not Starting

1. **Check if Git extension is installed** - The commit tester requires the VS Code Git extension
2. **Verify repository exists** - Make sure you're in a git repository
3. **Check settings** - Ensure `debugg-ai.enableCommitTesting` is set to `true`
4. **Check console** - Look for `[CommitTester]` messages in the VS Code console

### No Test Files Generated

1. **Check DebuggAI server** - Ensure your local DebuggAI server is running
2. **Verify port configuration** - Check that `debuggAiServerPort` is set correctly
3. **Check commit content** - The AI needs meaningful changes to generate tests
4. **Review console logs** - Look for error messages in the console

### Performance Issues

1. **Reduce polling frequency** - The file watcher polls every 1 second
2. **Disable for large repositories** - Consider disabling for very large codebases
3. **Check test output directory** - Ensure the output directory is accessible

## Integration with Existing Workflow

The commit tester integrates seamlessly with your existing development workflow:

- **No manual intervention required** - Works automatically in the background
- **Non-blocking** - Doesn't interfere with your normal git operations
- **Configurable** - Can be easily enabled/disabled as needed
- **Complementary** - Works alongside existing testing frameworks

## Advanced Usage

### Custom Test Descriptions

The commit tester creates detailed test descriptions based on:
- Commit message
- Changed files
- Author information
- Commit timestamp

### Multiple Repository Support

The commit tester automatically monitors all git repositories in your workspace.

### Error Handling

- **Graceful failures** - Errors don't stop the monitoring process
- **Detailed logging** - All operations are logged for debugging
- **User notifications** - Important events are shown to the user 