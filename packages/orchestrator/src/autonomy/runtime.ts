import { randomUUID } from 'node:crypto';
import { RecurringDepartmentLoop, type DepartmentLoopProducer, type RecurringLoopConfig } from './loops';
import { approvalAllowsTask, makeApprovalRequest, requiresHumanApproval } from './safety';
import type { OrchestratorStore } from './store';
import type {
  ApprovalDecision,
  AuditEvent,
  BudgetLimits,
  Clock,
  DepartmentAgentAdapter,
  DepartmentId,
  DepartmentTask,
  NewDepartmentTask,
  StopState,
  TaskResult,
  TelegramEscalationAdapter,
} from './types';
import { systemClock } from './types';

export interface AutonomousRuntimeOptions {
  organizationId: string;
  workerId?: string;
  store: OrchestratorStore;
  adapters: readonly DepartmentAgentAdapter[];
  budgets: BudgetLimits;
  telegram?: TelegramEscalationAdapter;
  clock?: Clock;
  leaseMs?: number;
  executionTimeoutMs?: number;
  approvalTtlMs?: number;
  retryBaseDelayMs?: number;
  pollIntervalMs?: number;
}

export class TaskExecutionError extends Error {
  constructor(message: string, readonly retryable = true) { super(message); }
}

/** Safe execution kernel for the CEO and all departments. Nothing starts until
 * start() is called, and no provider is reachable unless an adapter is supplied. */
export class AutonomousCompanyRuntime {
  private readonly organizationId: string;
  private readonly workerId: string;
  private readonly store: OrchestratorStore;
  private readonly adapters: Map<DepartmentId, DepartmentAgentAdapter>;
  private readonly budgets: BudgetLimits;
  private readonly telegram?: TelegramEscalationAdapter;
  private readonly clock: Clock;
  private readonly leaseMs: number;
  private readonly executionTimeoutMs: number;
  private readonly approvalTtlMs: number;
  private readonly retryBaseDelayMs: number;
  private readonly pollIntervalMs: number;
  private readonly loops: RecurringDepartmentLoop[] = [];
  private readonly activeExecutions = new Map<string, AbortController>();
  private pollTimer?: ReturnType<typeof setTimeout>;
  private started = false;
  private tickRunning = false;

  constructor(options: AutonomousRuntimeOptions) {
    this.organizationId = options.organizationId;
    this.workerId = options.workerId ?? `worker-${randomUUID()}`;
    this.store = options.store;
    this.adapters = new Map(options.adapters.map(adapter => [adapter.departmentId, adapter]));
    this.budgets = options.budgets;
    this.telegram = options.telegram;
    this.clock = options.clock ?? systemClock;
    this.leaseMs = options.leaseMs ?? 60_000;
    this.executionTimeoutMs = options.executionTimeoutMs ?? 5 * 60_000;
    this.approvalTtlMs = options.approvalTtlMs ?? 24 * 60 * 60_000;
    this.retryBaseDelayMs = options.retryBaseDelayMs ?? 5_000;
    this.pollIntervalMs = options.pollIntervalMs ?? 1_000;
    if (!this.organizationId) throw new Error('organizationId is required');
    if (new Set(options.adapters.map(item => item.departmentId)).size !== options.adapters.length) {
      throw new Error('Only one active adapter is allowed per department');
    }
  }

  registerLoop(producer: DepartmentLoopProducer, config: Omit<RecurringLoopConfig, 'organizationId'>): RecurringDepartmentLoop {
    if (this.started) throw new Error('Register loops before starting the runtime');
    const loop = new RecurringDepartmentLoop(
      producer,
      { ...config, organizationId: this.organizationId },
      {
        run: async (current, organizationId, signal) => {
          const stop = await this.stopState();
          if (stop.global || stop.departments.has(current.departmentId) || signal.aborted) return;
          const now = this.clock.now();
          const proposed = await current.propose({ organizationId, departmentId: current.departmentId, now, signal });
          for (const task of proposed) await this.enqueue(task, `loop:${current.departmentId}`);
          await this.audit('loop.completed', `loop:${current.departmentId}`, { proposed: proposed.length }, undefined, current.departmentId);
        },
        onError: async (current, _organizationId, error) => {
          await this.audit('loop.failed', `loop:${current.departmentId}`, { error: this.errorMessage(error) }, undefined, current.departmentId);
        },
      },
      this.clock,
    );
    this.loops.push(loop);
    return loop;
  }

