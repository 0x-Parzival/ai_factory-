# Spiritual AI Factory operating architecture

This repository implements a control plane for a real multi-agent spiritual AI company. It deliberately starts with no fabricated employees, activity, revenue, spend, conversations, or integrations.

## Company structure

The CEO Orchestrator owns strategy, prioritization, cross-department delegation, budgets, loop health, and owner escalation. It coordinates Sales, Customer Care, Marketing & Growth, Influencer Partnerships, Product Management & Studio, Backend Engineering & Data Operations, Legal & Compliance, Finance, Data Science & Analytics, and SEO/GEO/AEO. Reliability and spiritual-safety rules are cross-company controls enforced for every department rather than unstaffed department placeholders.

Each department has an explicit capability boundary. A department may research, plan, draft, analyze, and operate its own approved systems. It cannot silently inherit credentials or powers from another department. Provider choice is independent of department authority: Codex/OpenAI, Claude, Hermes, Ollama, OpenRouter, Groq, and NVIDIA can power any department, but tools and external actions are still restricted by that department's policy.

## Purpose and current objective

The factory exists to grow `https://spiritualai.store` into a profitable, trusted personalized-transformation company. Its current operating objective is to find the right customers, creators, distribution partners, and specialist operators, then convert verified demand into sustainable revenue. The CEO prioritizes customer value, qualified demand, conversion, retention, gross margin, and trust using real evidence rather than fabricated activity.

## Autonomy model

The factory can autonomously perform reversible internal work such as research, analysis, drafting, planning, task decomposition, data-quality checks, and retrying idempotent jobs. The following actions require an explicit approval record by default:

- first contact, outbound email, direct messages, or calls;
- public publishing and paid campaigns;
- contracts, legal positions, regulated claims, or policy exceptions;
- payments, refunds, payouts, tax actions, or budget increases;
- account deletion, sensitive-data access, crisis handling, or destructive recovery.

Approvals are scoped to a specific action payload and idempotency key. An approval is not a general authorization for future actions. The CEO may request approval through Telegram after an owner bot and chat are configured.

## Runtime flow

1. An objective, event, order, conversation, or schedule creates a task.
2. The CEO evaluates expected value, urgency, cost, dependency, safety, and policy constraints.
3. Work is routed to a department and an enabled model provider.
4. The department agent performs internal steps and proposes external actions through typed tools.
5. The policy engine executes low-risk work or creates an approval request for high-risk work.
6. Every state change, model call, tool call, approval, cost, and result is appended to the audit stream.
7. Loop stop conditions pause work on budget, repeated failure, policy violation, stale objectives, or a human stop command.

## Provider configuration

Copy `.env.example` to the runtime secret environment and populate only the integrations you want enabled. API keys must remain server-side and should be backed by a proper secrets manager in production. ChatGPT account access is not equivalent to general OpenAI API access: normal OpenAI API routes require a project API key, while a trusted local Codex bridge may use its own supported ChatGPT sign-in. Hermes can also be attached through a dedicated local or remote endpoint.

On a trusted local factory host, `codex login` provides the most convenient owner ChatGPT connection for Codex advisory work. The dashboard detects it and invokes Codex in an ephemeral, read-only, dedicated working directory. Public or multi-tenant deployments should use properly scoped API projects or enterprise access tokens instead of sharing the host login.

Pipedream Connect is the preferred broad business-account gateway. It provides managed OAuth and a fixed remote MCP endpoint for connected accounts. Connections are isolated by authenticated Clerk user; credentials are not returned to the browser or model. A new account connection remains an interactive owner action. MCP tool calls are wrapped in typed business actions so outreach, posting, contracts, credential changes, money movement, and other consequential operations keep their approval requirement.

## Sales conversations

