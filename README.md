# comal.dev

Build your own AI agents. Pick a model, write a system prompt, choose tools, chat.

## What's included

- **Next.js 16** with App Router and React 19
- **Tailwind CSS v4** + shadcn/ui
- **Better Auth** — anonymous sessions, GitHub OAuth, organization plugin. Start chatting right away; claim an account later to save history across devices.
- **Drizzle ORM** + Neon Postgres — `agent`, `agent_tool`, `conversation`, and `chat_event` tables. Agents are private to the user that created them.
- **Vercel AI SDK** + OpenRouter — streaming chat with a static, builtin tool registry (`get-current-time`, `web-search` via Tavily, `web-fetch` with user approval, `github-read`).
- **next-safe-action** — typed, auth-aware server actions for agent CRUD.
- **@tanstack/react-form**, nuqs, zod, es-toolkit, sonner, motion.

## Stack

| Layer     | Choice                                  |
| --------- | --------------------------------------- |
| Framework | Next.js 16 (App Router)                 |
| Language  | TypeScript (strict)                     |
| UI        | Tailwind v4 + shadcn/ui                 |
| Forms     | TanStack Form                           |
| Auth      | Better Auth (anonymous + GitHub + orgs) |
| Database  | Drizzle ORM + Neon Postgres             |
| AI        | Vercel AI SDK + OpenRouter              |
| Runtime   | Bun                                     |

## Local development

1. Install dependencies: `bun install`
2. Copy [`.env.example`](.env.example) to `.env` and fill in values:
   - `DATABASE_URL` — Postgres connection string (e.g. [Neon](https://neon.tech))
   - `BETTER_AUTH_SECRET` — random secret for Better Auth
   - `BETTER_AUTH_URL` — base URL of the app for local dev (e.g. `http://localhost:3000`). Optional on Vercel; derived from `VERCEL_URL` / `VERCEL_PROJECT_PRODUCTION_URL` when unset.
   - `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` — [GitHub OAuth app](https://github.com/settings/developers)
   - `NEXT_PUBLIC_APP_URL` — same as `BETTER_AUTH_URL`. Same Vercel fallback applies.
   - `OPENROUTER_API_KEY` — [OpenRouter](https://openrouter.ai/) key for chat
   - `TAVILY_API_KEY` — [Tavily](https://tavily.com) key for web search
3. Push the database schema: `bun run db:push`
4. Run the dev server: `bun dev`

## Deploying to Vercel

`BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` are optional on Vercel. The base URL is derived at runtime from Vercel's built-in env vars (`VERCEL_PROJECT_PRODUCTION_URL` for production, `VERCEL_URL` for previews) by `src/lib/base-url.ts`. Preview deployments work for anonymous sessions, but the GitHub sign-in button is hidden on previews (`VERCEL_ENV === "preview"`) since the OAuth callback is registered against the production domain only.

## Agents

Agents are user-owned and runtime-defined. There are no built-in agents shipped in code. Create one at `/agents/new`: pick a model, write a system prompt, select tools from the registry. The chat route loads the agent scoped to the signed-in user and composes it from the registry at request time.

See `src/agents/index.ts` (`loadAgent`) and `src/lib/agents.ts` (CRUD via Effect + Drizzle).

## Tools and approval

Tools live in `src/agents/tools/` and are registered in `src/agents/tools/registry.ts`. The registry is static and builtin-only; users select from `tools.list()` when configuring an agent. Two execution patterns:

- **Auto-execute:** plain `tool({ execute })` runs immediately when the model calls it. See `web-search.ts` and `get-current-time.ts`.
- **Approval-gated:** `tool({ needsApproval: true, execute })` pauses the stream, surfaces a confirmation UI, and only runs after the user approves. See `web-fetch.ts` (configured via `createWebFetch({ needsApproval })`).

The approval flow uses the AI SDK's `approval-requested` / `approval-responded` part states. The chat client auto-resubmits after an approval response via `lastAssistantMessageIsCompleteWithApprovalResponses`. The server passes `originalMessages` to `toUIMessageStreamResponse` so the streaming state can match tool chunks against existing tool invocations.

## Web search

`web-search` uses [Tavily](https://tavily.com) by default. The tool is built on a `SearchProvider` abstraction in `src/agents/tools/search/`:

- `types.ts` — `SearchProvider` interface and result types
- `tavily.ts` — Tavily implementation
- `format.ts` — formats results as a markdown list for the model
- `index.ts` — `createWebSearch({ provider, needsApproval? })` factory

To swap providers, implement `SearchProvider` and pass it to `createWebSearch` in the registry.
