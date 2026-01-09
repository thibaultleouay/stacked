# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**stacked** is a Deno CLI tool for managing stacked pull requests with Jujutsu (jj). It automates creating and updating GitHub PRs for each commit in a jj stack, maintaining proper base branch relationships and adding stack navigation links to PR descriptions.

Based on https://github.com/lazywei/fj

## Development Commands

```bash
deno task start              # Run the CLI
deno task check              # Type check
deno task check:type         # Type check with --unstable-tsgo
deno test                    # Run tests (when added)
```

## Architecture

### Source Files (`src/`)

- **index.ts** - CLI entry point using Cliffy Command. Defines two commands:
  - Default command: Creates/updates stacked PRs for all commits between main and current revision
  - `up` command: Fetches, rebases onto main, and prompts to abandon empty commits

- **jj.ts** - Jujutsu wrapper functions. Uses `Deno.Command` to shell out to `jj`. Key functions:
  - `getStackChangeIDs(mainBranch)` - Gets change IDs for commits in the stack (`mainBranch..@-`)
  - `getEmptyChangeIDs(mainBranch)` - Finds empty commits that can be abandoned
  - Branch and git operations (push, fetch, rebase, abandon)

- **gh.ts** - GitHub CLI wrapper. Uses `gh` for PR operations:
  - `getNextAvailablePRNumber()` - Queries highest PR number to generate branch names
  - `createPR()` / `updatePRBody()` - PR creation and stack info updates

- **config.ts** - Loads `.stacked.toml` from git root. Auto-creates with defaults on first run.

- **types.ts** - Config interface (`mainBranch`, `branchPrefix`, `draft`)

### Configuration

The tool reads `.stacked.toml` from the repository root:
```toml
mainBranch = "main"
branchPrefix = "username/pr-"
draft = true
```

### External Dependencies

- `jj` - Jujutsu CLI must be installed and repo must be a jj repository
- `gh` - GitHub CLI must be installed and authenticated