  async start(): Promise<void> {
    if (this.started) return;
    const state = await this.stopState();
    if (state.global) throw new Error(`Runtime is stopped${state.reason ? `: ${state.reason}` : ''}`);
    this.started = true;
    await this.audit('runtime.started', this.workerId, {});
    for (const loop of this.loops) loop.start();
    this.schedulePoll(0);
  }

  async stop(reason = 'operator request', actor = 'operator'): Promise<void> {
    this.started = false;
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = undefined;
    for (const loop of this.loops) loop.stop();
    for (const controller of this.activeExecutions.values()) controller.abort(reason);
    await this.setGlobalStop(true, reason, actor);
    await this.audit('runtime.stopped', actor, { reason });
  }

  /** Clears a persisted emergency stop. It never starts execution by itself. */
  async clearGlobalStop(actor: string, reason = 'operator resumed runtime'): Promise<void> {
    await this.setGlobalStop(false, reason, actor);
  }

  async pauseDepartment(departmentId: DepartmentId, actor: string, reason: string): Promise<void> {
    const current = await this.stopState();
    const departments = new Set(current.departments);
    departments.add(departmentId);
    await this.store.setStopState(this.organizationId, { global: current.global, departments, reason, changedAt: this.clock.now(), changedBy: actor });
    for (const [taskId, controller] of this.activeExecutions) {
      const task = await this.store.getTask(taskId);
      if (task?.departmentId === departmentId) controller.abort(reason);
    }
    await this.audit('department.paused', actor, { reason }, undefined, departmentId);
  }

  async resumeDepartment(departmentId: DepartmentId, actor: string): Promise<void> {
    const current = await this.stopState();
    const departments = new Set(current.departments);
    departments.delete(departmentId);
    await this.store.setStopState(this.organizationId, { ...current, departments, changedAt: this.clock.now(), changedBy: actor });
    await this.audit('department.resumed', actor, {}, undefined, departmentId);
  }

  async enqueue(input: NewDepartmentTask, actor = 'ceo'): Promise<DepartmentTask> {
    if (input.organizationId !== this.organizationId) throw new Error('Cross-organization task rejected');
    if (!input.idempotencyKey.trim()) throw new Error('Task idempotencyKey is required');
    if (input.maxAttempts < 1 || input.maxAttempts > 20) throw new Error('maxAttempts must be between 1 and 20');
    this.assertBudget(input.budget);
    const result = await this.store.enqueue(input, this.clock.now());
    if (result.inserted) {
      await this.audit('task.enqueued', actor, { idempotencyKey: input.idempotencyKey }, result.task.id, result.task.departmentId);
    }
    return result.task;
  }

  listTasks(query: { departmentId?: DepartmentId; status?: DepartmentTask['status']; limit?: number } = {}): Promise<DepartmentTask[]> {
    return this.store.listTasks({ organizationId: this.organizationId, ...query });
  }

  listApprovals(query: { status?: 'pending' | 'approved' | 'rejected' | 'expired'; limit?: number } = {}) {
    return this.store.listApprovals({ organizationId: this.organizationId, ...query });
  }

  listAudit(query: { taskId?: string; limit?: number } = {}) {
    return this.store.listAudit({ organizationId: this.organizationId, ...query });
  }

  getTaskResult(taskId: string): Promise<TaskResult | undefined> {
    return this.store.getTaskResult(taskId);
  }

