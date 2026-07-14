# Spiritual AI Factory usage

The dashboard is available at `http://localhost:3001`. It begins in configuration mode and displays only real connected state; a new installation therefore shows zeros and `Not configured` statuses.

## Run the dashboard

```bash
cd /home/parzival/ai-factory/apps/dashboard
npm install
npm run dev
```

## Run the safe local department agents

With Ollama available at `http://localhost:11434`, run:

```bash
cd /home/parzival/ai-factory/packages/local-worker
npm run start
```

This launches nine internal-only department agents and nine recurring operating-review loops, including SEO/GEO/AEO. The default model is `qwen2.5:0.5b`; override it with `OLLAMA_MODEL`. The worker deliberately cannot perform outreach, publish content, move money, or use business accounts.

## Configure the runtime

1. Copy `.env.example` into your secret-management workflow.
2. Create a real Clerk application and configure `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`. Enable Google sign-in or passkeys in Clerk for the quickest owner login, and restrict access to invited users. The repository creates no default user. Restart the dashboard, create or invite the intended user, then sign in at `http://localhost:3001/sign-in`.
3. Configure PostgreSQL and validate/generate the core Prisma client:

```bash
DATABASE_URL='postgresql://...' npx prisma validate --schema packages/core/prisma/schema.prisma
DATABASE_URL='postgresql://...' npx prisma generate --schema packages/core/prisma/schema.prisma
```

4. Configure one AI provider and verify it before assigning it to departments. For the owner's ChatGPT account on a trusted local host, run `codex login`; the dashboard detects that login separately from OpenAI API keys.
5. Set budgets, jurisdictions, safety rules, and Telegram owner escalation.
6. To enable one-click company account connections, create a Pipedream project and OAuth client, then set `PIPEDREAM_CLIENT_ID`, `PIPEDREAM_CLIENT_SECRET`, `PIPEDREAM_PROJECT_ID`, and `PIPEDREAM_ENVIRONMENT`. Each signed-in Clerk user receives isolated OAuth connections.
7. Activate departments in read-only or draft-only mode before permitting external actions.

When Clerk keys are absent, localhost stays in an explicit configuration-only mode so the installation can be completed. In that mode, all AI/model APIs return `503` and cannot be used anonymously. When keys are present, Clerk middleware protects every dashboard and API route, and model routes also verify the authenticated user at the handler.

The database seed commands intentionally insert no users, organizations, agents, activity, or metrics. Tenant records must be created through an authenticated onboarding flow.

## Packages

- `packages/core`: departments, capabilities, provider/connector contracts, policy evaluation, Prisma schema, and validation.
- `packages/integrations`: model gateway, local ChatGPT-through-Codex adapter, Pipedream remote MCP gateway, plus approval-gated Razorpay, Microsoft Clarity, and read-only Google Search Console adapters.
- `packages/orchestrator`: CEO prioritization, queues, recurring loops, approval gates, budgets, retries, dead letters, audit events, stop controls, and Telegram escalation contract.
- `packages/local-worker`: nine live local department agents with safe internal-only Ollama loops and truthful dashboard status.
- `apps/dashboard`: CEO control plane, departments, providers, budgets, governance, workflows, and honest live/empty states.

See [SPIRITUAL_AI_FACTORY.md](./SPIRITUAL_AI_FACTORY.md) for the operating architecture and activation order.

## Safety boundary

Research, analysis, planning, drafting, and other reversible internal work can run autonomously inside configured limits. Outreach, calls, public publishing, contracts, regulated claims, money movement, sensitive data, crisis handling, and destructive operations require the configured human or professional approval.

Third-party account creation and connection is intentionally interactive. The CEO may recommend a platform and prepare the setup, but it cannot impersonate the owner, accept platform terms, bypass CAPTCHA or identity checks, or fabricate verification data. After the owner connects an account with OAuth, the CEO can use approved tools within department policy and action-specific approvals.
