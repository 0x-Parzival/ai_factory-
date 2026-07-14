import { randomUUID } from 'node:crypto';
import type {
  ApprovalRequest,
  AuditEvent,
  DepartmentId,
  DepartmentTask,
  MoneyAndTokenBudget,
  NewDepartmentTask,
  StopState,
  TaskResult,
  TaskStatus,
  UsageRecord,
} from './types';

export interface TaskPatch {
  status?: TaskStatus;
  attempt?: number;
  notBefore?: Date;
  lease?: DepartmentTask['lease'];
  approvalId?: string;
  lastError?: string;
}

/** Implement this interface with Postgres/Redis for multi-process durability.
 * claimNext and reserveBudget must be atomic in production. */
export interface OrchestratorStore {
  enqueue(task: NewDepartmentTask, now: Date): Promise<{ task: DepartmentTask; inserted: boolean }>;
  getTask(taskId: string): Promise<DepartmentTask | undefined>;
  listTasks(query: { organizationId: string; departmentId?: DepartmentId; status?: TaskStatus; limit?: number }): Promise<DepartmentTask[]>;
  claimNext(options: {
    organizationId: string;
    departmentId?: DepartmentId;
    workerId: string;
    leaseUntil: Date;
    now: Date;
  }): Promise<DepartmentTask | undefined>;
  updateTask(taskId: string, patch: TaskPatch, now: Date): Promise<DepartmentTask>;
  createApproval(approval: ApprovalRequest): Promise<ApprovalRequest>;
  getApproval(approvalId: string): Promise<ApprovalRequest | undefined>;
  listApprovals(query: { organizationId: string; status?: ApprovalRequest['status']; limit?: number }): Promise<ApprovalRequest[]>;
  updateApproval(approval: ApprovalRequest): Promise<void>;
  reserveBudget(options: {
    organizationId: string;
    departmentId: DepartmentId;
    taskId: string;
    requested: MoneyAndTokenBudget;
    organizationLimit: MoneyAndTokenBudget;
    departmentLimit: MoneyAndTokenBudget;
    periodStart: Date;
    now: Date;
  }): Promise<{ accepted: boolean; reason?: string }>;
  recordUsage(usage: UsageRecord): Promise<void>;
  /** Atomically persist usage, result, and succeeded status. */
  completeTask(options: { taskId: string; usage: UsageRecord; result: TaskResult; audit: AuditEvent; now: Date }): Promise<DepartmentTask>;
  saveTaskResult(result: TaskResult): Promise<void>;
  getTaskResult(taskId: string): Promise<TaskResult | undefined>;
  releaseBudget(taskId: string): Promise<void>;
  appendAudit(event: AuditEvent): Promise<void>;
  listAudit(query: { organizationId: string; taskId?: string; limit?: number }): Promise<AuditEvent[]>;
  getStopState(organizationId: string): Promise<StopState | undefined>;
  setStopState(organizationId: string, state: StopState): Promise<void>;
}

interface Reservation {
  organizationId: string;
  departmentId: DepartmentId;
  budget: MoneyAndTokenBudget;
  at: Date;
}

/** Single-process reference store for local development and tests. It contains no
 * seeded/demo records. Use a durable OrchestratorStore in production. */
export class InMemoryOrchestratorStore implements OrchestratorStore {
  readonly tasks = new Map<string, DepartmentTask>();
  readonly approvals = new Map<string, ApprovalRequest>();
  readonly usage: UsageRecord[] = [];
  readonly audit: AuditEvent[] = [];
  readonly results = new Map<string, TaskResult>();
  private readonly idempotency = new Map<string, string>();
  private readonly reservations = new Map<string, Reservation>();
  private readonly stops = new Map<string, StopState>();

