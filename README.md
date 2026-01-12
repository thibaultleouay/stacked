# stacked

A CLI tool for managing stacked pull requests on GitHub with [Jujutsu (jj)](https://github.com/jj-vcs/jj). Automates creating and updating GitHub PRs for each bookmarked commit in your jj stack, maintaining proper base branch relationships and adding stack navigation links to PR descriptions.

Based on [fj](https://github.com/lazywei/fj).

## Features

- Creates a GitHub PR for each bookmarked commit in your jj stack
- Automatically maintains base branch relationships between PRs
- Adds stack navigation links to PR descriptions
- Merges a stack of OR

## Why Stacked PRs?

Stacked pull requests break down large features into smaller, focused changes that are easier to review and merge:

- **Smaller PRs are easier to review** - Reviewers can focus on one logical change at a time
- **Faster feedback loops** - Get reviews on early parts of your work while continuing to build
- **Incremental approvals** - Merge completed work without waiting for the entire feature
- **Better history** - Each commit represents a single, coherent change
- **Easier rebasing** - Smaller commits are simpler to rebase and resolve conflicts

## How It Works

With Jujutsu, you create a stack of commits where each commit builds on the previous one. Each commit gets a bookmark (branch) that stacked uses to create a corresponding PR:

```
❯ jj log
@  ryrpnrmy thibaultleouay@gmail.com 2026-01-11 13:22:55 trying-something2* 07ac8262
│  downgrade version
○  kopmorwp thibaultleouay@gmail.com 2026-01-11 13:20:06 trying-something1 feebf6fa
│  Update src/index.ts
◆  pvrmmsmk thibaultleouay@gmail.com 2026-01-10 20:58:00 main 72ec6c99
│  more3: some small improvments (#26)
~
```

In this example:
- `trying-something1` and `trying-something2` are bookmarks on commits
- Running `stacked push -b trying-something` creates a PR for each bookmarked commit
- PR for `trying-something1` targets `main`
- PR for `trying-something2` targets `trying-something1`

### Workflow Example

Here's a complete workflow showing how to create, update, and merge stacked PRs:

#### 1. Start with your jj history

```
❯ jj log
@  ryrpnrmy ... trying-something2 eca27b8e
│  downgrade version
○  uqytmmxr ... trying-something1 feebf6fa
│  this should be update by copilot
◆  pvrmmsmk ... main 72ec6c99
```

#### 2. Create PRs with stacked push

```bash
❯ stacked push -b trying-something
```

Output:
```
INF stacked Branch pushed to remote
INF stacked No PR created for branch yet, creating: "trying-something1"
INF stacked PR created
INF stacked Branch pushed to remote
INF stacked No PR created for branch yet, creating: "trying-something2"
INF stacked PR created
INF stacked Successfully updated PR: "https://github.com/thibaultleouay/stacked/pull/31"
INF stacked Successfully updated PR: "https://github.com/thibaultleouay/stacked/pull/32"
```

This creates two PRs:
- PR #31 (`trying-something1`) targets `main`
- PR #32 (`trying-something2`) targets `trying-something1`

#### 3. Make changes based on review feedback

Create a
```
❯ jj log
@  ryrpnrmy thibaultleouay@gmail.com 2026-01-11 13:22:55 trying-something2* 07ac8262
│  downgrade version
○  kopmorwp thibaultleouay@gmail.com 2026-01-11 13:20:06 trying-something1 feebf6fa
│  Update src/index.ts
○  uqytmmxr thibaultleouay@gmail.com 2026-01-11 13:15:43 6caf8051
│  this should be update by copilot
◆  pvrmmsmk thibaultleouay@gmail.com 2026-01-10 20:58:00 main 72ec6c99
│  more3: some small improvments (#26)
~
```

Edit a commit in the middle of your stack:

```bash
# Jump to a specific commit
❯ jj new kopmorwp

# Make your changes, then squash them into the commit
❯ jj squash

# Descendant commits are automatically rebased
```


#### 5. Push updates to your PRs

After making changes or rebasing:

```bash
❯ stacked push -b trying-something
```

The tool detects existing PRs and updates them instead of creating new ones.

#### 6. Merge your stack

Once reviews are complete, merge all your pr and it's ancestor 

```bash
❯ stacked merge -b trying-something2
```

## Prerequisites

- [Jujutsu (jj)](https://github.com/jj-vcs/jj) installed and repository initialized
- [GitHub CLI (gh)](https://cli.github.com/) installed and authenticated

## Installation

### Download Binary (Recommended)

Download the latest binary for your platform from the [releases page](https://github.com/thibaultleouay/stacked/releases).

**macOS (Apple Silicon):**
```bash
curl -LO https://github.com/thibaultleouay/stacked/releases/latest/download/stacked_darwin_arm64.tar.gz
tar -xzf stacked_darwin_arm64.tar.gz
sudo mv stacked /usr/local/bin/
```

**macOS (Intel):**
```bash
curl -LO https://github.com/thibaultleouay/stacked/releases/latest/download/stacked_darwin_amd64.tar.gz
tar -xzf stacked_darwin_amd64.tar.gz
sudo mv stacked /usr/local/bin/
```

**Linux (x86_64):**
```bash
curl -LO https://github.com/thibaultleouay/stacked/releases/latest/download/stacked_linux_amd64.tar.gz
tar -xzf stacked_linux_amd64.tar.gz
sudo mv stacked /usr/local/bin/
```

**Linux (ARM64):**
```bash
curl -LO https://github.com/thibaultleouay/stacked/releases/latest/download/stacked_linux_arm64.tar.gz
tar -xzf stacked_linux_arm64.tar.gz
sudo mv stacked /usr/local/bin/
```

### Run with Deno

If you have [Deno](https://deno.land/) installed:

```bash
git clone https://github.com/thibaultleouay/stacked.git
cd stacked
deno task start
```

## Quick Start

1. Navigate to a jj repository with commits ready for review
2. Run `stacked push -b <feature-name>` to create PRs for your stack
3. Each commit becomes a PR with proper base branches and navigation links

## Configuration

On first run, stacked creates a `.stacked.toml` file in your repository root with default settings:

```toml
mainBranch = "main"
draft = true
```

| Option | Description | Default |
|--------|-------------|---------|
| `mainBranch` | The base branch for your stack | `"main"` |
| `branchPrefix` | Prefix for auto-generated branch names | `"username/pr-"` |
| `draft` | Create PRs as drafts | `true` |

## Usage

### `stacked merge`

Merge stacked PR 

```bash
stacked merge -b <bookmark-name>
```

### `stacked push`

Creates or updates stacked PRs for all commits between main and your current revision.

```bash
stacked push -b <bookmark-name>
```

**Options:**

| Option | Description | Required |
|--------|-------------|----------|
| `-b, --bookmark <name>` | Bookmark name for the branch prefix | Yes |
| `-c, --change <change_id>` | Change ID to use as the stack tip | No (default: `@`) |

**Examples:**

```bash
# Push current stack with bookmark prefix "feature-auth"
stacked push -b feature-auth

# Push from a specific change ID
stacked push -b feature-auth -c abc123
```

This command:
1. Finds all commits in your stack (`mainBranch..@`)
2. Creates a bookmark for each commit using the provided name
3. Pushes each branch to the remote
4. Creates a PR for each branch (if not already created)
5. Updates all PR descriptions with stack navigation links

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
deno test              # Run tests
```
