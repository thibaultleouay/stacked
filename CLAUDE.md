# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**stacked** is a Deno-based CLI wrapper around Jujutsu (jj), a Git-compatible version control system. The tool provides a simple command-line interface that delegates all operations to the underlying `jj` command while providing a consistent namespace.

## Development Commands

### Running the Application
- **Development mode with watch**: `deno task dev` - Auto-reloads on file changes
- **Run directly**: `deno task start` - Executes with necessary permissions
- **Compile to binary**: `deno task compile` - Creates standalone executable

### Running Commands
The application acts as a passthrough to `jj`:
```bash
deno run --allow-run main.ts <jj-command> [arguments...]
```

### Testing
Currently, no test suite is configured. When adding tests, use Deno's built-in test runner:
```bash
deno test
```

## Architecture

### Core Components

**main.ts**
- Entry point and only source file in the current implementation
- Exports `runJJ()` function that spawns `jj` subprocess with inherited stdio
- CLI argument parsing and delegation to Jujutsu
- Requires `--allow-run` permission to execute external `jj` command

### Key Design Decisions

1. **Subprocess delegation**: All commands are forwarded to `jj` via `Deno.Command`, preserving stdin/stdout/stderr inheritance for interactive operations
2. **Minimal abstraction**: The wrapper adds no additional logic beyond basic CLI parsing and help text
3. **Exit code passthrough**: Returns the exact exit code from `jj` for proper shell integration

## Development Environment

- **Runtime**: Deno (JSR imports for @std/assert and @std/cli)
- **Language**: TypeScript
- **Editor configuration**: Zed settings configure Deno LSP for TS/JS/TSX files
- **VCS**: Dual Git/.jj repository structure (Jujutsu co-located with Git)

## Dependencies

Standard library imports via JSR:
- `@std/assert@1` - Testing utilities (imported but not yet used)
- `@std/cli@1` - CLI utilities (imported but not yet used)
