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

## Local skills

`.agents/skills/` ships skill packs for the libraries and patterns used here. The bullets above cover discovery via `intent`; this list pins the high-leverage skills to the topic they cover so an agent doing typical work can skip the discovery step:

- `effect-best-practices`: Effect-TS patterns, services, layers, error channel, observability, anti-patterns. Load before changes touching `Effect.gen`, `appRuntime.runPromise`, `Effect.tryPromise`, or anything under `src/lib/` that yields effects.
- `safe-action-*`: server action authoring. Sub-skills: `client`, `forms`, `hooks`, `middleware`, `validation-errors`, `testing`, `better-auth`, `tanstack-query`, `advanced`. Load the matching one before touching `src/actions/` or any form wired through `useAction`.
- `better-auth-best-practices`, `better-auth-security-best-practices`: auth flows, session, anonymous users. Load when touching `src/lib/auth.ts`, `src/lib/auth-context.ts`, `src/proxy.ts`, or auth middleware.
- `ai-sdk`: Vercel AI SDK patterns, `streamText`, `generateText`, tools, message conversion. Load when touching `src/app/api/chat/route.ts`, `src/agents/`, or tool definitions.
- `openrouter-typescript-sdk`, `openrouter-models`: provider client and model selection. Load when changing `src/lib/openrouter.ts` or model configuration.
- `upstash-redis-js`, `upstash-ratelimit-js`: Redis and rate-limit patterns. Load before changes to `src/lib/rate-limit.ts`.
- `ai-elements`: chat UI components. Load before changes under `src/components/ai-elements/`.
- `shadcn`: component library conventions. Load before adding new shadcn primitives.
- `streamdown`: markdown/code-block rendering inside chat. Load when touching `src/components/ai-elements/message.tsx` or `code-block.tsx`.
- `humanizer`: prose cleanup. Already referenced in the Writing section; load before editing docs or user-facing copy.

## Conventions