  /** Processes at most one task. Useful for serverless jobs and deterministic tests. */
  async tick(departmentId?: DepartmentId): Promise<DepartmentTask | undefined> {
    if (this.tickRunning) return undefined;
    this.tickRunning = true;
    try {
      await this.expireApprovals();
      const stop = await this.stopState();
      if (stop.global || (departmentId && stop.departments.has(departmentId))) return undefined;
      const now = this.clock.now();
      const task = await this.store.claimNext({
        organizationId: this.organizationId,
        departmentId,
        workerId: this.workerId,
        leaseUntil: new Date(now.getTime() + this.leaseMs),
        now,
      });
      if (!task) return undefined;
      await this.audit('task.leased', this.workerId, { attempt: task.attempt + 1 }, task.id, task.departmentId);
      const latestStop = await this.stopState();
      if (latestStop.global || latestStop.departments.has(task.departmentId)) {
        return this.store.updateTask(task.id, { status: 'queued', lease: undefined }, this.clock.now());
      }
      const authorizationError = this.authorizationError(task);
      if (authorizationError) return this.failOrRetry(task, authorizationError);
      if (requiresHumanApproval(task)) {
        const allowed = await this.ensureApproval(task);
        if (!allowed) return this.store.getTask(task.id);
      }
      return await this.execute(task);
    } finally {
      this.tickRunning = false;
    }
  }

  async decideApproval(decision: ApprovalDecision): Promise<void> {
    const approval = await this.store.getApproval(decision.approvalId);
    if (!approval || approval.organizationId !== this.organizationId) throw new Error('Approval not found');
    if (approval.status !== 'pending') throw new Error(`Approval is already ${approval.status}`);
    const now = decision.decidedAt ?? this.clock.now();
    const task = await this.store.getTask(approval.taskId);
    if (!task) throw new Error('Approval task not found');
    if (approval.expiresAt <= now) {
      approval.status = 'expired';
      approval.decidedAt = now;
      await this.store.updateApproval(approval);
      await this.store.updateTask(task.id, { status: 'cancelled', lease: undefined, lastError: 'Approval expired' }, now);
      await this.audit('approval.expired', decision.decidedBy, {}, task.id, task.departmentId);
      return;
    }
    approval.status = decision.decision;
    approval.decidedAt = now;
    approval.decidedBy = decision.decidedBy;
    approval.reason = decision.reason;
    await this.store.updateApproval(approval);
    await this.store.updateTask(task.id, {
      status: decision.decision === 'approved' ? 'queued' : 'cancelled',
      lease: undefined,
      lastError: decision.decision === 'rejected' ? (decision.reason ?? 'Approval rejected') : undefined,
    }, now);
    await this.audit('approval.decided', decision.decidedBy, { decision: decision.decision, reason: decision.reason }, task.id, task.departmentId);
  }

  async expireApprovals(): Promise<number> {
    const now = this.clock.now();
    const pending = await this.store.listApprovals({ organizationId: this.organizationId, status: 'pending', limit: 1_000 });
    let expired = 0;
    for (const approval of pending) {
      if (approval.expiresAt > now) continue;
      approval.status = 'expired';
      approval.decidedAt = now;
      await this.store.updateApproval(approval);
      const task = await this.store.getTask(approval.taskId);
      if (task?.status === 'awaiting_approval') {
        await this.store.updateTask(task.id, { status: 'cancelled', lastError: 'Approval expired' }, now);
        await this.audit('approval.expired', 'system', { approvalId: approval.id }, task.id, task.departmentId);
      }
      expired++;
    }
    return expired;
  }

