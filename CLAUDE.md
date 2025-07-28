# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DebuggAI is an AI-powered application monitoring platform built on the Continue codebase that focuses on finding and fixing bugs through runtime monitoring and analysis. The project consists of multiple workspaces including a core library, GUI interface, VS Code extension, and binary distribution.

## Common Development Commands

### Building and Type Checking

```bash
# Build all components
npm run build

# Type check all workspaces in watch mode  
npm run tsc:watch

# Type check individual components
npm run tsc:watch:gui       # GUI React app
npm run tsc:watch:vscode    # VS Code extension
npm run tsc:watch:core      # Core TypeScript library
npm run tsc:watch:binary    # Binary distribution
```

### Testing

```bash
# Run tests for core library
cd core && npm test

# Run tests with coverage
cd core && npm run test:coverage

# Run GUI tests
cd gui && npm test

# Run GUI tests in watch mode
cd gui && npm run test:watch

# Run VS Code extension tests
cd extensions/vscode && npm test
```

### Linting

```bash
# Lint core library
cd core && npm run lint

# Lint and auto-fix core library
cd core && npm run lint:fix

# Lint VS Code extension
cd extensions/vscode && npm run lint
```

### Development Servers

```bash
# Start GUI development server
cd gui && npm run dev

# Build GUI for production
cd gui && npm run build

# Package VS Code extension
cd extensions/vscode && npm run package
```

## Architecture Overview

### Core Library (`/core`)
- **Main entry**: `core/core.ts` - Contains the main `Core` class that orchestrates the system
- **Protocol layer**: `core/protocol/` - Handles communication between components using a message-passing protocol
- **DebuggAI Server**: `core/debuggAIServer/` - Client and types for communicating with the DebuggAI backend API
- **E2E Testing**: `core/e2es/` - End-to-end test generation and execution framework
- **Authentication**: `core/auth/` - Handles user authentication and session management
- **LLM Integration**: `core/llm/` - Supports multiple LLM providers (OpenAI, Anthropic, local models, etc.)
- **Context Providers**: `core/context/providers/` - Various sources of context for AI interactions
- **Indexing**: `core/indexing/` - Codebase and documentation indexing for context retrieval

### GUI (`/gui`)
- React application built with Vite
- Uses Redux Toolkit for state management  
- TailwindCSS for styling
- Communicates with core via webview protocol
- Key pages:
  - E2E test management (`src/pages/e2es/`)
  - Authentication flows (`src/context/Auth.tsx`)
  - Chat interface for AI interactions

### VS Code Extension (`/extensions/vscode`)
- Main extension entry: `src/extension.ts`
- Webview providers for GUI integration
- Command palette integrations
- Keyboard shortcuts for common actions (Cmd+L for chat, Cmd+I for edit)

### Binary Distribution (`/binary`)
- Standalone executable version
- Built with pkg for cross-platform distribution
- TCP and IPC messaging support

## Key Integration Points

### Protocol Communication
The system uses a strongly-typed message protocol defined in `core/protocol/core.ts`. Messages flow between:
- IDE ↔ Core (via IMessenger interface)
- GUI ↔ Core (via webview protocol) 
- Core ↔ DebuggAI Server (via HTTP API)

### E2E Test System
- Test suites and individual tests are managed through `core/e2es/`
- Tests can be generated automatically from commit changes
- Playwright-based test execution with recording capabilities
- Integration with DebuggAI server for test result storage

### Authentication Flow
- OAuth-based authentication with DebuggAI service
- Token management in `core/auth/AuthManager.ts`
- User sessions persisted and synchronized across components

## Development Workflow Notes

- The project uses Node.js 20.11.0+ (engine-strict enforced)
- TypeScript configuration is shared across workspaces
- ESLint and Prettier are used for code formatting
- Tests use Jest (core) and Vitest (GUI)
- The extension builds with esbuild for optimal bundle size

## Important File Patterns

- `*.test.ts` - Jest/Vitest test files
- `types.ts` - TypeScript type definitions
- Protocol definitions in `core/protocol/`
- Context providers in `core/context/providers/`
- LLM implementations in `core/llm/llms/`