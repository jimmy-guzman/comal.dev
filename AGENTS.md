# AGENTS.md

Agent-focused notes for this repo. For humans, see [README.md](README.md).

Design principles live in [DESIGN.md](DESIGN.md).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes. APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

## Tech stack

- [Next.js](https://nextjs.org/llms.txt)
- [Vercel AI SDK](https://ai-sdk.dev/llms.txt)
- [Better Auth](https://better-auth.com/llms.txt)
- [Drizzle ORM](https://orm.drizzle.team/llms.txt)
- [shadcn/ui](https://ui.shadcn.com/llms.txt)
- [Upstash](https://upstash.com/docs/llms.txt)
- [Bun](https://bun.sh/llms.txt)
- [es-toolkit](https://es-toolkit.dev/llms-full.txt)
- React 19
- TypeScript
- Tailwind CSS v4
- next-safe-action

<!-- intent-skills:start -->

## Skill Loading

Before substantial work:

- Skill check: run `npx @tanstack/intent@latest list`, or use skills already listed in context.
- Skill guidance: if one local skill clearly matches the task, run `npx @tanstack/intent@latest load <package>#<skill>` and follow the returned `SKILL.md`.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
  <!-- intent-skills:end -->

## Conventions

- **TypeScript:** `strict` mode with `noUncheckedIndexedAccess` and `noImplicitOverride` ([`tsconfig.json`](tsconfig.json)).
- **Lint:** ESLint with [`@jimmy.codes/eslint-config`](https://github.com/jimmy-guzman/eslint-config).
- **Format:** [oxfmt](https://oxc.rs/docs/guide/usage/formatter.html) (`.oxfmtrc.json`).
- **UI:** Tailwind CSS v4 and shadcn/ui (`package.json` dependencies).
- **Safe areas:** [`tailwindcss-safe-area`](https://github.com/mvllow/tailwindcss-safe-area) is imported in `src/app/globals.css` and the root layout sets `viewport.viewportFit = "cover"` (`src/app/layout.tsx`). Any route or component whose bottom edge holds an interactive element (buttons, composers, CTAs) must use `pb-safe-or-{n}` so iOS Safari's dynamic toolbar and home indicator don't clip it. `pb-safe-or-N` resolves to `max(safe-area-inset-bottom, N)`, so desktop is unaffected. Apply `px-safe-or-{n}` (or `pl-safe-or-{n}` / `pr-safe-or-{n}`) on any route container whose content reaches the screen edges, so iOS rounded display corners and landscape sensor housings don't clip interactive content. Note: iOS does not expose the display corner radius via CSS env vars, so safe-area utilities alone don't prevent corner clipping in portrait. For bottom-anchored interactive content to clear the corner curve, the wrapper must be its own scroll container (`overflow-y-auto` with `min-h-0 flex-1`) so `pb-safe-or-{n}` sits at the end of scrollable content; `pb-safe-or-8` is the baseline for form action rows. Pair `overflow-y-auto` with `overscroll-y-contain` on inner scrollers so iOS boundary gestures don't stall trying to chain to non-scrollable ancestors.
- **Utils:** Use [es-toolkit](https://es-toolkit.dev/llms-full.txt) for utility functions.
- **Chat code blocks:** Rendered by AI Elements `CodeBlock` (`src/components/ai-elements/code-block.tsx`) wired into `<Streamdown>` via `components.code` and `components.inlineCode` in `src/components/ai-elements/message.tsx`. Streamdown's built-in code toolbar is disabled (`controls={{ code: false }}`); do not re-enable it. The `@streamdown/code` plugin is intentionally not used (AI Elements does its own shiki highlighting).
- **Design conventions:** See [DESIGN.md](DESIGN.md) for visual and copy decisions that apply across the UI.

When changing API client types or AI SDK-related code, run `bun run lint` and `bun run build`; use `bunx` for one-off CLIs where needed.

## Architecture

- **Anonymous users have the same features as signed-in users.** `src/proxy.ts` auto-provisions an anonymous session for every visitor via `auth.api.signInAnonymous`, so `session?.user` is always truthy. The only difference is that anonymous sessions don't persist across devices or browsers. To check whether a user has a real account, use `!session.user.isAnonymous` (the `isSignedIn` pattern in `src/app/(chat)/layout.tsx`). Never gate data fetching on `session?.user` alone when you mean "has an account" - anonymous users legitimately own agents, conversations, and all the same data as signed-in users.
- **Agents are user-owned, private, runtime-defined.** Each agent is a row in `agent` (`src/db/schemas/agent-schema.ts`) with selected tools in `agent_tool`. There is no sharing, no orgs, no templates. The one exception is the system agent ("Comal"), which is lazily provisioned per-user and marked with `is_system = true`.
- **Agent settings use a shell layout at `/agents/[agentId]`.** `src/app/(chat)/agents/[agentId]/layout.tsx` renders a shared header (breadcrumb with agent picker) and a sidebar nav for desktop (`AgentSettingsNav`) with a drawer fallback for mobile (`AgentSettingsMobileNav`). Sub-pages live in segment directories: `basics/`, `prompt/`, `tools/`, `sub-agents/`, `evals/`, `versions/`, and `danger/`. The index `page.tsx` is the overview.
- **Tool registry is static and builtin-only.** `src/agents/tools/registry.ts` exposes `tools.list()` and `tools.get(id)`, and `src/agents/tools/build.ts` exposes `buildTool(id, config, context)`. Each tool lives in `src/agents/tools/<group>/<name>.ts` (the runtime builder) with a sibling `<name>.meta.ts` (id, name, description, group, config schema). To add a tool: create both files, then register the meta in `registry.ts` and the builder in `build.ts`. There is no `register()` API and no `source` discriminator; if a tool needs per-agent config, declare it in the meta's `configSchema` and read it inside the builder (see `web/fetch.ts` reading `needsApproval`). Builders that need the current user receive it via `ToolContext` (`src/agents/tools/types.ts`), which `loadAgent` constructs and passes through at build time.
- **`loadAgent(agentId, userId)`** in `src/agents/index.ts` is the single composition point: fetches the agent scoped to the owner, resolves tool ids against the registry, returns an `AgentConfig`. The chat route (`src/app/api/chat/route.ts`) calls it with `ctx.session.user.id`.
- **Sub-agents are user-defined runtime tools, not static registry entries.** An agent can designate other agents it owns as sub-agents via the `agent_subagent` join table (`src/db/schemas/agent-schema.ts`). Each row stores a `parent_agent_id`, `child_agent_id`, `alias` (the tool name exposed to the parent model), and an optional `description_override`. At runtime, `loadAgent(agentId, userId, depth = 0)` synthesises one `DynamicTool` per sub-agent edge and appends it to the parent's tool list. Sub-agents run via `ToolLoopAgent` with `stopWhen: stepCountIs(8)`. The depth ceiling is `MAX_DEPTH = 1`; a child loaded at depth 1 receives no sub-agent tools. Approval configs are stripped from all child tools at load time so sub-agents never block on human approval mid-run.
- **Cycle prevention is enforced at both write time and runtime.** `src/lib/agent-graph.ts` provides a DFS helper used by `create-agent` and `update-agent` actions to reject cycles before they reach the database. Runtime depth tracking (`MAX_DEPTH`) is a second safety net. Self-links are blocked by a DB CHECK constraint and an explicit action guard.
- **Agent versions are immutable config snapshots.** The `agent_version` table (`src/db/schemas/agent-schema.ts`) stores a frozen copy of the agent's model, system prompt, tools, sub-agents, and evals at a point in time, with `created_by` attribution. Conversations reference the version used (`conversation.agent_version_id`), and eval runs are tied to the version they ran against (`agent_eval_run.agent_version_id`). The version history UI lives at `/agents/[agentId]/versions`.
- **Sub-agent tool output shape:** preliminary yields send `{ runId, status: "running", messages: UIMessage[] }`; the final return sends `{ runId, status: "done", text: string }`. The sub-agent's inner stream is persisted as `chat_event` rows linked to the parent tool call via `parent_tool_call_id`. The chat route passes `experimental_context` (containing `conversationId` and `modelId`) to `streamText`, which the sub-agent tool reads at execution time. On page load, `projectSubagentTraces` in `src/lib/chat/projector.ts` groups child events by `parentToolCallId` and projects each group into `UIMessage[]`. `projectMessages` filters out child events (where `parentToolCallId` is non-null) so the main timeline stays clean. `src/components/tool-part.tsx` detects the sub-agent shape and renders a collapsible transcript, using live stream messages during streaming and persisted traces on reload.
- **System agent ("Comal") is lazily provisioned per-user.** `src/lib/system-agent.ts` exports `getOrCreateSystemAgent(userId)`, which inserts with `onConflictDoNothing` against a partial unique index `(user_id) WHERE is_system = true`, then selects the row. Tool rows are inserted with `onConflictDoNothing` so retries are idempotent. The system agent cannot be edited or deleted (guards in both server actions and the `agents-update`/`agents-delete` tools). The home page lazy-creates it for users with no agents and redirects to a new conversation.
- **Chat routes live under `/chats`.** `/chats` lists all conversations with optional per-agent filtering (`?agent=<id>`). `/chats/new` starts a new conversation (accepts `?agent=` to preselect). `/chats/[conversationId]` is the conversation view. `/chats/[conversationId]/trace` renders the full execution timeline of a conversation from raw `chat_event` rows, including timing, tool inputs/outputs, token counts, and nested sub-agent steps. The home page (`/`) provisions the system agent when the user has none, otherwise links to `/chats/new` with the most recent agent.
- **List index pages** (`/chats`, `/agents`, `/tools`) share the same list chrome (`h1`, header row with optional primary action, `max-w-5xl`) and use shadcn `Item` / `ItemGroup` in a responsive grid (`variant="outline"` tiles). `/tools` repeats that pattern once per tool registry group section.
- **Server actions own all writes.** `src/actions/{create,update,delete}-agent.ts` use `next-safe-action`. Per-concern update actions (`update-agent-basics.ts`, `update-agent-prompt.ts`, `update-agent-tools.ts`, `update-agent-subagents.ts`, `update-agent-evals.ts`) each accept their own slice plus `agentId`, fetch the current agent, merge unchanged fields, and call the shared `updateAgent` function. The monolithic `update-agent.ts` is kept for programmatic updates (e.g. from Comal's tools). Mutations validate against `agentInputSchema` (`src/lib/agent-input-schema.ts`), which `superRefine`s tool ids against the registry. `assertAgentOwnership` gates updates.
- **Cache invalidation is paired with every write, in the same code path.** Server Actions use `updateTag(tag)`. Route Handlers (including `/api/chat` and tools that mutate during a chat turn) use `revalidateTag(tag, "max")` — `updateTag` throws Next.js error E872 from a route handler, and because we wrap effects in `Effect.catchAll(...)`, that throw silently swallows the downstream write of any stream event after it. The rule: when the route handler creates, updates, or deletes a row, the matching `revalidateTag` call sits next to the write, not deferred to a later async step. Skipping the invalidation, or pushing it past a navigation boundary, lets `ConversationsProvider`'s re-seed replace fresh client state with stale server state on the next nav.
- **Persistence is Effect-based.** Use the `Database` `Context.Tag` and `Effect.provide(DatabaseLive)` (or `runWithDb`). The project uses `drizzle-orm/neon-serverless` (WebSocket pool), so `db.transaction()` works fine and is the correct primitive for multi-statement atomic writes. Do not replace transactions with `db.batch()`; that pattern applies only to the Neon HTTP driver, which this project does not use. For a single write, sequence inside a single `tryPromise`.
- **Generated API clients live in `src/clients/<name>/`.** Each is produced by `bun run openapi-ts` from a spec; treat `*.gen.ts` and the barrel `index.ts` as build output and do not hand-edit. Tools import SDK functions and types from the barrel (`@/clients/<name>`) only. Auth is passed per-call via the `auth` option on each SDK function (see `src/agents/tools/tmdb/*.ts`); `client.setConfig` is avoided so tools don't mutate a shared singleton. Tools are intentionally thin pass-throughs: they call one SDK function, surface `error` as a thrown `Error`, and return raw `data` so the model gets the upstream shape it already knows.
- **Client-side stores are React Context + `useState`, split across three files.** Context (and its types) in `src/components/<name>-context.ts`, hook in `src/hooks/use-<name>.ts`, provider component in `src/components/<name>-provider.tsx`. The split is mandatory: keeping the hook and context in the same file as the provider trips `react-refresh/only-export-components`. Server components own the source of truth and pass it as the provider's `initial` prop; the provider re-seeds local state when `initial` changes by storing the previous value in state and resetting during render (do not use `useEffect` for this; it cascades renders and trips `react-hooks/set-state-in-effect`). Mutations from streaming responses (e.g. AI SDK `data-*` parts) call hook setters directly. The conversations sidebar (`src/components/conversations-provider.tsx`, `src/hooks/use-conversations.ts`) is the canonical example.

## Forms

- **Use TanStack Form (`@tanstack/react-form`) for all forms.** No react-hook-form. Pattern: `useForm({ defaultValues, validators: { onSubmit: schema }, onSubmit })`, then `<form.Field>` with a JSX children render-prop (the `react-x/no-children-prop` lint rule forbids `children=` as a prop).
- **Form schema is allowed to differ from the server schema.** UI shape (e.g. `tools: ToolSelection[]` with an `enabled` flag) lives next to the form; persisted shape lives in `agent-input-schema.ts`. They drift independently. Don't try to share one schema across both layers.
- **Wire validation errors through shadcn `<FieldError errors={field.state.meta.errors} />`.** TanStack's Zod issues plug in directly. Mark the wrapping `<Field>` with `data-invalid` and the input with `aria-invalid` based on `field.state.meta.errors.length`.
- **Submit handlers are sync unless they actually `await`.** Marking `onSubmit` `async` without an `await` trips `@typescript-eslint/require-await`.
- **Mutations go through `useAction` from `next-safe-action/hooks`.** Render `result.serverError` for server-side failures.
- **Array default props must be module-level constants, not inline literals.** The `react-x/no-unstable-default-props` rule rejects `= []` in destructuring because a new array reference is created on every render, causing infinite loops in consumers that compare by reference. Declare `const DEFAULT_FOO: Foo[] = []` at module scope and use that as the default instead.

## Code style & structure

- **Files read bottom-up: helpers at the top, main exported symbol at the bottom.**
  The file's public API is immediately visible when you scroll to the end, and implementation details are grouped in the order you'd naturally compose them.

- **Kebab-case for all filenames and directories. Framework-reserved filenames (e.g. `page.tsx`, `layout.tsx`) are exempt.**
  One casing rule means no bikeshedding at import time. Framework conventions override because fighting them breaks tooling.

- **Use `satisfies` for type narrowing where possible.**
  Preserves the literal type instead of widening to the annotation, which keeps downstream inference tight without giving up the shape check.

- **Test files use the `.spec.ts` (node) or `.spec.tsx` (jsdom) suffix and live next to the code they test.**
  Colocation makes tests discoverable alongside the thing they cover. The suffix selects the Vitest project: `.spec.ts` runs in the `node` environment for pure logic, `.spec.tsx` runs in `jsdom` for component tests with React rendering.

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

- **Vitest with two projects: `node` for `*.spec.ts`, `jsdom` for `*.spec.tsx`.** Configured in [`vitest.config.ts`](vitest.config.ts). The jsdom project loads [`src/test/setup.ts`](src/test/setup.ts), which wires `@testing-library/jest-dom` matchers, MSW lifecycle, and a `ResizeObserver` stub (jsdom doesn't ship one, and AI Elements' `useStickToBottom` needs it).
  Splitting environments keeps node-only specs fast and avoids paying jsdom startup for them. The `.spec.tsx` suffix doubles as the selector.

- **MSW is the HTTP mock boundary.** A shared `setupServer` lives in [`src/test/msw-server.ts`](src/test/msw-server.ts); per-test handlers go through `server.use(...)`. `onUnhandledRequest: "error"` means any unmocked outbound HTTP call fails the test loudly.
  Mocking at the network layer (per the testing rule above) means the production transport runs end-to-end, including the AI SDK's stream parsing.

- **For chat/AI SDK responses, build the stream with the SDK's own helpers** (`createUIMessageStream` + `createUIMessageStreamResponse`) inside the MSW handler. Don't hand-craft SSE bytes.
  The helpers track the stream protocol the same way the real `/api/chat` route does, so a future SDK protocol bump moves both sides together instead of breaking the test.

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

- **Humanize prose with the `humanizer` skill.** When writing or editing docs, READMEs, or any user-facing text, load the skill and apply it before finishing.
  AI-generated writing is recognizable. The skill identifies specific patterns (em dash overuse, rule of three, vague attribution, inline-header lists, promotional language) and gives concrete rewrites. Loading it takes one command; not loading it means shipping slop.

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
- **`bun run worktree:cleanup` removes stale worktrees** whose branch has been merged into main or whose remote tracking branch is gone ([`scripts/worktree-cleanup.ts`](scripts/worktree-cleanup.ts)). Pass `--dry-run` to preview, `--force` for dirty worktrees. Run it periodically after merging PRs to keep `.worktrees/` tidy.
- **`.env` is symlinked from the repo root into each worktree by `worktree:add`.** Single source of truth: edit `.env` at the root, every worktree sees the change. `.env*` is gitignored, so the symlink itself is never committed. Additional gitignored files at the root can be linked with `--link <file>` (repeatable).
- **`.env.local` is created per-worktree, never linked.** Next.js loads it after `.env`, so it overrides specific keys without mutating the shared root file. This is the override channel; do not symlink `.env.local` across worktrees.
- **`node_modules` is never linked.** Worktrees exist to isolate branch state, including dependency state. Each worktree runs its own `bun install`. Linking `node_modules` would let a `bun install` on one branch silently rewrite another branch's installed tree.