  async enqueue(input: NewDepartmentTask, now: Date): Promise<{ task: DepartmentTask; inserted: boolean }> {
    const dedupeKey = `${input.organizationId}:${input.idempotencyKey}`;
    const existingId = this.idempotency.get(dedupeKey);
    if (existingId) return { task: this.cloneTask(this.tasks.get(existingId)!), inserted: false };
    const task: DepartmentTask = {
      ...input,
      id: input.id ?? randomUUID(),
      status: 'queued',
      attempt: 0,
      createdAt: now,
      updatedAt: now,
      input: structuredClone(input.input),
      tags: [...input.tags],
    };
    this.tasks.set(task.id, task);
    this.idempotency.set(dedupeKey, task.id);
    return { task: this.cloneTask(task), inserted: true };
  }

  async getTask(taskId: string): Promise<DepartmentTask | undefined> {
    const task = this.tasks.get(taskId);
    return task && this.cloneTask(task);
  }

  async listTasks(query: { organizationId: string; departmentId?: DepartmentId; status?: TaskStatus; limit?: number }): Promise<DepartmentTask[]> {
    return [...this.tasks.values()]
      .filter(item => item.organizationId === query.organizationId)
      .filter(item => !query.departmentId || item.departmentId === query.departmentId)
      .filter(item => !query.status || item.status === query.status)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, query.limit ?? 100)
      .map(item => this.cloneTask(item));
  }

  async claimNext(options: {
    organizationId: string;
    departmentId?: DepartmentId;
    workerId: string;
    leaseUntil: Date;
    now: Date;
  }): Promise<DepartmentTask | undefined> {
    const candidates = [...this.tasks.values()]
      .filter(task => task.organizationId === options.organizationId)
      .filter(task => !options.departmentId || task.departmentId === options.departmentId)
      .filter(task =>
        ((task.status === 'queued' || task.status === 'retry_scheduled') && task.notBefore <= options.now) ||
        (task.status === 'leased' && !!task.lease && task.lease.expiresAt <= options.now),
      )
      .sort((a, b) => b.priority - a.priority || a.createdAt.getTime() - b.createdAt.getTime());
    const task = candidates[0];
    if (!task) return undefined;
    task.status = 'leased';
    task.lease = { ownerId: options.workerId, expiresAt: options.leaseUntil };
    task.updatedAt = options.now;
    return this.cloneTask(task);
  }

  async updateTask(taskId: string, patch: TaskPatch, now: Date): Promise<DepartmentTask> {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Unknown task: ${taskId}`);
    Object.assign(task, patch, { updatedAt: now });
    if ('lease' in patch && patch.lease === undefined) delete task.lease;
    if ('approvalId' in patch && patch.approvalId === undefined) delete task.approvalId;
    if ('lastError' in patch && patch.lastError === undefined) delete task.lastError;
    return this.cloneTask(task);
  }

  async createApproval(approval: ApprovalRequest): Promise<ApprovalRequest> {
    const existing = [...this.approvals.values()].find(item => item.taskId === approval.taskId && item.status === 'pending');
    if (existing) return structuredClone(existing);
    this.approvals.set(approval.id, structuredClone(approval));
    return structuredClone(approval);
  }

  async getApproval(approvalId: string): Promise<ApprovalRequest | undefined> {
    const approval = this.approvals.get(approvalId);
    return approval && structuredClone(approval);
  }

  async listApprovals(query: { organizationId: string; status?: ApprovalRequest['status']; limit?: number }): Promise<ApprovalRequest[]> {
    return [...this.approvals.values()]
      .filter(item => item.organizationId === query.organizationId)
      .filter(item => !query.status || item.status === query.status)
      .sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime())
      .slice(0, query.limit ?? 100)
      .map(item => structuredClone(item));
  }

  async updateApproval(approval: ApprovalRequest): Promise<void> {
    if (!this.approvals.has(approval.id)) throw new Error(`Unknown approval: ${approval.id}`);
    this.approvals.set(approval.id, structuredClone(approval));
  }

  async reserveBudget(options: {
    organizationId: string;
    departmentId: DepartmentId;
    taskId: string;
    requested: MoneyAndTokenBudget;
    organizationLimit: MoneyAndTokenBudget;
    departmentLimit: MoneyAndTokenBudget;
    periodStart: Date;
    now: Date;
  }): Promise<{ accepted: boolean; reason?: string }> {
    if (this.reservations.has(options.taskId)) return { accepted: true };
    const records = this.usage.filter(item => item.organizationId === options.organizationId && item.recordedAt >= options.periodStart);
    const reservations = [...this.reservations.values()].filter(
      item => item.organizationId === options.organizationId && item.at >= options.periodStart,
    );
    const sum = (items: Array<{ costUsd: number; tokens: number }>) =>
      items.reduce((total, item) => ({ costUsd: total.costUsd + item.costUsd, tokens: total.tokens + item.tokens }), { costUsd: 0, tokens: 0 });
    const reservedUsage = (items: Reservation[]) => items.map(item => ({
      costUsd: item.budget.maxCostUsd,
      tokens: item.budget.maxTokens,
    }));
    const org = sum([...records, ...reservedUsage(reservations)]);
    const department = sum([
      ...records.filter(item => item.departmentId === options.departmentId),
      ...reservedUsage(reservations.filter(item => item.departmentId === options.departmentId)),
    ]);
    if (org.costUsd + options.requested.maxCostUsd > options.organizationLimit.maxCostUsd ||
        org.tokens + options.requested.maxTokens > options.organizationLimit.maxTokens) {
      return { accepted: false, reason: 'organization_daily_budget_exceeded' };
    }
    if (department.costUsd + options.requested.maxCostUsd > options.departmentLimit.maxCostUsd ||
        department.tokens + options.requested.maxTokens > options.departmentLimit.maxTokens) {
      return { accepted: false, reason: 'department_daily_budget_exceeded' };
    }
    this.reservations.set(options.taskId, {
      organizationId: options.organizationId,
      departmentId: options.departmentId,
      budget: options.requested,
      at: options.now,
    });
    return { accepted: true };
  }

  async recordUsage(usage: UsageRecord): Promise<void> { this.usage.push(structuredClone(usage)); }
  async completeTask(options: { taskId: string; usage: UsageRecord; result: TaskResult; audit: AuditEvent; now: Date }): Promise<DepartmentTask> {
    const task = this.tasks.get(options.taskId);
    if (!task) throw new Error(`Unknown task: ${options.taskId}`);
    this.usage.push(structuredClone(options.usage));
    this.results.set(options.taskId, structuredClone(options.result));
    this.audit.push(structuredClone(options.audit));
    task.status = 'succeeded';
    task.updatedAt = options.now;
    delete task.lease;
    delete task.lastError;
    return this.cloneTask(task);
  }
  async saveTaskResult(result: TaskResult): Promise<void> { this.results.set(result.taskId, structuredClone(result)); }
  async getTaskResult(taskId: string): Promise<TaskResult | undefined> {
    const result = this.results.get(taskId);
    return result && structuredClone(result);
  }
  async releaseBudget(taskId: string): Promise<void> { this.reservations.delete(taskId); }
  async appendAudit(event: AuditEvent): Promise<void> { this.audit.push(structuredClone(event)); }
  async listAudit(query: { organizationId: string; taskId?: string; limit?: number }): Promise<AuditEvent[]> {
    return this.audit
      .filter(item => item.organizationId === query.organizationId)
      .filter(item => !query.taskId || item.taskId === query.taskId)
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
      .slice(0, query.limit ?? 200)
      .map(item => structuredClone(item));
  }
  async getStopState(organizationId: string): Promise<StopState | undefined> {
    const state = this.stops.get(organizationId);
    return state && { ...state, departments: new Set(state.departments) };
  }
  async setStopState(organizationId: string, state: StopState): Promise<void> {
    this.stops.set(organizationId, { ...state, departments: new Set(state.departments) });
  }

  private cloneTask(task: DepartmentTask): DepartmentTask {
    return structuredClone(task);
  }
}
