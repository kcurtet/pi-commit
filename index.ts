/**
 * pi-commit — /commit command for pi
 *
 * Inspired by midudev/better-claude commit plugin.
 * Gathers git context, asks what to do, then instructs the agent to
 * split changes into Conventional Commits (one per logical group).
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

const MAX_DIFF = 60_000;

function git(args: string[], cwd: string) {
	return exec("git", args, { cwd, maxBuffer: 20 * 1024 * 1024 });
}

async function gitSafe(args: string[], cwd: string): Promise<string> {
	try {
		const { stdout } = await git(args, cwd);
		return stdout.trim();
	} catch {
		return "";
	}
}

export default function commitExtension(pi: ExtensionAPI) {
	pi.registerCommand("commit", {
		description: "Split changes into Conventional Commits (commit + push / commit only / new branch)",
		handler: async (_args, ctx) => {
			const cwd = process.cwd();
			const inside = await gitSafe(["rev-parse", "--is-inside-work-tree"], cwd);
			if (inside !== "true") {
				ctx.ui.notify("Not a git repository", "error");
				return;
			}

			const status = await gitSafe(["status", "--porcelain=v1", "--branch"], cwd);
			const dirty = status
				.split("\n")
				.slice(1)
				.some((l) => l.trim().length > 0);
			if (!dirty) {
				ctx.ui.notify("Nothing to commit: working tree clean", "info");
				return;
			}

			const choice =
				(await ctx.ui.select("Commit: what to do with these changes?", [
					"1. Commit + push (Recommended)",
					"2. Commit only",
					"3. Commit on a new branch",
			])) ?? "1. Commit + push (Recommended)"; // headless (-p): default like better-claude

			const mode = choice.startsWith("1")
				? "commit-push"
				: choice.startsWith("2")
					? "commit-only"
					: "new-branch";

			const [branch, staged, unstaged, untracked] = await Promise.all([
				gitSafe(["rev-parse", "--abbrev-ref", "HEAD"], cwd),
				gitSafe(["diff", "--cached", "--stat"], cwd),
				gitSafe(["diff", "--stat"], cwd),
				gitSafe(["ls-files", "--others", "--exclude-standard"], cwd),
			]);

			let diff = await gitSafe(["diff", "HEAD"], cwd);
			if (diff.length > MAX_DIFF) {
				const truncated = diff.length;
				diff = diff.slice(0, MAX_DIFF) + `\n... (diff truncated, ${truncated - MAX_DIFF} chars omitted; use git diff yourself for the rest)`;
			}

			const pushOk = mode !== "commit-only";
			const newBranch = mode === "new-branch";

			const prompt = `Commit the current changes following these rules.

## Git context
Current branch: ${branch}
Status:
${status}
Staged stat:
${staged || "(nothing staged)"}
Unstaged stat:
${unstaged || "(nothing unstaged)"}
Untracked files:
${untracked || "(none)"}

Diff:
\`\`\`diff
${diff || "(empty)"}
\`\`\`

## Mode selected by user: ${choice.trim()}
${newBranch
	? `- First create a new branch named after the changes (kebab-case, e.g. feat/side-panel) from the current branch, and switch to it.`
	: `- Stay on the current branch (${branch}). Do NOT create or switch branches.`}

## Instructions
- Split the changes into logical groups; make one commit per group.
- Stage only the files of each group. NEVER stage or commit files matching .env*, secrets, keys, or credentials. If you see one untracked, leave it out and warn the user.
- Commit message format: \`type(scope): summary\` — English, imperative mood, under 72 chars. Body only when the why is not obvious.
- Allowed types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert.
- Do NOT add any Co-Authored-By, session links, or attribution of any kind.
${pushOk ? `- After committing, push with \`git push -u origin HEAD\`. If there is no remote or the push fails, report the error and stop.` : "- Do NOT push."}
- At the end, show a summary: branch, commits created (hash + subject), and push result.`;

			pi.sendUserMessage(prompt);
		},
	});
}