- **TypeScript:** `strict` mode with `noUncheckedIndexedAccess` and `noImplicitOverride` ([`tsconfig.json`](tsconfig.json)).
- **Lint:** ESLint with [`@jimmy.codes/eslint-config`](https://github.com/jimmy-guzman/eslint-config).
- **Format:** [oxfmt](https://oxc.rs/docs/guide/usage/formatter.html) (`.oxfmtrc.json`).
- **UI:** Tailwind CSS v4 and shadcn/ui (`package.json` dependencies).
- **Safe areas:** [`tailwindcss-safe-area`](https://github.com/mvllow/tailwindcss-safe-area) is imported in `src/app/globals.css` and the root layout sets `viewport.viewportFit = "cover"` (`src/app/layout.tsx`). Any route or component whose bottom edge holds an interactive element (buttons, composers, CTAs) must use `pb-safe-or-{n}` so iOS Safari's dynamic toolbar and home indicator don't clip it. `pb-safe-or-N` resolves to `max(safe-area-inset-bottom, N)`, so desktop is unaffected. Apply `px-safe-or-{n}` (or `pl-safe-or-{n}` / `pr-safe-or-{n}`) on any route container whose content reaches the screen edges, so iOS rounded display corners and landscape sensor housings don't clip interactive content. Note: iOS does not expose the display corner radius via CSS env vars, so safe-area utilities alone don't prevent corner clipping in portrait. For bottom-anchored interactive content to clear the corner curve, the wrapper must be its own scroll container (`overflow-y-auto` with `min-h-0 flex-1`) so `pb-safe-or-{n}` sits at the end of scrollable content; `pb-safe-or-8` is the baseline for form action rows. Pair `overflow-y-auto` with `overscroll-y-contain` on inner scrollers so iOS boundary gestures don't stall trying to chain to non-scrollable ancestors.
- **Utils:** Use [es-toolkit](https://es-toolkit.dev/llms-full.txt) for utility functions.
- **Charts:** [EvilCharts](https://evilcharts.com), a shadcn-style wrapper over Recharts, added with `bunx shadcn@latest add @evilcharts/<chart>`. Its files land in `src/components/evilcharts/` and count as vendored code: excluded from ESLint (`eslint.config.ts`) and registered as a knip entry, the way `components/ui` and `components/ai-elements` already are.
- **Chat code blocks:** Rendered by AI Elements `CodeBlock` (`src/components/ai-elements/code-block.tsx`) wired into `<Streamdown>` via `components.code` and `components.inlineCode` in `src/components/ai-elements/message.tsx`. Streamdown's built-in code toolbar is disabled (`controls={{ code: false }}`); do not re-enable it. The `@streamdown/code` plugin is intentionally not used (AI Elements does its own shiki highlighting).
- **Chat links:** The markdown anchor is overridden via `components.a` (`MarkdownAnchor` in `src/components/ai-elements/message.tsx`). Internal links (href starting with a single `/`) render as a Next.js `<Link>` for client-side navigation. External links render a button gated behind `LinkSafetyModal`. Streamdown's built-in `linkSafety` prop is not used; overriding `a` replaces the only place it was consulted.
- **Design conventions:** See [DESIGN.md](DESIGN.md) for visual and copy decisions that apply across the UI.

When changing API client types or AI SDK-related code, run `bun run lint` and `bun run build`; use `bunx` for one-off CLIs where needed.

## Architecture

- **Anonymous users have the same features as signed-in users.** `src/proxy.ts` auto-provisions an anonymous session for every visitor via `auth.api.signInAnonymous`, so `session?.user` is always truthy. The only difference is that anonymous sessions don't persist across devices or browsers. To check whether a user has a real account, use `!session.user.isAnonymous` (the `isSignedIn` pattern in `src/app/(chat)/layout.tsx`). Never gate data fetching on `session?.user` alone when you mean "has an account" - anonymous users legitimately own agents, conversations, and all the same data as signed-in users.
- **Agents are user-owned, private, runtime-defined.** Each agent is a row in `agent` (`src/db/schemas/agent-schema.ts`) with selected tools in `agent_tool`. There is no sharing, no orgs, no templates. The one exception is the system agent ("Comal"), which is lazily provisioned per-user and marked with `is_system = true`.
- **Agent settings use a shell layout at `/agents/[agentId]`.** `src/app/(chat)/agents/[agentId]/layout.tsx` renders a shared header (breadcrumb with agent picker) and a sidebar nav for desktop (`AgentSettingsNav`) with a drawer fallback for mobile (`AgentSettingsMobileNav`). Sub-pages live in segment directories: `basics/`, `prompt/`, `tools/`, `sub-agents/`, `evals/`, `cost/`, `versions/`, and `danger/`. The index `page.tsx` is the overview. `cost/` is read-only observability, not config, so it skips the system-agent redirect the config pages do.
- **Tool registry is static and builtin-only.** `src/agents/tools/registry.ts` exposes `tools.list()` and `tools.get(id)`, and `src/agents/tools/build.ts` exposes `buildTool(id, config, context)`. Each tool lives in `src/agents/tools/<group>/<name>.ts` (the runtime builder) with a sibling `<name>.meta.ts` (id, name, description, group, config schema). To add a tool: create both files, then register the meta in `registry.ts` and the builder in `build.ts`. There is no `register()` API and no `source` discriminator; if a tool needs per-agent config, declare it in the meta's `configSchema` and read it inside the builder (see `web/fetch.ts` reading `needsApproval`). Builders that need the current user receive it via `ToolContext` (`src/agents/tools/types.ts`), which `loadAgent` constructs and passes through at build time.
- **`loadAgent(agentId, userId)`** in `src/agents/index.ts` is the single composition point: fetches the agent scoped to the owner, resolves tool ids against the registry, returns an `AgentConfig`. The chat route (`src/app/api/chat/route.ts`) calls it with `ctx.session.user.id`.
- **Sub-agents are user-defined runtime tools, not static registry entries.** An agent can designate other agents it owns as sub-agents via the `agent_subagent` join table (`src/db/schemas/agent-schema.ts`). Each row stores a `parent_agent_id`, `child_agent_id`, `alias` (the tool name exposed to the parent model), and an optional `description_override`. At runtime, `loadAgent(agentId, userId, { depth })` synthesises one `DynamicTool` per sub-agent edge and appends it to the parent's tool list. Sub-agents run via `ToolLoopAgent` with a depth-dependent `stopWhen`: the root turn caps at 8 steps (set in `src/app/api/chat/route.ts`), a depth-1 sub-agent caps at 4, and a depth-2 sub-agent caps at 2 (`subagentStepCap` in `src/agents/subagent.ts`). The depth ceiling is `MAX_DEPTH = 2`; a child loaded at depth 2 receives no sub-agent tools, so delegation tops out at three tiers (root, child, grandchild). Approval configs are stripped from all child tools at load time so sub-agents never block on human approval mid-run.
- **Cycle prevention for `updateAgent` runs inside its transaction.** `src/lib/agent-graph.ts` exposes `detectSubAgentCycle`, which assembles the owner's parent->child graph and returns any cycle path. `updateAgent` (`src/lib/agents.ts`) runs it inside its transaction, after locking every agent row the owner has, so the check sees a graph consistent with the locked write. That closes a race where two concurrent edits to different agents each passed a check against a stale graph (#140). `create-agent` still checks in the action layer: a brand-new agent has no incoming edges, so it cannot join a cross-agent cycle. Runtime depth tracking (`MAX_DEPTH`) is a second safety net. Self-links are blocked by a DB CHECK constraint and an explicit action guard.
- **Agent versions are immutable config snapshots.** The `agent_version` table (`src/db/schemas/agent-schema.ts`) stores a frozen copy of the agent's model, system prompt, tools, sub-agents, and evals at a point in time, with `created_by` attribution. Conversations reference the version used (`conversation.agent_version_id`), and eval runs are tied to the version they ran against (`agent_eval_run.agent_version_id`). The version history UI lives at `/agents/[agentId]/versions`.
- **Eval runs are traceable conversations.** `runEval(evalId, userId)` in `src/lib/eval-runner.ts` is the shared runner behind both the `run-eval` server action (`src/actions/run-eval.ts`) and the `evals-run` tool (`src/agents/tools/evals/run.ts`). It runs the agent through the streaming path (`streamText` with `stopWhen: stepCountIs(8)` and `experimental_context`, so sub-agent inner traces persist) rather than `generateText`. Each trial creates its own `conversation` row with `kind = "eval"` and writes the run into `chat_event` via `persistChatStream`; the run's `agent_eval_run.conversation_id` links the score to that trace. The `conversation.kind` column (`'chat' | 'eval'`, CHECK-constrained) keeps eval conversations out of `/chats`, `listConversationsForAgent`, and `traces-list-for-agent`. Reach an eval run's trace through its `conversation_id`, via `traces-get` or `/chats/[conversationId]/trace`. Opening an eval conversation at `/chats/[conversationId]` redirects to its trace so the scored run stays immutable. A mid-stream model failure is persisted as a `turn-error` event and still recorded as a run, so failures are inspectable in the trace.
- **The `tool-call` scorer grades tool use from the trace.** An eval with `scorer = 'tool-call'` carries a structured `assertion` (jsonb column on `agent_eval`, validated by `toolCallAssertionSchema` in `src/lib/eval-input-schema.ts`): `mustCall` / `mustNotCall` arrays of tool names (a registry id, or a `subagent_<alias>` sub-agent name) and `mustCallWithArgs` (partial argument matches). `runEval` dispatches to it after the `llm-judge` branch: `getConversationToolCalls` (`src/lib/chat/store.ts`) reads the run's `tool-input-complete` and `tool-approval-requested` events, and `scoreToolCall` (`src/lib/eval-scorer.ts`) scores the fraction of satisfied constraints, writing a per-constraint checklist into `rationale`. It is single-trial, like `llm-judge`. The `evals-create` / `evals-update` tools cannot author it (their `scorer` enum is `OUTPUT_SCORER_OPTIONS`, which excludes `tool-call`); the eval picker UI authors it through `ToolCallAssertionEditor`, whose form shape and converters live in `src/components/tool-call-assertion-form.ts`.
- **Eval runs are sandboxed.** `runEval` loads the agent with `loadAgent(agentId, userId, { sandbox: true })`. `sandboxToolSet` (`src/agents/sandbox.ts`) replaces the `execute` of every non-`read` registry tool with a stub and clears approval on all tools, so a run records its tool-call decisions in the trace without performing real writes, recursive eval runs, or external mutations. The `sandbox` flag propagates through `loadAgent` into sub-agent loads. `read` tools still execute, so multi-step chains work. `loadAgent`'s third argument is an options object, `{ depth?, sandbox? }`.
- **Sub-agent tool output shape:** preliminary yields send `{ runId, status: "running", messages: UIMessage[] }`; the terminal output, `{ runId, status: "done", text: string }`, is the last `yield`, not a `return`. The AI SDK's `executeTool` consumes a generator tool with `for await...of`, which discards the generator's `return` value and treats the final `yield` as the result. Returning the done payload instead of yielding it leaves `toModelOutput` parsing a stale `running` value and handing the parent model empty text. The sub-agent's inner stream is persisted as `chat_event` rows linked to the parent tool call via `parent_tool_call_id`. The chat route passes `experimental_context` (containing `conversationId` and `modelId`) to `streamText`, which the sub-agent tool reads at execution time. On page load, `projectSubagentTraces` in `src/lib/chat/projector.ts` groups child events by `parentToolCallId` and projects each group into `UIMessage[]`. `projectMessages` filters out child events (where `parentToolCallId` is non-null) so the main timeline stays clean. `src/components/tool-part.tsx` detects the sub-agent shape and renders a collapsible transcript, using live stream messages during streaming and persisted traces on reload.
- **System agent ("Comal") is lazily provisioned per-user.** `src/lib/system-agent.ts` exports `getOrCreateSystemAgent(userId)`, which inserts with `onConflictDoNothing` against a partial unique index `(user_id) WHERE is_system = true`, then selects the row. Tool rows are inserted with `onConflictDoNothing` so retries are idempotent. The system agent cannot be edited or deleted (guards in both server actions and the `agents-update`/`agents-delete` tools). The home page lazy-creates it for users with no agents and redirects to a new conversation.
- **Chat routes live under `/chats`.** `/chats` lists all conversations with optional per-agent filtering (`?agent=<id>`). `/chats/new` starts a new conversation (accepts `?agent=` to preselect). `/chats/[conversationId]` is the conversation view. `/chats/[conversationId]/trace` renders the full execution timeline of a conversation from raw `chat_event` rows, including timing, tool inputs/outputs, token counts, per-step and per-run cost, and nested sub-agent steps. The home page (`/`) provisions the system agent when the user has none, otherwise links to `/chats/new` with the most recent agent.
- **Cost is computed once and read back everywhere.** `persistChatStream` prices each `assistant-turn-finish` event against `model_pricing` and stores the result in `chat_event.cost_microdollars` (integer microdollars, USD x 1,000,000). Nothing downstream recomputes; it all reads that column. `src/lib/cost.ts` holds the rollup queries: `getAgentCostRollup` (totals, per-model, and per-conversation breakdown, scoped to chat conversations with an optional `since` floor), `getAgentSpendByDay` (daily series for the chart), and `getEvalSuiteRunCosts` (total eval spend plus cost per eval suite run, grouped by `suite_run_id`). Sums include sub-agent inner turns, since those `chat_event` rows carry real cost; turn counts and the per-turn average count only top-level turns. The dashboard at `/agents/[agentId]/cost` renders these with a 30d/90d/all-time `?range=` toggle, and the `cost-summary` tool wraps `getAgentCostRollup` so Comal can answer spend questions in chat. `formatMicrodollars` (`src/lib/format-cost.ts`) is the shared microdollar-to-USD formatter, kept free of server imports so client components can use it.
- **Assistant messages have an action menu.** `src/components/chat-view.tsx` renders `MessageActionsMenu` (`src/components/message-actions.tsx`) under each completed assistant message, inside a `MessageActions` row (`src/components/ai-elements/message.tsx`). It is a dropdown whose only item so far is "save as eval", which opens `SaveAsEvalDialog` (`src/components/save-as-eval-dialog.tsx`) prefilled with the preceding user message as `input` and the assistant reply as `expected`, then appends it to the agent through `addAgentEvalAction` (`src/actions/add-agent-eval.ts`). The menu is hidden for the system agent, which cannot hold evals, and while the last message is still streaming. Add new per-message actions to this menu rather than building a second row.
- **List index pages** (`/chats`, `/agents`, `/tools`) share the same list chrome (`h1`, header row with optional primary action, `max-w-5xl`) and use shadcn `Item` / `ItemGroup` in a responsive grid (`variant="outline"` tiles). `/tools` repeats that pattern once per tool registry group section.
- **Server actions own all writes; `AgentService.update` is the single atomic write path.** `src/actions/{create,update,delete}-agent.ts` use `next-safe-action`. Per-concern update actions (`update-agent-basics.ts`, `update-agent-prompt.ts`, `update-agent-tools.ts`, `update-agent-subagents.ts`, `update-agent-evals.ts`) each accept their own slice plus `agentId` and call `AgentService.update` (`src/lib/agents.ts`) with a patch function, `(current) => next`. The update method runs the whole read-modify-write inside one transaction: it locks every `agent` row the owner has with one `SELECT ... FOR UPDATE` ordered by id, reads the current config, applies the patch, checks for a sub-agent cycle, and writes. Locking the whole owner set rather than the single target row serializes concurrent updates across all of an owner's agents, so two writes issued close together (two browser tabs, "save as eval" twice) can no longer drop each other's changes, and a cross-agent sub-agent cycle check always sees a consistent graph. The method also owns the existence, ownership, and system-agent guards, failing `AgentNotFoundError` or `ForbiddenError`, so callers pass `agentId` and `userId` without a separate `AgentService.assertOwnership` pre-check. The monolithic `update-agent.ts` action takes a full `AgentInput` and passes `() => input` as the patch. Mutations validate against `agentInputSchema` (`src/lib/agent-input-schema.ts`), which `superRefine`s tool ids against the registry.
- **`runEvalSuite` runs an agent's whole eval suite.** `runEvalSuite(agentId, userId)` in `src/lib/eval-runner.ts` runs every eval the agent owns through `EvalRunnerService.runEval`, capped at 3 concurrent by an es-toolkit `Semaphore`. The `run-eval-suite` action (`src/actions/run-eval-suite.ts`) and the `evals-run-batch` tool wrap it, and the "Run all evals" button on the evals page calls the action. One failing eval carries an `error` in its result rather than failing the batch. `runEvalSuite` mints a `suiteRunId` and threads it through `runEval` onto every `agent_eval_run` row (the `suite_run_id` column), so a suite run's cost is queryable; `run_group_id` stays separate, grouping only the trials of one multi-trial eval.
- **Eval history surfaces as a per-version trend.** `EvalService.getScoreTrend(agentId)` aggregates every `agent_eval_run` by the `agent_version` it ran against, returning one mean score per version oldest-first, with `isRegression` set when a version scores below the one before it. The evals page (`/agents/[agentId]/evals`) renders it through `EvalTrendChart` (`src/components/eval-trend-chart.tsx`), which flags regressions on the chart and in a short text summary. `EvalService.listRunHistory(agentId, { evalId?, limit?, cursor? })` is the paginated raw-run query behind the `evals-get-history` tool, so Comal can pull run history in chat; it reuses the `createdAt|id` cursor scheme from `ChatStoreService.listTracesForAgent`. `EvalService.listRunsForAgent` (latest run per eval, for the score badges) stays as its own query rather than being derived from a paginated source, since the latest run for an eval can fall on any page.
- **Cache invalidation is paired with every write, in the same code path.** Server Actions use `updateTag(tag)`. Route Handlers (including `/api/chat` and tools that mutate during a chat turn) use `revalidateTag(tag, "max")`. `updateTag` throws Next.js error E872 from a route handler, and because we wrap effects in `Effect.catchAll(...)`, that throw silently swallows the downstream write of any stream event after it. The rule: when the route handler creates, updates, or deletes a row, the matching `revalidateTag` call sits next to the write, not deferred to a later async step. Skipping the invalidation, or pushing it past a navigation boundary, lets `ConversationsProvider`'s re-seed replace fresh client state with stale server state on the next nav.
- **Business logic lives in `Effect.Service` classes with `accessors: true`.** `src/lib/agents.ts`, `chat.ts`, `chat/store.ts`, `chat/persist-stream.ts`, `cost.ts`, `evals.ts`, `eval-runner.ts`, `system-agent.ts` each export one service: `AgentService`, `ChatService`, `ChatStoreService`, `ChatPersistService`, `CostService`, `EvalService`, `EvalRunnerService`, `SystemAgentService`. Call methods via the accessor pattern: `yield* AgentService.getForUser(agentId, userId)`. Services yielding the database get `Database` from context; cross-service deps go in the service's `dependencies: [...]` array (see `EvalRunnerService`). Methods are wrapped with `Effect.fn("ServiceName.method")` for traced spans and annotated with the business ids (`agentId`, `userId`, `conversationId`) that matter.
- **Runtime composition lives in `src/db/runtime.ts`, not `src/db/service.ts`.** `Database` is a `Context.Tag` defined in `src/db/service.ts`, exported alongside `AppLive`, `runQuery`, and `runMutation`. `src/db/runtime.ts` does `Layer.mergeAll(...*.Default).pipe(Layer.provideMerge(AppLive))` and creates `appRuntime` via `ManagedRuntime.make`. Importers pull `appRuntime` from `@/db/runtime`. The split is load-bearing: re-exporting `appRuntime` from `service.ts` creates a runtime-cycle through the services, where `AgentService.Default` is `undefined` at module-eval time. Do not undo it.
- **Errors are `Schema.TaggedError` with domain-specific tags.** `src/lib/errors.ts` defines `AgentNotFoundError`, `AgentVersionNotFoundError`, `ConversationNotFoundError`, `EvalNotFoundError`, `UnknownToolError`, `ForbiddenError`, `UnauthorizedError`, `ValidationError`, `DatabaseError`, `LLMError`, `MessageConversionError`, `AgentCycleError`, `RateLimitCheckError`. There is no generic `NotFoundError`; pick the specific one. Schema errors carry a required `message` field. Action layer handlers re-throw `cause.error` directly when surfacing typed failures rather than reconstructing fresh errors.
- **Persistence stays Effect-based.** The project uses `drizzle-orm/neon-serverless` (WebSocket pool), so `db.transaction()` works fine and is the correct primitive for multi-statement atomic writes. Do not replace transactions with `db.batch()`; that pattern applies only to the Neon HTTP driver, which this project does not use. For a single write, sequence inside a single `runQuery` / `runMutation` closure. For non-trivial Effect work (errors, services, layers, observability, logging), load the `effect-best-practices` skill first; the patterns there go further than this bullet.
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
- **Hooks install automatically via the `prepare` script on `bun install`.** `prepare` runs `lefthook install --reset-hooks-path`. Config lives in [`lefthook.yml`](lefthook.yml).
  No manual setup. Cloning + `bun install` is enough. The `--reset-hooks-path` flag clears any stale `core.hooksPath` before installing, so running `bun install` across the root and multiple worktrees stays idempotent. Without it, lefthook pins `core.hooksPath` to an absolute path and the next `bun install` elsewhere fails its `prepare` step, which also breaks `bun add` and `bunx shadcn add`.
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
