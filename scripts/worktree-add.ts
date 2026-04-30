#!/usr/bin/env bun
import { execFileSync } from "node:child_process";
import { existsSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

const DEFAULT_LINKED_FILES = [".env"];
const ENV_LOCAL_FILE = ".env.local";
const ENV_LOCAL_HEADER =
  "# Per-worktree env overrides. Variables here override values from .env.\n";

const printUsage = () => {
  process.stderr.write(
    [
      "Usage: bun run worktree:add <branch> [--from <base>] [--link <file>]...",
      "  <branch>          Branch name (also used as the worktree directory name).",
      "  --from <base>     Base ref to branch from (default: current HEAD).",
      "  --link <file>     Additional file at repo root to symlink (repeatable).",
      "                    .env is always linked when present.",
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
  base?: string;
  branch: string;
  extraLinks: string[];
}

const parseArgs = (argv: readonly string[]): ParsedArgs => {
  const extraLinks: string[] = [];

  let branch: string | undefined;
  let base: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? "";

    switch (arg) {
      case "--from": {
        i += 1;
        base = argv[i] ?? fail("--from requires a base ref argument.");

        break;
      }
      case "--help":
      case "-h": {
        printUsage();
        process.exit(0);

        break;
      }
      case "--link": {
        i += 1;
        const file = argv[i] ?? fail("--link requires a file argument.");

        extraLinks.push(file);

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

  return { base, branch: branch ?? fail("Missing required <branch> argument."), extraLinks };
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
const { base, branch, extraLinks } = parseArgs(process.argv.slice(2));
const worktreePath = resolve(repoRoot, ".worktrees", branch);

if (existsSync(worktreePath)) {
  fail(`Worktree already exists at ${relative(repoRoot, worktreePath)}`);
}

const branchExists = tryGit(["show-ref", "--verify", `refs/heads/${branch}`], { cwd: repoRoot });

const worktreeArgs = branchExists
  ? ["worktree", "add", worktreePath, branch]
  : base === undefined
    ? ["worktree", "add", worktreePath, "-b", branch]
    : ["worktree", "add", worktreePath, "-b", branch, base];

execFileSync("git", worktreeArgs, { cwd: repoRoot, stdio: "inherit" });

const filesToLink = [...new Set([...DEFAULT_LINKED_FILES, ...extraLinks])];

for (const file of filesToLink) {
  const source = resolve(repoRoot, file);

  if (existsSync(source)) {
    const target = resolve(worktreePath, file);

    if (existsSync(target)) {
      process.stdout.write(`Skipping ${file}: already exists in worktree.\n`);
    } else {
      symlinkSync(source, target);
      process.stdout.write(`Linked ${file} -> ${relative(worktreePath, source)}\n`);
    }
  } else {
    process.stdout.write(`Skipping ${file}: not found at repo root.\n`);
  }
}

const envLocalPath = resolve(worktreePath, ENV_LOCAL_FILE);

if (existsSync(envLocalPath)) {
  process.stdout.write(`Skipping ${ENV_LOCAL_FILE}: already exists in worktree.\n`);
} else {
  writeFileSync(envLocalPath, ENV_LOCAL_HEADER);
  process.stdout.write(`Created ${ENV_LOCAL_FILE} for per-worktree overrides.\n`);
}

process.stdout.write(`\nWorktree ready at ${relative(repoRoot, worktreePath)}\n`);
