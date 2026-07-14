import { describe, expect, it, vi } from 'vitest';
import {
  AutonomousCompanyRuntime,
  InMemoryOrchestratorStore,
  SustainableRevenuePlanner,
  type NewDepartmentTask,
} from '../src/autonomy';

const budgets = {
  organizationDaily: { maxCostUsd: 100, maxTokens: 1_000_000 },
  departmentDaily: { maxCostUsd: 50, maxTokens: 500_000 },
  defaultTask: { maxCostUsd: 10, maxTokens: 100_000 },
};

function task(action: NewDepartmentTask['action'], key: string): NewDepartmentTask {
  return {
    organizationId: 'org-1', departmentId: 'sales', title: 'Qualified lead action',
    objective: 'Help a prospect who opted in', capability: 'sales.lead_engagement', action, input: { recipient: 'lead-1' },
    priority: 50, idempotencyKey: key, maxAttempts: 3, notBefore: new Date(0),
    budget: { maxCostUsd: 2, maxTokens: 2_000 }, tags: [],
  };
}

describe('AutonomousCompanyRuntime', () => {
  it('deduplicates tasks by organization and idempotency key', async () => {
    const store = new InMemoryOrchestratorStore();
    const runtime = new AutonomousCompanyRuntime({ organizationId: 'org-1', store, adapters: [], budgets });
    const first = await runtime.enqueue(task('research', 'same'));
    const second = await runtime.enqueue(task('research', 'same'));
    expect(second.id).toBe(first.id);
    expect(store.tasks.size).toBe(1);
  });

  it('cannot execute outreach until a payload-bound approval is granted', async () => {
    const store = new InMemoryOrchestratorStore();
    const execute = vi.fn().mockResolvedValue({ output: { sent: true }, costUsd: 0.1, tokens: 20 });
    const runtime = new AutonomousCompanyRuntime({
      organizationId: 'org-1', store, budgets,
      adapters: [{
        departmentId: 'sales', provider: 'codex', capabilities: ['sales.lead_engagement'],
        allowedActions: ['external_outreach'], execute,
      }],
    });
    const queued = await runtime.enqueue(task('external_outreach', 'outreach-1'));
    await runtime.tick();
    expect(execute).not.toHaveBeenCalled();
    const waiting = await store.getTask(queued.id);
    expect(waiting?.status).toBe('awaiting_approval');
    await runtime.decideApproval({ approvalId: waiting!.approvalId!, decision: 'approved', decidedBy: 'owner' });
    await runtime.tick();
    expect(execute).toHaveBeenCalledTimes(1);
    expect((await store.getTask(queued.id))?.status).toBe('succeeded');
  });

  it('enforces each department adapter\'s least-privilege powers', async () => {
    const store = new InMemoryOrchestratorStore();
    const execute = vi.fn();
    const runtime = new AutonomousCompanyRuntime({
      organizationId: 'org-1', store, budgets,
      adapters: [{
        departmentId: 'sales', provider: 'ollama', capabilities: ['sales.research'],
        allowedActions: ['research'], execute,
      }],
    });
    const queued = await runtime.enqueue(task('external_outreach', 'not-granted'));
    await runtime.tick();
    expect(execute).not.toHaveBeenCalled();
    expect((await store.getTask(queued.id))?.status).toBe('failed');
    expect(store.approvals.size).toBe(0);
  });

  it('honors a persisted department pause', async () => {
    const store = new InMemoryOrchestratorStore();
    const execute = vi.fn();
    const runtime = new AutonomousCompanyRuntime({ organizationId: 'org-1', store, adapters: [], budgets });
    const queued = await runtime.enqueue(task('research', 'paused'));
    await runtime.pauseDepartment('sales', 'owner', 'maintenance');
    expect(await runtime.tick('sales')).toBeUndefined();
    expect((await store.getTask(queued.id))?.status).toBe('queued');
    expect(execute).not.toHaveBeenCalled();
  });
});

describe('SustainableRevenuePlanner', () => {
  it('rejects unsupported or excessively risky revenue ideas', () => {
    const planner = new SustainableRevenuePlanner();
    const result = planner.prioritize({
      organizationId: 'org-1', cashRunwayDays: 120, customerSatisfaction: 0.8, generatedAt: new Date(),
      opportunities: [
        { id: 'safe', departmentId: 'product', title: 'Improve product', objective: 'Increase value', capability: 'product.research', action: 'research', expectedRevenueUsd: 1_000, expectedCostUsd: 100, timeToValueDays: 14, confidence: 0.8, customerValue: 0.9, strategicFit: 0.9, legalRisk: 0.1, reputationalRisk: 0.1, recurringRevenue: true, evidence: ['analytics'] },
        { id: 'risky', departmentId: 'sales', title: 'Risky', objective: 'Revenue', capability: 'sales.outreach', action: 'external_outreach', expectedRevenueUsd: 10_000, expectedCostUsd: 10, timeToValueDays: 1, confidence: 0.9, customerValue: 0.4, strategicFit: 0.5, legalRisk: 0.95, reputationalRisk: 0.8, recurringRevenue: false, evidence: ['guess'] },
      ],
    });
    expect(result.map(item => item.id)).toEqual(['safe']);
  });
});
