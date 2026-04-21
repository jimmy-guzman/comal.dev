# comal.dev

An OpenAPI studio. Chat your way to a spec, play with it in a live mock, eject to real code.

## What it is

Comal is a workshop for API design. Bring a spec, or start empty and describe what you want, and Comal becomes the surface where it gets shaped and refined before you write any implementation code.

Sign in is anonymous. Start working right away; claim an account later if you want your workspaces on another device.

Three panes, one source of truth:

- **Chat** — build and change your spec by talking to it. Add pagination to every list endpoint, rename a field everywhere, sketch an auth flow. The model edits the spec through structured operations, so your hand-edits stick.
- **Spec editor** — Monaco with YAML, live validation, always in sync. Type directly or let the chat drive. Errors show up inline as you go.
- **Playground** — once your spec validates, a live mock server spins up. Every endpoint gets a generated UI you can hit. Responses come back with coherent data that stays consistent across requests: `GET /users/123` and `GET /orders?userId=123` return data about the same person. POST a resource and it's there when you GET it.

When you're ready, eject. One command scaffolds a real project from your spec, with typed routes, validated I/O, and a schema inferred from your components. The mock data from your playground carries over as test fixtures, so the work you did while iterating becomes the seed for the real thing.
