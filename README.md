# AI Factory

AI Factory is a safety-first control plane for running a multi-agent AI company. It routes work from a CEO orchestrator to bounded departments, connects model providers and business tools, and keeps approvals, budgets, retries, and audit events explicit.

## What it does

- Routes objectives and events to specialized departments.
- Supports OpenAI/Codex, Claude, Gemini, Ollama, Groq, OpenRouter, and other configured providers.
- Runs RAG, tool-calling, planning, research, drafting, and operating-review workflows.
- Enforces department capabilities, approval gates, idempotency, budgets, and stop controls.
- Keeps credentials server-side and records model, tool, approval, cost, and result events.
- Includes a local Ollama worker for internal-only recurring department loops.

## Stack

TypeScript, Next.js, React, pnpm workspaces, Prisma/PostgreSQL, Clerk, Redis, and provider-specific adapters. The Rust orchestrator package provides the production orchestration runtime; the dashboard is the operator control plane.

## Run locally

```bash
pnpm install
cp .env.example .env
pnpm --filter @ai-factory/dashboard dev
```

The dashboard runs at `http://localhost:3001`. Configure Clerk, PostgreSQL, and at least one model provider before using authenticated AI routes. For safe local department loops, start Ollama and run:

```bash
pnpm --filter @ai-factory/local-worker start
```

Useful checks:

```bash
pnpm build
pnpm test
```

## Safety model

Research, analysis, planning, drafting, and other reversible internal work can run within configured limits. Outreach, public publishing, contracts, regulated claims, payments, sensitive-data access, and destructive operations require explicit, action-scoped approval. The system does not create demo users or fabricate activity.

See [SPIRITUAL_AI_FACTORY.md](./SPIRITUAL_AI_FACTORY.md) for the full architecture, activation order, provider boundaries, and safety policy. See [USAGE.md](./USAGE.md) for setup details.
