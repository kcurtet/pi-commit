# pi-commit

A `/commit` command extension for [pi](https://github.com/earendil-works/pi-coding-agent) that turns your working-tree changes into clean Conventional Commits.

Inspired by [midudev/better-claude-commit](https://github.com/midudev/better-claude-commit).

## What it does

Running `/commit`:

1. Gathers git context (branch, status, staged/unstaged stats, untracked files, diff — truncated at 60k chars).
2. Asks how to proceed: **commit + push** (default), **commit only**, or **commit on a new branch**.
3. Sends the agent a structured prompt so it:
   - Splits changes into logical groups, one commit per group.
   - Uses Conventional Commits format: `type(scope): summary` (English, imperative, < 72 chars).
   - Never stages secrets (`.env*`, keys, credentials).
   - Pushes and shows a summary (branch, commits, push result).

In headless mode (`pi -p ...`) it defaults to commit + push.

## Install

```sh
pi install git:https://github.com/kcurtet/pi-commit
```

## Usage

```text
/commit
```

## License

MIT
