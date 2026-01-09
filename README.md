# stacked

A Deno CLI tool for managing stacked pull requests with [Jujutsu (jj)](https://github.com/jj-vcs/jj). Automates creating and updating GitHub PRs for each commit in a jj stack, maintaining proper base branch relationships and adding stack navigation links to PR descriptions.

Based on [fj](https://github.com/lazywei/fj).

## Prerequisites

- [Deno](https://deno.land/) installed
- [Jujutsu (jj)](https://github.com/jj-vcs/jj) installed and repository initialized
- [GitHub CLI (gh)](https://cli.github.com/) installed and authenticated

## Installation

```bash
git clone https://github.com/thibaultleouay/stacked.git
cd stacked
deno task start
```

## Configuration

On first run, stacked creates a `.stacked.toml` file in your repository root with default settings:

```toml
mainBranch = "main"
branchPrefix = "username/pr-"
draft = true
```

| Option | Description | Default |
|--------|-------------|---------|
| `mainBranch` | The base branch for your stack | `"main"` |
| `branchPrefix` | Prefix for auto-generated branch names | `"username/pr-"` |
| `draft` | Create PRs as drafts | `true` |

## Usage

### `stacked push`

Creates or updates stacked PRs for all commits between main and your current revision.

```bash
deno task start push
```

This command:
1. Finds all commits in your stack (`mainBranch..@-`)
2. Creates a branch for each commit (if not already created)
3. Pushes each branch to the remote
4. Creates a PR for each branch (if not already created)
5. Updates all PR descriptions with stack navigation links

### `stacked up`

Syncs your stack with the latest changes from main.

```bash
deno task start up
```

This command:
1. Fetches from the remote
2. Rebases your stack onto the main branch
3. Prompts to abandon any empty commits (already merged)

## Stack Navigation

When you have multiple PRs in a stack, each PR description is updated with navigation links:

```
---
* #103
* **->** #102
* #101
```

The arrow indicates the current PR in the stack.

## Development

```bash
deno task start        # Run the CLI
deno task check        # Type check
deno task check:type   # Type check with --unstable-tsgo
```
