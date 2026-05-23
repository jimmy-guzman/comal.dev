# AGENTS.md

Agent-focused notes for this repo. For humans, see [README.md](README.md).

Design principles live in [DESIGN.md](DESIGN.md).

Architecture details live in [ARCHITECTURE.md](ARCHITECTURE.md).

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

- **After introducing a new pattern, feature, convention, or structural change, ask whether `AGENTS.md`, `ARCHITECTURE.md`, and/or `README.md` should be updated, then apply the changes.**
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
