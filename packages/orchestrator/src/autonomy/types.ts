export const DEPARTMENTS = [
  'ceo',
  'sales',
  'customer_care',
  'marketing',
  'influencer_partnerships',
  'product',
  'backend_engineering',
  'legal',
  'finance',
  'data_analytics',
  'seo_geo_aeo',
  'cyber_security',
] as const;

export type DepartmentId = (typeof DEPARTMENTS)[number] | (string & {});

export type AgentProvider =
  | 'codex'
  | 'chatgpt'
  | 'hermes'
  | 'claude'
  | 'ollama'
  | 'openrouter'
  | 'groq'
  | 'nvidia_nim'
  | (string & {});

export const HIGH_RISK_ACTIONS = [
  'external_outreach',
  'phone_call',
  'public_post',
  'personal_data_acquisition',
  'legal_representation',
  'legal_filing',
  'payment',
  'refund',
  'financial_commitment',
  'account_creation',
  'credential_permission_change',
] as const;

export type ActionKind =
  | 'research'
  | 'analysis'
  | 'draft'
  | 'internal_operation'
  | (typeof HIGH_RISK_ACTIONS)[number];

export type TaskStatus =
  | 'queued'
  | 'leased'
  | 'awaiting_approval'
  | 'running'
  | 'succeeded'
  | 'retry_scheduled'
  | 'failed'
  | 'cancelled'
  | 'dead_letter';

export interface MoneyAndTokenBudget {
  maxCostUsd: number;
  maxTokens: number;
}

export interface DepartmentTask {
  id: string;
  organizationId: string;
  departmentId: DepartmentId;
  title: string;
  objective: string;
  /** A namespaced power such as sales.lead_research or finance.reconcile. */
  capability: string;
  action: ActionKind;
  input: Readonly<Record<string, unknown>>;
  priority: number;
  status: TaskStatus;
  idempotencyKey: string;
  attempt: number;
  maxAttempts: number;
  notBefore: Date;
  createdAt: Date;
  updatedAt: Date;
  lease?: { ownerId: string; expiresAt: Date };
  approvalId?: string;
  budget: MoneyAndTokenBudget;
  parentTaskId?: string;
  tags: readonly string[];
  lastError?: string;
}

export type NewDepartmentTask = Omit<
  DepartmentTask,
  'id' | 'status' | 'attempt' | 'createdAt' | 'updatedAt' | 'lease' | 'approvalId' | 'lastError'
> & { id?: string };

export interface ApprovalRequest {
  id: string;
  taskId: string;
  organizationId: string;
  action: ActionKind;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  summary: string;
  payloadDigest: string;
  requestedAt: Date;
  expiresAt: Date;
  decidedAt?: Date;
  decidedBy?: string;
  reason?: string;
}

export interface ApprovalDecision {
  approvalId: string;
  decision: 'approved' | 'rejected';
  decidedBy: string;
  reason?: string;
  decidedAt?: Date;
}

export interface UsageRecord {
  id: string;
  organizationId: string;
  departmentId: DepartmentId;
  taskId: string;
  costUsd: number;
  tokens: number;
  recordedAt: Date;
}

export interface TaskResult {
  taskId: string;
  organizationId: string;
  output: Readonly<Record<string, unknown>>;
  externalReferenceIds: readonly string[];
  completedAt: Date;
}

export interface BudgetLimits {
  organizationDaily: MoneyAndTokenBudget;
  departmentDaily: MoneyAndTokenBudget;
  defaultTask: MoneyAndTokenBudget;
}

export interface AuditEvent {
  id: string;
  organizationId: string;
  occurredAt: Date;
  type:
    | 'task.enqueued'
    | 'task.leased'
    | 'task.awaiting_approval'
    | 'task.started'
    | 'task.succeeded'
    | 'task.retry_scheduled'
    | 'task.failed'
    | 'task.cancelled'
    | 'approval.requested'
    | 'approval.decided'
    | 'approval.expired'
    | 'budget.rejected'
    | 'runtime.started'
    | 'runtime.stopped'
    | 'department.paused'
    | 'department.resumed'
    | 'loop.completed'
    | 'loop.failed'
    | 'escalation.sent'
    | 'escalation.failed';
  actor: string;
  taskId?: string;
  departmentId?: DepartmentId;
  details: Readonly<Record<string, unknown>>;
}

export interface StopState {
  global: boolean;
  departments: ReadonlySet<DepartmentId>;
  reason?: string;
  changedAt: Date;
  changedBy: string;
}

export interface AgentExecutionContext {
  task: DepartmentTask;
  signal: AbortSignal;
  hardBudget: MoneyAndTokenBudget;
}

export interface AgentExecutionResult {
  output: Readonly<Record<string, unknown>>;
  costUsd: number;
  tokens: number;
  externalReferenceIds?: readonly string[];
}

/** An adapter may invoke Codex, ChatGPT, Claude, Hermes, Ollama, OpenRouter,
 * Groq, NVIDIA NIM, or another provider. The runtime never stores credentials. */
export interface DepartmentAgentAdapter {
  readonly departmentId: DepartmentId;
  readonly provider: AgentProvider;
  /** Least-privilege grant. A task outside this list is rejected before invoke. */
  readonly capabilities: readonly string[];
  readonly allowedActions: readonly ActionKind[];
  execute(context: AgentExecutionContext): Promise<AgentExecutionResult>;
}

export interface TelegramEscalationAdapter {
  sendHumanInputRequest(message: {
    organizationId: string;
    approvalId: string;
    taskId: string;
    departmentId: DepartmentId;
    summary: string;
    expiresAt: Date;
  }): Promise<void>;
}

export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };
