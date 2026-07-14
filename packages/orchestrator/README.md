# AI Factory Orchestrator

`@ai-factory/orchestrator` contains two APIs:

- `IronClawOrchestrator`, the existing bridge to the Rust service.
- `AutonomousCompanyRuntime`, the provider-neutral, safety-gated runtime for the
  CEO and department agents.

The autonomous runtime contains no demo records and performs no external action
on its own. A department can reach Codex, ChatGPT, Claude, Hermes, Ollama,
OpenRouter, Groq, NVIDIA NIM, or another model only through an explicitly
configured `DepartmentAgentAdapter`.

## Safety model

Research, analysis, drafting, and internal operations may run automatically
within configured token and USD limits. These declared actions always require a
human approval before an adapter is invoked:

- external outreach and phone calls;
- public/social posting;
- acquisition of personal contact data;
- legal representation and filings;
- payments, refunds, and financial commitments.

Approvals expire and are cryptographically bound to the task's organization,
department, capability, objective, action, and input. Changing a recipient, amount, content,
or other input invalidates the approval. Provider credentials do not belong in
tasks, audit records, or this package.

## Minimal setup

```ts
import {
  AutonomousCompanyRuntime,
  InMemoryOrchestratorStore,
} from '@ai-factory/orchestrator';

const runtime = new AutonomousCompanyRuntime({
  organizationId: 'org-id',
  store: new InMemoryOrchestratorStore(), // replace in production
  adapters: [salesAgentAdapter, marketingAgentAdapter], // each grants explicit powers
  budgets: {
    organizationDaily: { maxCostUsd: 100, maxTokens: 1_000_000 },
    departmentDaily: { maxCostUsd: 25, maxTokens: 250_000 },
    defaultTask: { maxCostUsd: 5, maxTokens: 50_000 },
  },
  telegram: telegramEscalationAdapter, // optional; approval notifications only
});

runtime.registerLoop(salesLoopProducer, { intervalMs: 15 * 60_000 });
await runtime.start();
```

Loop producers return task proposals; they must not call providers or external
systems. The runtime then deduplicates, leases, budget-checks, approval-checks,
and executes those tasks through the appropriate adapter.

Every adapter must pass `task.idempotencyKey` through to any provider that can
create an external side effect. The queue is at-least-once: a worker can fail
after a provider accepts an action but before the atomic completion transaction
commits, so provider-level idempotency is required to prevent duplicate sends or
charges.

## Exported API

- `AutonomousCompanyRuntime`: lifecycle, queue execution, approvals, pause/resume,
  emergency stop, recurring loops, and dashboard read methods.
- `SustainableRevenuePlanner`: deterministic CEO prioritization using evidence,
  risk-adjusted margin, customer value, time to value, strategic fit, and
  recurring-revenue potential. High legal/reputational risk and unsupported
  ideas are excluded.
- `OrchestratorStore`: persistence contract for tasks, leases, idempotency,
  approvals, budget reservations, usage, results, audit events, and stop state.
- `InMemoryOrchestratorStore`: empty, single-process development/test store.
- `DepartmentAgentAdapter`: provider/agent execution boundary with an abort signal
  and hard per-task budget. Each adapter declares its provider, allowed actions,
  and namespaced capabilities; the runtime rejects work outside those powers.
- `DepartmentLoopProducer` and `RecurringDepartmentLoop`: non-overlapping,
  stoppable recurring task generation.
- `TelegramEscalationAdapter`: optional human-input notification boundary.
- `requiresHumanApproval`, `taskPayloadDigest`, and `approvalAllowsTask`: reusable
  policy helpers.

The runtime exposes `listTasks`, `listApprovals`, `listAudit`, and
`getTaskResult` for a shared dashboard, plus `decideApproval`, `pauseDepartment`,
`resumeDepartment`, `stop`, and `clearGlobalStop` for control actions.

## Production store requirements

`InMemoryOrchestratorStore` is intentionally not durable. A production
implementation should use Postgres (optionally Redis for wakeups) and must make
`claimNext` and `reserveBudget` atomic. Enforce a unique constraint on
`(organization_id, idempotency_key)`, use lease expiry for worker recovery, store
`completeTask` (usage + result + final status + audit) in one transaction, store
other audit events append-only, encrypt sensitive task results at rest, and isolate all
queries by organization.

Calling `stop()` persists a global emergency stop and aborts cooperative active
adapters. An operator must call `clearGlobalStop()` and then `start()` explicitly;
the runtime never silently resumes after an emergency stop.
