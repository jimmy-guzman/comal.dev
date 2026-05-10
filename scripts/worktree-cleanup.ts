#!/usr/bin/env bun
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, rmSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";

const printUsage = () => {
  process.stderr.write(
    [
      "Usage: bun run worktree:cleanup [--force] [--dry-run]",
      "  Removes worktrees whose branch has been merged into main or whose",
      "  remote tracking branch is gone (deleted after PR merge).",
      "",
      "  --force       Pass --force to git worktree remove (handles dirty worktrees).",
      "  --dry-run     Print what would be removed without acting.",
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
  dryRun: boolean;
  force: boolean;
}

const parseArgs = (argv: readonly string[]): ParsedArgs => {
  let force = false;
  let dryRun = false;

  for (const arg of argv) {
    switch (arg) {
      case "--dry-run": {
        dryRun = true;

        break;
      }
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
      default: {
        fail(`Unknown argument: ${arg}`);
      }
    }
  }

  return { dryRun, force };
};

const git = (args: string[], options?: { cwd?: string }) => {
  return execFileSync("git", args, {
    cwd: options?.cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }).trim();
};

const gitOrNull = (args: string[], options?: { cwd?: string }): null | string => {
  try {
    return execFileSync("git", args, {
      cwd: options?.cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
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
const { dryRun, force } = parseArgs(process.argv.slice(2));
const worktreesRoot = resolve(repoRoot, ".worktrees");

if (!existsSync(worktreesRoot)) {
  process.stdout.write("No .worktrees/ directory found. Nothing to clean up.\n");
  process.exit(0);
}

const fetchPrunedOrigin = () => {
  execFileSync("git", ["fetch", "--prune", "origin"], { cwd: repoRoot, stdio: "inherit" });
};

const getMergedBranches = (): Set<string> => {
  const output = git(["branch", "--merged", "main"], { cwd: repoRoot });

  return new Set(
    output
      .split("\n")
      .map((line) => line.replace(/^\*?\s+/, ""))
      .filter(Boolean),
  );
};

const isRemoteGone = (branch: string): boolean => {
  const remote = gitOrNull(["config", "--get", `branch.${branch}.remote`], { cwd: repoRoot });

  if (!remote) return false;

  const merge = gitOrNull(["config", "--get", `branch.${branch}.merge`], { cwd: repoRoot });
  const remoteBranch = merge?.startsWith("refs/heads/")
    ? merge.slice("refs/heads/".length)
    : branch;
  const remoteRef = `refs/remotes/${remote}/${remoteBranch}`;

  return !tryGit(["rev-parse", "--verify", remoteRef], { cwd: repoRoot });
};

const findStaleCandidates = (mergedBranches: Set<string>): { branch: string; reason: string }[] => {
  const entries = readdirSync(worktreesRoot, { withFileTypes: true });
  const candidates: { branch: string; reason: string }[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const branch = entry.name;
    const worktreePath = resolve(worktreesRoot, branch);
    const relPath = relative(worktreesRoot, worktreePath);

    if (relPath === "" || relPath.startsWith("..") || isAbsolute(relPath)) continue;

    if (mergedBranches.has(branch)) {
      candidates.push({ branch, reason: "merged into main" });
    } else if (isRemoteGone(branch)) {
      candidates.push({ branch, reason: "remote tracking branch gone" });
    }
  }

  return candidates;
};

const getRegisteredWorktreePaths = (): Set<string> => {
  const output = gitOrNull(["worktree", "list", "--porcelain"], { cwd: repoRoot });

  if (!output) return new Set();

  const paths = new Set<string>();

  for (const line of output.split("\n")) {
    if (line.startsWith("worktree ")) {
      paths.add(line.slice("worktree ".length));
    }
  }

  return paths;
};

const removeWorktrees = (candidates: { branch: string; reason: string }[]) => {
  const registeredPaths = getRegisteredWorktreePaths();

  for (const { branch, reason } of candidates) {
    const worktreePath = resolve(worktreesRoot, branch);

    if (!registeredPaths.has(worktreePath)) {
      rmSync(worktreePath, { force: true, recursive: true });
      process.stdout.write(`Removed leftover directory ${branch} (${reason})\n`);

      const deleted = tryGit(["branch", "-d", branch], { cwd: repoRoot });

      if (deleted) {
        process.stdout.write(`Deleted branch ${branch}\n`);
      }

      continue;
    }

    const removeArgs = ["worktree", "remove"];

    if (force) removeArgs.push("--force");

    removeArgs.push(worktreePath);

    try {
      execFileSync("git", removeArgs, { cwd: repoRoot, stdio: "inherit" });
      process.stdout.write(`Removed worktree ${branch} (${reason})\n`);
    } catch {
      process.stderr.write(
        `Failed to remove worktree ${branch}. Use --force for dirty worktrees.\n`,
      );

      continue;
    }

    const deleted = tryGit(["branch", "-d", branch], { cwd: repoRoot });

    if (deleted) {
      process.stdout.write(`Deleted branch ${branch}\n`);
    } else {
      process.stderr.write(`Branch ${branch} not deleted (use git branch -D to force).\n`);
    }
  }
};

fetchPrunedOrigin();

const mergedBranches = getMergedBranches();
const candidates = findStaleCandidates(mergedBranches);

if (candidates.length === 0) {
  process.stdout.write("No stale worktrees found.\n");
  process.exit(0);
}

if (dryRun) {
  process.stdout.write("Stale worktrees that would be removed:\n");

  for (const { branch, reason } of candidates) {
    process.stdout.write(`  ${branch} (${reason})\n`);
  }

  process.exit(0);
}

removeWorktrees(candidates);
