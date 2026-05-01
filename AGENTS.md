# AGENTS.md

Agent-focused notes for this repo. For humans, see [README.md](README.md).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

                                                              |

## Conventions

- **TypeScript:** `strict` mode with `noUncheckedIndexedAccess` and `noImplicitOverride` ([`tsconfig.json`](tsconfig.json)).
- **Lint:** ESLint with [`@jimmy.codes/eslint-config`](https://github.com/jimmy-guzman/eslint-config).
- **Format:** [oxfmt](https://oxc.rs/docs/guide/usage/formatter.html) (`.oxfmtrc.json`).
- **UI:** Tailwind CSS v4 and shadcn/ui (`package.json` dependencies).
- **Utils:** Use [es-toolkit](https://es-toolkit.dev/llms-full.txt) for utility functions.
- **Chat code blocks:** Rendered by AI Elements `CodeBlock` (`src/components/ai-elements/code-block.tsx`) wired into `<Streamdown>` via `components.code` and `components.inlineCode` in `src/components/ai-elements/message.tsx`. Streamdown's built-in code toolbar is disabled (`controls={{ code: false }}`); do not re-enable it. The `@streamdown/code` plugin is intentionally not used (AI Elements does its own shiki highlighting).

When changing API client types or AI SDK-related code, run `bun run lint` and `bun run build`; use `bunx` for one-off CLIs where needed.

## Architecture

- **Agents are user-owned, private, runtime-defined.** No built-in agents exist in code. Each agent is a row in `agent` (`src/db/schemas/agent-schema.ts`) with selected tools in `agent_tool`. There is no sharing, no orgs, no templates.
- **Tool registry is static and builtin-only.** `src/agents/tools/registry.ts` exposes `tools.list()` and `tools.get(id)`, and `src/agents/tools/build.ts` exposes `buildTool(id, config)`. Each tool lives in `src/agents/tools/<group>/<name>.ts` (the runtime builder) with a sibling `<name>.meta.ts` (id, name, description, group, config schema). To add a tool: create both files, then register the meta in `registry.ts` and the builder in `build.ts`. There is no `register()` API and no `source` discriminator; if a tool needs per-agent config, declare it in the meta's `configSchema` and read it inside the builder (see `web/fetch.ts` reading `needsApproval`).
- **`loadAgent(agentId, userId)`** in `src/agents/index.ts` is the single composition point: fetches the agent scoped to the owner, resolves tool ids against the registry, returns an `AgentConfig`. The chat route (`src/app/api/chat/route.ts`) calls it with `ctx.session.user.id`.
- **Server actions own all writes.** `src/actions/{create,update,delete}-agent.ts` use `next-safe-action`. Mutations validate against `agentInputSchema` (`src/lib/agent-input-schema.ts`), which `superRefine`s tool ids against the registry. `assertAgentOwnership` gates updates; all actions `revalidatePath("/", "layout")` on success.
- **Persistence is Effect-based.** Use the `Database` `Context.Tag` and `Effect.provide(DatabaseLive)` (or `runWithDb`). Neon HTTP's `db.transaction()` is not supported and throws at runtime, but `db.batch([...])` is — it executes the array of queries atomically via Neon's HTTP transaction endpoint and is the correct primitive when you need multiple writes to commit together. For a single write, sequence inside a single `tryPromise`.
- **Generated API clients live in `src/clients/<name>/`.** Each is produced by `bun run openapi-ts` from a spec; treat `*.gen.ts` and the barrel `index.ts` as build output and do not hand-edit. Tools import SDK functions and types from the barrel (`@/clients/<name>`) only. Auth is passed per-call via the `auth` option on each SDK function (see `src/agents/tools/tmdb/*.ts`); `client.setConfig` is avoided so tools don't mutate a shared singleton. Tools are intentionally thin pass-throughs: they call one SDK function, surface `error` as a thrown `Error`, and return raw `data` so the model gets the upstream shape it already knows.

## Forms

- **Use TanStack Form (`@tanstack/react-form`) for all forms.** No react-hook-form. Pattern: `useForm({ defaultValues, validators: { onSubmit: schema }, onSubmit })`, then `<form.Field>` with a JSX children render-prop (the `react-x/no-children-prop` lint rule forbids `children=` as a prop).
- **Form schema is allowed to differ from the server schema.** UI shape (e.g. `tools: ToolSelection[]` with an `enabled` flag) lives next to the form; persisted shape lives in `agent-input-schema.ts`. They drift independently. Don't try to share one schema across both layers.
- **Wire validation errors through shadcn `<FieldError errors={field.state.meta.errors} />`.** TanStack's Zod issues plug in directly. Mark the wrapping `<Field>` with `data-invalid` and the input with `aria-invalid` based on `field.state.meta.errors.length`.
- **Submit handlers are sync unless they actually `await`.** Marking `onSubmit` `async` without an `await` trips `@typescript-eslint/require-await`.
- **Mutations go through `useAction` from `next-safe-action/hooks`.** Render `result.serverError` for server-side failures.

## Code style & structure

- **Files read bottom-up: helpers at the top, main exported symbol at the bottom.**
  The file's public API is immediately visible when you scroll to the end, and implementation details are grouped in the order you'd naturally compose them.

- **Kebab-case for all filenames and directories. Framework-reserved filenames (e.g. `page.tsx`, `layout.tsx`) are exempt.**
  One casing rule means no bikeshedding at import time. Framework conventions override because fighting them breaks tooling.

- **Use `satisfies` for type narrowing where possible.**
  Preserves the literal type instead of widening to the annotation, which keeps downstream inference tight without giving up the shape check.

- **Test files use the `.spec.ts` suffix and live next to the code they test.**
  Colocation makes tests discoverable alongside the thing they cover, and a single suffix keeps test runners' glob configs simple.

## Code design

- **Extraction is a design decision, not a refactor.**
  When you see duplication, surface it and propose. Do not extract shared helpers, types, or components unprompted, regardless of usage count. Whether two similar blocks are one concept or two is a judgment you don't have the context to make alone.
- **No speculative generality.**
  Don't add config options, generic parameters, or extension points for use cases that don't exist yet. The right abstraction for a future need is almost never the one you'd guess before seeing it.
- **Duplication is cheaper than the wrong abstraction.**
  Code that looks similar isn't necessarily the same thing. Deduping two unrelated pieces couples their futures; when one needs to change and the other doesn't, the abstraction has to grow conditionals or split back apart, both of which are worse than having kept them separate.
- **Derive values, don't assemble them.**
  Bindings should be the result of an expression at the point of declaration. Branching, trying, and looping that exists only to populate a binding is a function waiting to be extracted.

## Type discipline

- **Do not reach for `as`, `!`, or `any` without first exhausting proper solutions. Understand the type error before casting.**
  A type error is signal. Casting silences the signal without fixing the underlying mismatch, and the bug usually surfaces later in a worse place.

- **No redundant return types on internal functions (unexported functions, local arrow `const`s, inline callbacks). Exception: interface method signatures and exported functions where the return type is part of the public contract.**
  Inference handles internal functions correctly and keeps them low-noise. Explicit annotations belong where the type is a contract, not where it duplicates what the compiler already knows.

## Comments

- **No comments other than JSDoc or `TODO`/`FIXME`.**
  Code should explain itself through naming and structure. Comments drift from the code they describe; the ones worth keeping have a specific purpose (API docs, known gaps).

## Testing

- **Test behavior, not implementation.**
  Assert what a caller or user observes, not how the code achieves it. "Caller" and "user" scale with the unit under test: for a component it's the person clicking, for a function it's the code calling it. Tests that assert internals break on every refactor and prove nothing about whether the code works.

- **Mock at the furthest boundary.**
  When something must be faked, fake it as close to the external edge as possible: HTTP at the network layer (e.g. MSW), time with fake timers, randomness with a seeded source. Avoid mocking your own modules; a test that stubs the function next to the code under test exercises almost nothing and passes while real integration is broken.

- **Prefer clarity over DRY in tests.**
  Inline setup, repeat literals, skip shared fixtures when they'd obscure the case under test. A test's job is to be readable in isolation; the pull toward DRY that makes production code better usually makes tests worse.

- **Test real behavior, not hypothetical behavior.**
  Cover the cases the contract actually promises. Do not manufacture edge cases the code doesn't claim to handle just to pad coverage.

## Static analysis

- **Resolve warnings and errors your changes introduce before finishing. Fix the root cause, not the symptom. Do not silence with rule overrides or type casts.**
  Warnings and errors are there because something is genuinely off. Silencing them turns a solvable problem into a latent one.

## Docs

- **After introducing a new pattern, feature, convention, or structural change, ask whether `AGENTS.md` and/or `README.md` should be updated, then apply the changes.**
  Docs rot the moment the code moves without them. Catching the update at the point of change is the only time it reliably happens.

## Writing

- **No em dashes.** Use a comma, period, or restructure the sentence instead.
  Em dashes create rhythm that doesn't translate well to technical writing. They can feel informal or ambiguous about the relationship between clauses.

- **No horizontal rules as section dividers.** Don't use `---` to separate sections when a heading is already doing that job.
  Headings provide structure and are navigable. A `---` on top of a heading is visual noise with no semantic value. Exception: `---` is fine as a thematic break when there is no heading on either side (e.g. a closing thought separated from the last section).

- **No curly/smart quotes in prose.** Use straight quotes (`"`) not curly quotes (U+201C `\u201C` / U+201D `\u201D`).
  Curly quotes are inconsistent across editors and tools, and can cause subtle encoding issues. Straight quotes are unambiguous. Applies to prose only. Code blocks are verbatim and exempt.

- **Sentence case subheadings.** Write `## Like this` not `## Like This`.
  Subheadings are not titles. Sentence case reads more naturally in technical prose and avoids the stiffness of title case. Exception: proper nouns and acronyms follow their standard casing (e.g. `## Working with TypeScript`).

## Pausing

- **Between phases:** After completing a discrete chunk of work, stop. Post a short summary, then ask before starting the next.
  A summary creates a checkpoint for course correction before the next chunk compounds on the last.

- **On uncertainty:** If a decision is not covered by existing rules or context, do not invent. Stop and ask.
  Invented conventions are worse than absent ones. They look authoritative while being arbitrary.

- **On a debug loop:** If the same error persists after 3 consecutive fix attempts, stop. Report the error, what was tried, and the likely cause. Do not attempt a fourth fix without input.
  Repeated failed attempts usually mean the mental model is wrong, not the fix. More attempts make it worse.

## Branching & commits

- **Branch naming: `{type}-{short-description}` in kebab-case. Types: `feat`, `fix`, `refactor`, `chore`, `docs`, `ci`.**
  Predictable branch names make history scannable and let tooling infer intent from the name alone.

- **Commits: Conventional Commits with emoji after the colon and lowercase description. Format: `<type>: <emoji> <description>`. Subject under 50 chars, body wrapped at 72.**
  Structured subjects are readable in every git UI, parseable by release tooling, and the length caps keep `git log --oneline` usable.

- **Commit emojis:** `feat` → ✨, `fix` → 🐛, `docs` → 📝, `chore` → 🤖, `ci` → 👷, `test` → ✅, `refactor` → 🔄, `style` → 🎨, `perf` → ⚡️, `revert` → ⏪, `release` → 🚀.
  Visual anchors for scanning log output; the mapping is fixed so commits stay consistent across projects.

- **Do not commit directly to `main`. Branch first.**
  Branches create a review surface and a revert point. Direct commits skip both.

- **PRs: branch off `main`, title follows Conventional Commits, squash merge.**
  One logical change per commit in history, and PR titles double as release notes when they follow the same format as commits.

## Git hooks

- **Lefthook runs on `pre-commit`.** Three jobs run sequentially: `oxfmt` on staged files, `eslint --fix` on staged TS/JS files, then `knip` on the whole repo. Format runs before lint so eslint's fixes are the final staged content; both auto-fix and re-stage. Knip blocks the commit on any finding.
  Catching issues at commit time is cheaper than at review time. Auto-fix means most lint/format violations never reach the diff. Knip is fast enough to gate every commit. Sequential ordering avoids a race where parallel `stage_fixed` jobs would clobber each other on the same file.
- **Hooks install automatically via the `prepare` script on `bun install`.** Config lives in [`lefthook.yml`](lefthook.yml).
  No manual setup. Cloning + `bun install` is enough.
- **Bypass with `--no-verify`** (`git commit --no-verify`, `git push --no-verify`) only when intentional, e.g. WIP commits on a branch you'll squash before review.
  Hooks exist to be useful, not to be a wall. Bypassing is fine when you know why.
- **Typecheck runs in CI**, not on commit. Lefthook auto-skips when `CI=true` so hooks don't double-run in GitHub Actions.

## Worktrees

- **Worktrees live under `.worktrees/<branch>` with the directory name matching the branch name.** Manage them via `bun run worktree:add <branch>` and `bun run worktree:remove <branch>` ([`scripts/worktree-add.ts`](scripts/worktree-add.ts), [`scripts/worktree-remove.ts`](scripts/worktree-remove.ts)).
  Predictable layout means tooling and humans agree on where a branch's checkout lives.
- **`.env` is symlinked from the repo root into each worktree by `worktree:add`.** Single source of truth: edit `.env` at the root, every worktree sees the change. `.env*` is gitignored, so the symlink itself is never committed. Additional gitignored files at the root can be linked with `--link <file>` (repeatable).
- **`.env.local` is created per-worktree, never linked.** Next.js loads it after `.env`, so it overrides specific keys without mutating the shared root file. This is the override channel; do not symlink `.env.local` across worktrees.
- **`node_modules` is never linked.** Worktrees exist to isolate branch state, including dependency state. Each worktree runs its own `bun install`. Linking `node_modules` would let a `bun install` on one branch silently rewrite another branch's installed tree.
