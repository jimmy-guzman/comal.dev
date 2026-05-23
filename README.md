# comal.dev

An open source playground for composing your own AI agents from a shared toolbox. Pick a model, write a system prompt, attach some tools, and start chatting.

## About

An open source web app for building private, runtime-defined AI agents. The system prompt, model choice, and tool selection are all per-agent and stored under your account. You can start chatting anonymously and sign in with GitHub if you want to keep the history.

## Features

- **Private, runtime-defined agents.** Each agent has its own system prompt, model, and tool selection. Configuration is per-user; nothing is shared. Settings sub-pages cover basics, prompt, tools, sub-agents, evals, cost, versions, and danger.
- **Curated model picker** across OpenAI, Anthropic, Google, xAI, and DeepSeek (via OpenRouter), each tagged with a relative cost label. Pick a different model per conversation without changing the agent.
- **Anonymous by default, GitHub sign-in for persistence.** Every visitor gets an anonymous session with full feature access; sign in with GitHub when you want conversations and agents to follow you across devices.
- **Streaming chat.** Markdown, code, math, and mermaid render as the stream arrives. The composer accepts file uploads, pasted images, and one-click screenshot capture.
- **Approval-gated tools.** Mark a tool as needing approval and it pauses mid-turn for one-click approve or deny. Sub-agent tools always run without approval gates so delegation doesn't stall.
- **Sub-agents.** Designate other agents you own as sub-agent tools. Up to three tiers of delegation (root, child, grandchild). Inner traces are persisted and rendered as collapsible transcripts on reload.
- **Version history.** Every config change snapshots the agent. Diff any two versions field-by-field and revert to any previous snapshot.
- **Export agent config** as a self-contained JSON file (model, system prompt, tools, sub-agents inlined recursively, evals).
- **Evals.** Attach test cases to an agent and score how it responds.
  - Five scorers: `contains`, `exact`, `Levenshtein`, `llm-judge` (semantic), and `tool-call` (grades which tools the agent used against a declared assertion).
  - Run one eval at a time or kick off the full suite (up to three runs in parallel).
  - Save an assistant reply from chat as a new eval in one click.
  - Sandboxed: write tools are simulated during a run, so evals never touch real data.
  - Per-version trend chart flags regressions across the agent's history.
- **Execution traces.** Every conversation has a step-by-step trace at `/chats/[id]/trace`.
  - Per-step timing, tool inputs and outputs, token usage, and cost.
  - Nested sub-agent steps appear inline in the parent trace.
  - Eval runs are first-class traces too.
- **Cost dashboard.** Per-agent spend, computed once at turn finish and read back across the app.
  - Breakdown by model and by conversation, plus a daily trend chart.
  - Average cost per turn and cost per eval suite run.
  - 30d / 90d / all-time range toggle.
- **Hourly spend budgets.** Runaway usage stops at $5/hour for signed-in users and $1/hour for anonymous, on a sliding window. Chat-request rate limits (200/h authed, 40/h anon) sit on top.
- **Conversations list at `/chats`** with per-agent filtering.
- **Conversational agent management via Comal**, a system agent that creates, configures, and iterates on your agents through chat, including running their evals and inspecting traces.

## Tools

Built-in tools you can attach to an agent, grouped as they appear in the registry and on the `/tools` page.

### Agents

- **List agents**: lists all agents owned by the current user.
- **Get agent details**: returns an agent's full configuration, including tools and sub-agents.
- **List available tools**: returns the tool registry with IDs, names, descriptions, and groups.
- **List available models**: returns the model groups and model IDs available for agent configuration.
- **Create agent**: creates a new agent with the given configuration.
- **Update agent**: updates an existing agent's configuration.
- **Delete agent**: deletes an agent owned by the current user.
- **List agent versions**: lists configuration version snapshots, newest first.
- **Diff agent versions**: compares two version snapshots and returns a field-level diff.
- **Revert agent to version**: restores an agent to a previous version snapshot.

### Core

- **Current time**: returns the current date and time in the user's timezone.

### Cost

- **Summarize agent cost**: returns an agent's chat spend with totals, average cost per turn, a per-model breakdown, and the costliest conversations.

### Evals

- **Create eval**: adds an eval to an agent and snapshots a new version.
- **Update eval**: edits an existing eval and snapshots a new version.
- **Delete eval**: removes an eval and snapshots a new version.
- **List evals**: lists an agent's evals with their latest run summaries.
- **Run eval**: runs one eval against the agent's current configuration and records the score.
- **Run eval suite**: runs every eval for an agent in one batch (up to 3 at a time) and records each score.

### GitHub

- **GitHub read**: reads files from public GitHub repositories in batch.

### TMDB

- **TMDB search**: searches across movies, TV, and people in a single request.
- **TMDB trending**: lists what's trending across movies, TV, and people.
- **TMDB trending movies**: lists trending movies.
- **TMDB trending TV**: lists trending TV series.
- **TMDB discover movies**: discovers movies by genre, year, language, and sort order.
- **TMDB discover TV**: discovers TV series by genre, first-air year, language, and sort order.
- **TMDB movie details**: fetches full metadata for a movie by id.
- **TMDB TV details**: fetches full metadata for a TV series by id.

### Traces

- **List agent traces**: lists recent conversations for an agent with aggregated timing, event count, and cost.
- **Get conversation trace**: returns a conversation's execution trace with timed steps, tool inputs and outputs, errors, and token usage.

### Web

- **Web search**: searches the web via Tavily and returns titles, URLs, and snippets.
- **Web fetch**: fetches the contents of a URL as markdown, text, or HTML.

### Wikidata

- **Wikidata search**: searches Wikidata for entities by label and aliases, returning their Q-ids.
- **Wikidata item**: fetches a Wikidata item's labels, descriptions, statements, and sitelinks by Q-id.
- **Wikidata resolve ids**: resolves a batch of Q-ids and P-ids to labels and descriptions, so an agent can read a statements payload.

Agents can also call other agents you own as sub-agent tools, configured per-agent in the agent form. New users start with Comal, a system agent that creates, configures, and iterates on agents through conversation, including running their evals and inspecting conversation traces to improve them.

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for the system overview, request flow, agent composition, persistence, and data model.

## Tech stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS v4
- shadcn/ui
- Better Auth
- Drizzle ORM + Neon Postgres
- Vercel AI SDK + OpenRouter
- Upstash Redis
- next-safe-action
- TanStack Form
- Bun

## Getting started

1. `bun install`
2. Copy `.env.example` to `.env` and fill in:
   - `DATABASE_URL`
   - `BETTER_AUTH_SECRET`
   - `BETTER_AUTH_URL` (optional locally; pin only if you need a canonical URL)
   - `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`
   - `OPENROUTER_API_KEY`
   - `TAVILY_API_KEY`
   - `TMDB_READ_ACCESS_TOKEN`
   - `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`
3. `bun run db:push`
4. `bun run scripts/seed-pricing.ts` to seed model pricing from OpenRouter (powers cost tracking and hourly usage budgets)
5. `bun dev`
