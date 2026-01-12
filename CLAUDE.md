# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**stacked** is a Deno CLI tool for managing stacked pull requests with Jujutsu (jj). It automates creating and updating GitHub PRs for each bookmarked commit in a jj stack, maintaining proper base branch relationships and adding stack navigation links to PR descriptions.

Based on https://github.com/lazywei/fj

## Development Commands

```bash
deno task start              # Run the CLI
deno task check              # Type check
deno task check:type         # Type check with --unstable-tsgo
deno test                    # Run all tests
deno test src/jj_test.ts     # Run specific test file
```

## Code Style

### Patterns

- **Dependency Injection**: Use `setCommandRunner()` pattern for testability (see jj.ts, gh.ts)
- **Schema Validation**: Use Zod for all data validation and type inference
- **Async/Await**: Prefer async/await over raw promises
- **Error Handling**: Use `errorPrefix` option in `runCommand()` for contextual errors

### Conventions

- Functions that shell out should use the injected command runner, not `Deno.Command` directly
- Export types alongside their Zod schemas (e.g., `PRStateSchema` and `PRState`)
- Use structured logging with `logger.info("message {var}", { var })` format

## Testing

### Running Tests

```bash
deno test                    # Run all tests
deno test src/jj_test.ts     # Run jj tests only
deno test src/gh_test.ts     # Run gh tests only
deno test --filter "test name"  # Run specific test
```

### Writing Tests

1. **Mock the command runner** - Use `setCommandRunner()` before tests:
   ```typescript
   import { setCommandRunner, resetCommandRunner } from "./jj.ts";

   Deno.test("my test", async () => {
     setCommandRunner(async (cmd, args) => ({
       code: 0,
       stdout: "mocked output",
       stderr: "",
     }));

     // ... test code ...

     resetCommandRunner(); // Clean up
   });
   ```

2. **Test file naming**: Use `*_test.ts` suffix (e.g., `jj_test.ts`)

3. **Reset after tests**: Always call `resetCommandRunner()` to avoid test pollution

## Architecture

### Source Files (`src/`)

- **index.ts** - CLI entry point using Cliffy Command. Defines two commands:
  - `push` - Creates/updates stacked PRs for all commits between main and current revision
  - `merge` - Merges all PRs up to and including a specified bookmark, updating base branches for remaining PRs

- **jj.ts** - Jujutsu wrapper functions. Uses `Deno.Command` to shell out to `jj`. Key functions:
  - `getStackChangeIDs(mainBranch, changeId)` - Gets change IDs for commits in the stack
  - `getStackBookmarks(mainBranch, targetBookmark?)` - Gets bookmarks for commits in the stack
  - `getDescription(changeID)` - Gets commit description
  - `getBookmark(changeID)` / `createBookmark()` - Bookmark management
  - `gitPush()` / `gitPushAll()` / `gitFetch()` - Git operations
  - `rebase()` / `rebaseAll()` - Rebase operations
  - Supports dependency injection for testing via `setCommandRunner()`

- **gh.ts** - GitHub CLI wrapper. Uses `gh` for PR operations:
  - `getPRNumber(branch)` - Gets PR number for a branch
  - `getPRState(branch)` - Gets PR state (OPEN, MERGED, CLOSED)
  - `createPR()` / `updatePRBody()` / `updatePRBase()` - PR management
  - `mergePR(branch)` - Marks draft as ready if needed, then squash merges
  - Supports dependency injection for testing via `setCommandRunner()`

- **config.ts** - Loads `.stacked.toml` from git root. Auto-creates with defaults on first run.

- **types.ts** - Config schema using Zod (`mainBranch`, `draft`)

- **utils.ts** - Shared utilities:
  - `runCommand()` / `runCommandInteractive()` - Command execution with error handling
  - `parseJson()` - Type-safe JSON parsing with Zod schemas
  - PR-related Zod schemas (`PRListItemSchema`, `PRViewSchema`, `PRStateSchema`)

- **logger.ts** - Logging setup using LogTape

### Test Files

- **jj_test.ts** - Tests for jj.ts functions with mocked command runner
- **gh_test.ts** - Tests for gh.ts functions with mocked command runner

### Configuration

The tool reads `.stacked.toml` from the repository root:
```toml
mainBranch = "main"
draft = true
```

### Key Dependencies

- `@cliffy/command` - CLI framework
- `zod` - Schema validation
- `smol-toml` - TOML parsing
- `@logtape/logtape` - Structured logging

### External Dependencies

- `jj` - Jujutsu CLI must be installed and repo must be a jj repository
- `gh` - GitHub CLI must be installed and authenticated

## Workflow

1. User creates commits in jj
2. `stacked push -b <name>` creates bookmarks and PRs:
   - Bookmarks are named `<name>1`, `<name>2`, etc. (numbered by stack position)
   - Each bookmark gets a corresponding PR
3. PRs are chained: each PR targets the previous bookmark (or main for the first)
4. PR descriptions include stack navigation links
5. `stacked merge -b <bookmark>` merges PRs from bottom up, updating base branches
