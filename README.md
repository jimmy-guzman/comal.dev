# bot/agent chat starter

A production-ready Next.js starter for building AI chat and agent applications.

## What's included

- **Next.js 16** with App Router and React 19
- **Tailwind CSS v4** + shadcn/ui (29 components)
- **Better Auth** — anonymous sessions, GitHub OAuth, organization plugin. Start chatting right away; claim an account later to save history across devices.
- **Drizzle ORM** + Neon Postgres — `conversation` and `chat_message` tables, persisted per organization.
- **Vercel AI SDK** + OpenRouter — streaming chat with a `webSearch` tool stub and a `webFetch` tool that requires user approval before execution. Swap in Tavily, Brave, or any other provider.
- **next-safe-action** — typed, auth-aware server actions.
- **@tanstack/react-form**, nuqs, zod, es-toolkit, sonner, motion.

## Stack

| Layer     | Choice                                  |
| --------- | --------------------------------------- |
| Framework | Next.js 16 (App Router)                 |
| Language  | TypeScript (strict)                     |
| UI        | Tailwind v4 + shadcn/ui                 |
| Auth      | Better Auth (anonymous + GitHub + orgs) |
| Database  | Drizzle ORM + Neon Postgres             |
| AI        | Vercel AI SDK + OpenRouter              |
| Runtime   | Bun                                     |

## Local development

1. Install dependencies: `bun install`
2. Copy [`.env.example`](.env.example) to `.env` and fill in values:
   - `DATABASE_URL` — Postgres connection string (e.g. [Neon](https://neon.tech))
   - `BETTER_AUTH_SECRET` — random secret for Better Auth
   - `BETTER_AUTH_URL` — base URL of the app (e.g. `http://localhost:3000`)
   - `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` — [GitHub OAuth app](https://github.com/settings/developers)
   - `NEXT_PUBLIC_APP_URL` — same as `BETTER_AUTH_URL`
   - `OPENROUTER_API_KEY` — [OpenRouter](https://openrouter.ai/) key for chat
3. Push the database schema: `bun run db:push`
4. Run the dev server: `bun dev`

## Wiring up web search

The `webSearch` tool stub lives at `src/agents/tools/web-search.ts`. To activate it, replace the `execute` body with a real provider call.

## Tools and approval

Tools live in `src/agents/tools/` and are registered per agent in `src/agents/`. Two patterns are supported:

- **Auto-execute:** plain `tool({ execute })` runs immediately when the model calls it. See `web-search.ts`.
- **Approval-gated:** `tool({ needsApproval: true, execute })` pauses the stream, surfaces a confirmation UI, and only runs after the user approves. See `web-fetch.ts`.

The approval flow uses the AI SDK's `approval-requested` / `approval-responded` part states. The chat client auto-resubmits after an approval response via `lastAssistantMessageIsCompleteWithApprovalResponses`. The server passes `originalMessages` to `toUIMessageStreamResponse` so the streaming state can match tool chunks against existing tool invocations.
