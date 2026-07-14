import { createHash, randomUUID } from 'node:crypto';
import type { ApprovalRequest, Clock, DepartmentTask } from './types';
import { HIGH_RISK_ACTIONS } from './types';

export function requiresHumanApproval(task: Pick<DepartmentTask, 'action'>): boolean {
  return (HIGH_RISK_ACTIONS as readonly string[]).includes(task.action);
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, stable(v)]));
  }
  return value;
}

/** The approval is bound to the exact action and payload, preventing an agent
 * from changing recipients, amounts, or content after approval. */
export function taskPayloadDigest(task: DepartmentTask): string {
  const payload = JSON.stringify(stable({
    organizationId: task.organizationId,
    departmentId: task.departmentId,
    capability: task.capability,
    action: task.action,
    objective: task.objective,
    input: task.input,
  }));
  return createHash('sha256').update(payload).digest('hex');
}

export function makeApprovalRequest(
  task: DepartmentTask,
  clock: Clock,
  ttlMs: number,
): ApprovalRequest {
  const now = clock.now();
  return {
    id: randomUUID(),
    taskId: task.id,
    organizationId: task.organizationId,
    action: task.action,
    status: 'pending',
    summary: `${task.departmentId}: ${task.title}`,
    payloadDigest: taskPayloadDigest(task),
    requestedAt: now,
    expiresAt: new Date(now.getTime() + ttlMs),
  };
}

export function approvalAllowsTask(approval: ApprovalRequest, task: DepartmentTask, now: Date): boolean {
  return approval.status === 'approved' && approval.expiresAt > now && approval.payloadDigest === taskPayloadDigest(task);
}
