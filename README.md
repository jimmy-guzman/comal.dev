# comal.dev

Build your own AI agents. Pick a model, write a system prompt, choose tools, chat.

## About

A web app for creating private, runtime-defined AI agents. Each agent is yours: your system prompt, your model, your selected tools. Start chatting anonymously, sign in with GitHub to keep your history.

## Architecture

High-level view of how a chat request flows through the app.

```mermaid
flowchart TB
  User([User])

  subgraph Browser
    UI[Next.js UI<br/>chat + agent forms]
  end

  subgraph Server[Next.js server]
    Proxy[proxy.ts<br/>anonymous session bootstrap]
    Actions[Server actions<br/>agent + conversation CRUD]
    ChatAPI[/api/chat route/]
    Loader[loadAgent<br/>composes agent + tools]
    Registry[Tool registry<br/>core / web / github / tmdb]
  end

  subgraph External
    OpenRouter[OpenRouter<br/>LLM provider]
    Tavily[Tavily]
    GitHub[GitHub API]
    TMDB[TMDB API]
  end

  subgraph Data
    Neon[(Neon Postgres<br/>Drizzle)]
    Redis[(Upstash Redis<br/>rate limit)]
    Auth[Better Auth]
  end

  User --> UI
  UI --> Proxy
  UI --> Actions
  UI -->|stream| ChatAPI

  Proxy --> Auth
  Actions --> Auth
  Actions --> Neon
  ChatAPI --> Auth
  ChatAPI --> Redis
  ChatAPI --> Loader
  Loader --> Neon
  Loader --> Registry
  ChatAPI --> OpenRouter
  ChatAPI --> Neon

  Registry -.-> Tavily
  Registry -.-> GitHub
  Registry -.-> TMDB
```

## Features

- Private agents with custom system prompts
- Any model available through OpenRouter
- Anonymous sessions, GitHub sign-in to persist history
- Streaming chat with markdown, code, math, mermaid
- Approval-gated tools that pause and ask before running
- Conversation history with per-conversation model switching

## Tools

- **Current time** — Returns the current date and time in the user's timezone.
- **Web search** — Searches the web (via Tavily) and returns a list of titles, URLs, and snippets.
- **Web fetch** — Fetches the contents of a URL and returns it as markdown, text, or HTML.
- **GitHub read** — Reads files from public GitHub repositories in batch.
- **TMDB search** — Searches TMDB across movies, TV, and people in a single request.
- **TMDB trending** — Lists what's trending across movies, TV, and people on TMDB.
- **TMDB trending movies** — Lists trending movies on TMDB.
- **TMDB trending TV** — Lists trending TV series on TMDB.
- **TMDB discover movies** — Discovers movies on TMDB by genre, year, language, and sort order.
- **TMDB discover TV** — Discovers TV series on TMDB by genre, first-air year, language, and sort order.
- **TMDB movie details** — Fetches full TMDB metadata for a movie by id.
- **TMDB TV details** — Fetches full TMDB metadata for a TV series by id.

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
4. `bun dev`