  private async ensureApproval(task: DepartmentTask): Promise<boolean> {
    const now = this.clock.now();
    if (task.approvalId) {
      const approval = await this.store.getApproval(task.approvalId);
      if (approval && approvalAllowsTask(approval, task, now)) return true;
      if (approval?.status === 'pending' && approval.expiresAt > now) {
        await this.store.updateTask(task.id, { status: 'awaiting_approval', lease: undefined }, now);
        return false;
      }
      const reason = approval?.status === 'rejected' ? 'Approval rejected' : 'Approval invalid or expired';
      await this.store.updateTask(task.id, { status: 'cancelled', lease: undefined, lastError: reason }, now);
      return false;
    }
    const approval = await this.store.createApproval(makeApprovalRequest(task, this.clock, this.approvalTtlMs));
    await this.store.updateTask(task.id, { status: 'awaiting_approval', approvalId: approval.id, lease: undefined }, now);
    await this.audit('approval.requested', this.workerId, { approvalId: approval.id, action: task.action, expiresAt: approval.expiresAt.toISOString() }, task.id, task.departmentId);
    await this.audit('task.awaiting_approval', this.workerId, { approvalId: approval.id }, task.id, task.departmentId);
    if (this.telegram) {
      try {
        await this.telegram.sendHumanInputRequest({
          organizationId: this.organizationId,
          approvalId: approval.id,
          taskId: task.id,
          departmentId: task.departmentId,
          summary: approval.summary,
          expiresAt: approval.expiresAt,
        });
        await this.audit('escalation.sent', this.workerId, { channel: 'telegram', approvalId: approval.id }, task.id, task.departmentId);
      } catch (error) {
        await this.audit('escalation.failed', this.workerId, { channel: 'telegram', error: this.errorMessage(error) }, task.id, task.departmentId);
      }
    }
    return false;
  }

  private async execute(task: DepartmentTask): Promise<DepartmentTask> {
    const adapter = this.adapters.get(task.departmentId)!;
    const now = this.clock.now();
    const reservation = await this.store.reserveBudget({
      organizationId: this.organizationId,
      departmentId: task.departmentId,
      taskId: task.id,
      requested: task.budget,
      organizationLimit: this.budgets.organizationDaily,
      departmentLimit: this.budgets.departmentDaily,
      periodStart: this.startOfUtcDay(now),
      now,
    });
    if (!reservation.accepted) {
      await this.audit('budget.rejected', this.workerId, { reason: reservation.reason }, task.id, task.departmentId);
      const tomorrow = this.startOfUtcDay(new Date(now.getTime() + 24 * 60 * 60_000));
      return this.store.updateTask(task.id, { status: 'retry_scheduled', notBefore: tomorrow, lease: undefined, lastError: reservation.reason }, now);
    }
    const controller = new AbortController();
    this.activeExecutions.set(task.id, controller);
    const timeout = setTimeout(() => controller.abort('execution timeout'), this.executionTimeoutMs);
    await this.store.updateTask(task.id, { status: 'running', attempt: task.attempt + 1 }, now);
    await this.audit('task.started', this.workerId, { attempt: task.attempt + 1 }, task.id, task.departmentId);
    try {
      const result = await adapter.execute({ task, signal: controller.signal, hardBudget: task.budget });
      if (result.costUsd < 0 || result.tokens < 0 || result.costUsd > task.budget.maxCostUsd || result.tokens > task.budget.maxTokens) {
        throw new TaskExecutionError('Adapter reported invalid usage or exceeded its hard task budget', false);
      }
      const completedAt = this.clock.now();
      const usage = {
        id: randomUUID(), organizationId: this.organizationId, departmentId: task.departmentId,
        taskId: task.id, costUsd: result.costUsd, tokens: result.tokens, recordedAt: completedAt,
      };
      const taskResult = {
        taskId: task.id,
        organizationId: this.organizationId,
        output: result.output,
        externalReferenceIds: result.externalReferenceIds ?? [],
        completedAt,
      };
      const completed = await this.store.completeTask({
        taskId: task.id,
        usage,
        result: taskResult,
        now: completedAt,
        audit: this.auditEvent('task.succeeded', this.workerId, {
          costUsd: result.costUsd,
          tokens: result.tokens,
          externalReferenceIds: result.externalReferenceIds ?? [],
          outputKeys: Object.keys(result.output),
        }, task.id, task.departmentId),
      });
      return completed;
    } catch (error) {
      return this.failOrRetry(task, error);
    } finally {
      clearTimeout(timeout);
      this.activeExecutions.delete(task.id);
      await this.store.releaseBudget(task.id);
    }
  }

