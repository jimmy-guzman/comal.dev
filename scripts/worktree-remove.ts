#!/usr/bin/env bun
import { execFileSync } from "node:child_process";
import { dirname, isAbsolute, relative, resolve } from "node:path";

const printUsage = () => {
  process.stderr.write(
    [
      "Usage: bun run worktree:remove <branch> [--force] [--keep-branch]",
      "  <branch>        Worktree directory name under .worktrees/ (also the branch).",
      "  --force         Pass --force to git worktree remove.",
      "  --keep-branch   Do not delete the branch after removing the worktree.",
      "",
    ].join("\n"),
  );
};

const fail = (message: string): never => {
  process.stderr.write(`${message}\n`);
  printUsage();
  process.exit(1);
};

interface ParsedArgs {
  branch: string;
  force: boolean;
  keepBranch: boolean;
}

const parseArgs = (argv: readonly string[]): ParsedArgs => {
  let branch: string | undefined;
  let force = false;
  let keepBranch = false;

  for (const arg of argv) {
    switch (arg) {
      case "--force":
      case "-f": {
        force = true;

        break;
      }
      case "--help":
      case "-h": {
        printUsage();
        process.exit(0);

        break;
      }
      case "--keep-branch": {
        keepBranch = true;

        break;
      }
      default: {
        if (branch === undefined && !arg.startsWith("-")) {
          branch = arg;
        } else {
          fail(`Unknown argument: ${arg}`);
        }
      }
    }
  }

  return { branch: branch ?? fail("Missing required <branch> argument."), force, keepBranch };
};

const git = (args: string[], options?: { cwd?: string }) => {
  return execFileSync("git", args, {
    cwd: options?.cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }).trim();
};

const tryGit = (args: string[], options?: { cwd?: string }) => {
  try {
    execFileSync("git", args, { cwd: options?.cwd, stdio: "ignore" });

    return true;
  } catch {
    return false;
  }
};

const repoRoot = dirname(resolve(git(["rev-parse", "--path-format=absolute", "--git-common-dir"])));
const { branch, force, keepBranch } = parseArgs(process.argv.slice(2));
const worktreesRoot = resolve(repoRoot, ".worktrees");
const worktreePath = resolve(worktreesRoot, branch);
const relBranchPath = relative(worktreesRoot, worktreePath);

if (relBranchPath === "" || relBranchPath.startsWith("..") || isAbsolute(relBranchPath)) {
  fail(`Invalid branch path: ${branch} resolves outside ${relative(repoRoot, worktreesRoot)}`);
}

const removeArgs = ["worktree", "remove"];

if (force) removeArgs.push("--force");

removeArgs.push(worktreePath);

execFileSync("git", removeArgs, { cwd: repoRoot, stdio: "inherit" });
process.stdout.write(`Removed worktree ${worktreePath}\n`);

if (keepBranch) {
  process.stdout.write(`Branch ${branch} kept.\n`);
} else {
  const deleted = tryGit(["branch", "-d", branch], { cwd: repoRoot });

  if (deleted) {
    process.stdout.write(`Deleted branch ${branch}\n`);
  } else {
    process.stdout.write(`Branch ${branch} not deleted (use git branch -D to force).\n`);
  }
}