The Sales department treats website chat and eligible social-inbox replies as its primary conversation channels. WhatsApp, SMS, and email follow-up require a recorded opt-in or other reviewed contact basis and suppression checks. Telegram bots cannot initiate user conversations. Discord and Slack are limited to communities or workspaces where the app is installed. X direct messages require eligible recipients and the official API. LinkedIn messaging is restricted to approved access, eligible existing relationships, or approved Message Ads. TikTok is a content-discovery channel rather than a general sales-DM API.

The factory never interprets the existence of a send endpoint as permission to contact someone. The runtime rejects email and social-message actions unless their approval context includes the stable recipient, exact message, relationship or consent basis, channel, dated suppression check, platform-eligibility confirmation, AI disclosure, and idempotency key. Opt-in outreach also requires dated consent evidence. Changed recipients or content require a new approval. Scraped private data, fake accounts, impersonation, duplicate outreach, and bypassing platform limits are prohibited.

## Agent infrastructure providers

The factory uses five provider boundaries for capabilities that should not run inside the main application process:

- AgentMail provides one dedicated company-agent inbox. Provisioning and sends remain approval-gated.
- Composio provides private, per-owner OAuth connections. Exact tools are action-mapped and toolkit versions are pinned before execution.
- Orgo provides persistent cloud desktops. Every view or control operation requires approval.
- Firecrawl provides bounded public-web search and single-page extraction; private and local targets are blocked.
- E2B provides short-lived isolated command execution and destroys the sandbox after each task.

Owner activation instructions are in `PROVIDER_SETUP.md`. Credentials remain server-side and the dashboard never renders them.

The email-first Sales engine lives in `services/openoutreach-spiritualai` as a separate GPLv3 service pinned from upstream commit `c1edbbf40240749134c924b52519c8758eed830a`. This fork defaults external sends off, disables remote freemium promotions, encrypts stored provider and mailbox credentials, freezes every opener and follow-up for exact-draft approval, enforces global suppression and prior-contact checks, caps each mailbox at 15 messages per day, and exposes a localhost bearer-authenticated status/approval API to the factory. Its `SPIRITUALAI_SETUP.md` contains the owner activation sequence.

## User access

Dashboard and model access uses Clerk with server-side resource checks. Configure a real Clerk application with `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`; no demo identity or default password exists. Clerk sign-in methods, MFA, invitations, and membership policy remain under the owner's tenant configuration. Without both keys, the UI is deliberately limited to configuration mode and AI/model APIs are unavailable. With both keys, middleware protects the dashboard and APIs, while each model endpoint independently requires an authenticated Clerk user.

## Activation order

1. Configure PostgreSQL and apply the core Prisma schema.
2. Configure one model provider and verify health/model discovery.
3. Set the company objective, currency, monthly budget, timezone, jurisdictions, and safety policy.
4. Configure Telegram owner escalation.
5. Activate Backend Engineering, Legal, Finance, Analytics, and SEO/GEO/AEO in read-only or draft-only mode. Neon access must use a dedicated least-privilege read-only role and Search Console access must use a read-only OAuth grant.
6. Activate Product, Marketing, Influencer Partnerships, Customer Care, and Sales with draft-only external actions while cross-company reliability and spiritual-safety policies remain enforced.
7. Test approval, audit, retry, idempotency, emergency stop, and credential rotation.
8. Enable selected external actions after channel-specific consent and compliance review.

## Local safe worker

The included local worker deploys one Ollama-backed agent for each of the twelve dashboard departments. It runs recurring, non-overlapping internal research and operating-review loops with token budgets, idempotency, retries, dead letters, and stop controls. The Backend Engineering loop produces only read-only Neon integration and data-quality plans until an approved connector supplies real evidence; the SEO/GEO/AEO loop creates evidence requirements, analysis plans, answer-first briefs, and structured-data drafts. Neither invents live data nor publishes changes. The worker cannot contact people, publish, move money, access account data, or perform any other external action. Its process status is written to a local mode-0600 file and the dashboard ignores stale or dead processes, so it never presents old activity as live.

The dashboard at `http://localhost:3001` reports live worker and provider state when reachable, and honest zeros and unconfigured states otherwise.