  private async failOrRetry(task: DepartmentTask, error: unknown): Promise<DepartmentTask> {
    const now = this.clock.now();
    const attempt = task.attempt + 1;
    const retryable = !(error instanceof TaskExecutionError) || error.retryable;
    const message = this.errorMessage(error);
    if (retryable && attempt < task.maxAttempts) {
      const delay = Math.min(60 * 60_000, this.retryBaseDelayMs * 2 ** Math.max(0, attempt - 1));
      const updated = await this.store.updateTask(task.id, {
        status: 'retry_scheduled', attempt, notBefore: new Date(now.getTime() + delay), lease: undefined, lastError: message,
      }, now);
      await this.audit('task.retry_scheduled', this.workerId, { attempt, delayMs: delay, error: message }, task.id, task.departmentId);
      return updated;
    }
    const status = attempt >= task.maxAttempts ? 'dead_letter' : 'failed';
    const updated = await this.store.updateTask(task.id, { status, attempt, lease: undefined, lastError: message }, now);
    await this.audit('task.failed', this.workerId, { attempt, status, error: message }, task.id, task.departmentId);
    return updated;
  }

  private schedulePoll(delay: number): void {
    if (!this.started) return;
    this.pollTimer = setTimeout(async () => {
      try {
        await this.tick();
      } catch (error) {
        try { await this.audit('loop.failed', this.workerId, { scope: 'worker_poll', error: this.errorMessage(error) }); } catch { /* store unavailable */ }
      } finally {
        this.schedulePoll(this.pollIntervalMs);
      }
    }, delay);
  }

  private async stopState(): Promise<StopState> {
    return (await this.store.getStopState(this.organizationId)) ?? {
      global: false, departments: new Set(), changedAt: this.clock.now(), changedBy: 'system',
    };
  }

  private async setGlobalStop(global: boolean, reason: string, changedBy: string): Promise<void> {
    const current = await this.stopState();
    await this.store.setStopState(this.organizationId, { ...current, global, reason, changedAt: this.clock.now(), changedBy });
  }

  private assertBudget(budget: DepartmentTask['budget']): void {
    if (!Number.isFinite(budget.maxCostUsd) || !Number.isFinite(budget.maxTokens) || budget.maxCostUsd < 0 || budget.maxTokens < 0) {
      throw new Error('Task budget must contain finite non-negative limits');
    }
    if (budget.maxCostUsd > this.budgets.defaultTask.maxCostUsd || budget.maxTokens > this.budgets.defaultTask.maxTokens) {
      throw new Error('Task budget exceeds the configured per-task ceiling');
    }
  }

  private authorizationError(task: DepartmentTask): TaskExecutionError | undefined {
    const adapter = this.adapters.get(task.departmentId);
    if (!adapter) return new TaskExecutionError(`No adapter configured for ${task.departmentId}`);
    if (!adapter.capabilities.includes(task.capability) || !adapter.allowedActions.includes(task.action)) {
      return new TaskExecutionError(
        `Department ${task.departmentId} is not granted capability ${task.capability} with action ${task.action}`,
        false,
      );
    }
    return undefined;
  }

  private async audit(
    type: AuditEvent['type'], actor: string, details: Record<string, unknown>, taskId?: string, departmentId?: DepartmentId,
  ): Promise<void> {
    await this.store.appendAudit(this.auditEvent(type, actor, details, taskId, departmentId));
  }

  private auditEvent(
    type: AuditEvent['type'], actor: string, details: Record<string, unknown>, taskId?: string, departmentId?: DepartmentId,
  ): AuditEvent {
    return { id: randomUUID(), organizationId: this.organizationId, occurredAt: this.clock.now(), type, actor, taskId, departmentId, details };
  }

  private startOfUtcDay(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
