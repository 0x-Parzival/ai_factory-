// ═══════════════════════════════════════════════════════════════
// SHARED TYPES - Used across all packages
// ═══════════════════════════════════════════════════════════════

import type {
  User,
  Organization,
  Department,
  Employee,
  Persona,
  Skill,
  Project,
  Task,
  Workflow,
  WorkflowRun,
  Approval,
  Conversation,
  Message,
  Goal,
  Budget,
  Transaction,
  Activity,
  Notification,
  Integration,
  Webhook,
  WhatsAppSession,
  WhatsAppGroup,
  PixelAgentState,
  PixelOfficeLayout,
  VoiceCommand,
  Prisma,
  UserRole,
  OrgSize,
  OrgRole,
  EmployeeStatus,
  EmploymentType,
  PersonaCategory,
  SkillCategory,
  SkillRuntime,
  ProjectStatus,
  Priority,
  TaskStatus,
  TaskType,
  WorkflowStatus,
  WorkflowTrigger,
  WorkflowRunStatus,
  ApprovalType,
  ApprovalStatus,
  ConversationType,
  ParticipantRole,
  MessageType,
  GoalType,
  GoalStatus,
  BudgetPeriod,
  TransactionType,
  TransactionStatus,
  ReviewStatus,
  ActorType,
  RecipientType,
  NotificationType,
  NotificationPriority,
  NotificationChannel,
  IntegrationType,
  SyncStatus,
  DeliveryStatus,
  WhatsAppStatus,
} from "@prisma/client";

// ═══════════════════════════════════════════════════════════════
// API RESPONSE TYPES
// ═══════════════════════════════════════════════════════════════

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  field?: string;
}

export interface ResponseMeta {
  timestamp: string;
  requestId: string;
  version: string;
  pagination?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: ResponseMeta & { pagination: PaginationMeta };
}

// ═══════════════════════════════════════════════════════════════
// QUERY & FILTER TYPES
// ═══════════════════════════════════════════════════════════════

export interface ListQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  search?: string;
  filters?: Record<string, unknown>;
}

export interface EmployeeFilters extends ListQuery {
  departmentId?: string;
  status?: EmployeeStatus;
  skills?: string[];
  performanceMin?: number;
}

export interface TaskFilters extends ListQuery {
  projectId?: string;
  assigneeId?: string;
  status?: TaskStatus[];
  priority?: Priority[];
  dueBefore?: Date;
  dueAfter?: Date;
}

export interface WorkflowFilters extends ListQuery {
  projectId?: string;
  status?: WorkflowStatus;
  trigger?: WorkflowTrigger;
}

// ═══════════════════════════════════════════════════════════════
// ORCHESTRATOR TYPES
// ═══════════════════════════════════════════════════════════════

export interface TaskAssignment {
  taskId: string;
  employeeId: string;
  confidence: number;
  reasoning: string;
  alternativeEmployees?: AlternativeEmployee[];
}

export interface AlternativeEmployee {
  employeeId: string;
  name: string;
  confidence: number;
  reason: string;
}

export interface OrchestratorDecision {
  type: "ASSIGN_TASK" | "CREATE_WORKFLOW" | "REQUEST_APPROVAL" | "ESCALATE" | "NOTIFY";
  payload: Record<string, unknown>;
  reasoning: string;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
}

export interface EmployeeCapability {
  employeeId: string;
  skills: SkillMatch[];
  workload: number; // 0-100
  availability: AvailabilityWindow[];
  performanceScore: number;
  relevantExperience: string[];
}

export interface SkillMatch {
  skillId: string;
  skillName: string;
  proficiency: number; // 0-100
  relevance: number; // 0-100
}

export interface AvailabilityWindow {
  dayOfWeek: number; // 0-6
  startHour: number; // 0-23
  endHour: number; // 0-23
  timezone: string;
}

// ═══════════════════════════════════════════════════════════════
// ACPX / AGENT COMMUNICATION
// ═══════════════════════════════════════════════════════════════

export interface AcpMessage {
  id: string;
  from: string; // employeeId or "orchestrator"
  to: string; // employeeId or "orchestrator" or "broadcast"
  type: AcpMessageType;
  payload: Record<string, unknown>;
  correlationId?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export type AcpMessageType =
  | "TASK_ASSIGNMENT"
  | "TASK_UPDATE"
  | "TASK_COMPLETION"
  | "QUESTION"
  | "ANSWER"
  | "STATUS_UPDATE"
  | "HEARTBEAT"
  | "SKILL_INVOKE"
  | "SKILL_RESULT"
  | "APPROVAL_REQUEST"
  | "APPROVAL_RESPONSE"
  | "WORKFLOW_EVENT"
  | "ERROR"
  | "LOG"
  | "METRICS";

export interface AgentSession {
  employeeId: string;
  status: "CONNECTING" | "CONNECTED" | "DISCONNECTED" | "ERROR";
  lastHeartbeat: Date;
  capabilities: string[];
  currentTask?: string;
  metadata: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════
// WHATSAPP BRIDGE TYPES
// ═══════════════════════════════════════════════════════════════

export interface WhatsAppGroupConfig {
  name: string;
  description?: string;
  participants: WhatsAppParticipant[];
  isAnnouncement: boolean;
}

export interface WhatsAppParticipant {
  phoneNumber: string;
  name?: string;
  isEmployee: boolean;
  employeeId?: string;
  role: "admin" | "member";
}

export interface WhatsAppIncomingMessage {
  messageId: string;
  groupJid: string;
  senderJid: string;
  senderName: string;
  content: string;
  type: string;
  timestamp: Date;
  isFromMe: boolean;
  quotedMessageId?: string;
}

export interface WhatsAppOutgoingMessage {
  groupJid: string;
  content: string;
  type?: "text" | "image" | "document" | "audio" | "video";
  mediaUrl?: string;
  caption?: string;
  quotedMessageId?: string;
}

// ═══════════════════════════════════════════════════════════════
// PIXEL AGENTS TYPES
// ═══════════════════════════════════════════════════════════════

export interface PixelAgentUpdate {
  employeeId: string;
  position?: { x: number; y: number; floor: number };
  state?: PixelAgentStateType;
  currentTask?: string;
  animation?: string;
  direction?: number;
  deskId?: string;
}

export type PixelAgentStateType =
  | "IDLE"
  | "WALKING"
  | "WORKING"
  | "TYPING"
  | "THINKING"
  | "MEETING"
  | "BREAK"
  | "OFFLINE"
  | "ERROR"
  | "CELEBRATING";

export interface PixelOfficeLayoutData {
  width: number;
  height: number;
  floors: number;
  tiles: TileData[];
  walls: WallData[];
  furniture: FurnitureData[];
  spawnPoints: SpawnPointData[];
}

export interface TileData {
  x: number;
  y: number;
  floor: number;
  type: string;
  variant?: number;
}

export interface WallData {
  x: number;
  y: number;
  floor: number;
  direction: "north" | "east" | "south" | "west";
}

export interface FurnitureData {
  id: string;
  type: string;
  x: number;
  y: number;
  floor: number;
  rotation: number;
  assignedEmployeeId?: string;
}

export interface SpawnPointData {
  x: number;
  y: number;
  floor: number;
  departmentId?: string;
}

// ═══════════════════════════════════════════════════════════════
// WORKFLOW / LOBSTER TYPES
// ═══════════════════════════════════════════════════════════════

export interface LobsterPipeline {
  version: string;
  name: string;
  description?: string;
  steps: LobsterStep[];
  triggers: LobsterTrigger[];
  variables: Record<string, LobsterVariable>;
}

export interface LobsterStep {
  id: string;
  name: string;
  type: "TASK" | "APPROVAL" | "SCRIPT" | "WEBHOOK" | "CONDITION" | "PARALLEL" | "LOOP";
  assignee?: string; // employeeId or role
  dependsOn: string[];
  config: Record<string, unknown>;
  timeout?: number; // seconds
  retries?: number;
  onFailure?: "STOP" | "CONTINUE" | "RETRY" | "COMPENSATE";
}

export interface LobsterTrigger {
  type: "MANUAL" | "SCHEDULE" | "WEBHOOK" | "EVENT" | "TASK_CREATED" | "TASK_COMPLETED";
  config: Record<string, unknown>;
}

export interface LobsterVariable {
  type: "string" | "number" | "boolean" | "object" | "array";
  default?: unknown;
  description?: string;
  required?: boolean;
}

export interface WorkflowExecutionContext {
  runId: string;
  workflowId: string;
  variables: Record<string, unknown>;
  stepResults: Record<string, unknown>;
  currentStep: number;
  startedAt: Date;
  metadata: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════
// SKILL TYPES
// ═══════════════════════════════════════════════════════════════

export interface SkillManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  runtime: SkillRuntime;
  entryPoint: string;
  inputs: SkillParameter[];
  outputs: SkillParameter[];
  config: SkillConfigParameter[];
  dependencies: SkillDependency[];
  permissions: SkillPermission[];
  examples: SkillExample[];
}

export interface SkillParameter {
  name: string;
  type: "string" | "number" | "boolean" | "object" | "array" | "file";
  description: string;
  required: boolean;
  default?: unknown;
  validation?: Record<string, unknown>;
}

export interface SkillConfigParameter {
  name: string;
  type: "string" | "number" | "boolean" | "secret" | "select" | "multiselect";
  description: string;
  required: boolean;
  default?: unknown;
  options?: { label: string; value: unknown }[];
}

export interface SkillDependency {
  name: string;
  version: string;
  registry: "npm" | "pypi" | "crates" | "go" | "docker";
  optional?: boolean;
}

export interface SkillPermission {
  type: "fs_read" | "fs_write" | "net_http" | "net_tcp" | "env_read" | "process_spawn" | "custom";
  scope: string;
  description: string;
}

export interface SkillExample {
  name: string;
  description: string;
  input: Record<string, unknown>;
  expectedOutput: Record<string, unknown>;
}

export interface SkillInvocation {
  skillId: string;
  employeeId: string;
  input: Record<string, unknown>;
  config: Record<string, unknown>;
  timeout?: number;
  async?: boolean;
}

export interface SkillResult {
  success: boolean;
  output?: Record<string, unknown>;
  error?: string;
  logs: string[];
  metrics: SkillMetrics;
  duration: number; // ms
}

export interface SkillMetrics {
  tokensUsed?: number;
  cost?: number;
  apiCalls?: number;
  custom?: Record<string, number>;
}

// ═══════════════════════════════════════════════════════════════
// BUDGET / COST TRACKING (OpenFang)
// ═══════════════════════════════════════════════════════════════

export interface CostBreakdown {
  employeeId: string;
  employeeName: string;
  model: string;
  provider: string;
  tokensInput: number;
  tokensOutput: number;
  totalTokens: number;
  cost: number;
  currency: string;
  period: { start: Date; end: Date };
  breakdown: ModelCost[];
}

export interface ModelCost {
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  requests: number;
}

export interface BudgetAlert {
  type: "THRESHOLD_WARNING" | "THRESHOLD_EXCEEDED" | "ANOMALY_DETECTED" | "PROJECTION_OVERRUN";
  severity: "INFO" | "WARNING" | "CRITICAL";
  message: string;
  currentSpend: number;
  threshold: number;
  projectedSpend?: number;
  period: { start: Date; end: Date };
  recommendations: string[];
}

// ═══════════════════════════════════════════════════════════════
// JARVIS / VOICE CONTROL
// ═══════════════════════════════════════════════════════════════

export interface VoiceIntent {
  name: string;
  confidence: number;
  entities: VoiceEntity[];
  slots: Record<string, unknown>;
}

export interface VoiceEntity {
  name: string;
  value: string;
  type: string;
  confidence: number;
  start: number;
  end: number;
}

export interface VoiceAction {
  type: "ASSIGN_TASK" | "CREATE_PROJECT" | "RUN_WORKFLOW" | "GET_STATUS" | "APPROVE" | "REJECT" | "QUERY" | "NOTIFY" | "CUSTOM";
  parameters: Record<string, unknown>;
  requiresConfirmation: boolean;
  confirmationMessage?: string;
}

export interface JarvisResponse {
  speech: string;
  display?: Record<string, unknown>;
  actions: VoiceAction[];
  followUp?: boolean;
}

// ═══════════════════════════════════════════════════════════════
// REAL-TIME EVENTS
// ═══════════════════════════════════════════════════════════════

export interface RealtimeEvent<T = unknown> {
  type: string;
  payload: T;
  timestamp: string;
  orgId: string;
  userId?: string;
  employeeId?: string;
}

export type RealtimeEventType =
  | "employee:status_changed"
  | "employee:created"
  | "employee:updated"
  | "task:created"
  | "task:updated"
  | "task:assigned"
  | "task:completed"
  | "workflow:started"
  | "workflow:step_completed"
  | "workflow:completed"
  | "workflow:failed"
  | "approval:requested"
  | "approval:decided"
  | "message:new"
  | "message:read"
  | "budget:alert"
  | "budget:transaction"
  | "pixel_agent:state_changed"
  | "pixel_agent:position_changed"
  | "whatsapp:message_received"
  | "voice:command_received"
  | "skill:invoked"
  | "skill:completed"
  | "integration:sync_completed"
  | "notification:new";

// ═══════════════════════════════════════════════════════════════
// UTILITY TYPES
// ═══════════════════════════════════════════════════════════════

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type EntityWithRelations<T, R extends string[]> = T & {
  [K in R[number]]: unknown;
};

export interface DateRange {
  start: Date;
  end: Date;
}

export interface TimeSeriesPoint {
  timestamp: Date;
  value: number;
  metadata?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════
// RE-EXPORT PRISMA ENUMS
// ═══════════════════════════════════════════════════════════════

export type {
  UserRole,
  OrgSize,
  OrgRole,
  EmployeeStatus,
  EmploymentType,
  PersonaCategory,
  SkillCategory,
  SkillRuntime,
  ProjectStatus,
  Priority,
  TaskStatus,
  TaskType,
  WorkflowStatus,
  WorkflowTrigger,
  WorkflowRunStatus,
  ApprovalType,
  ApprovalStatus,
  ConversationType,
  ParticipantRole,
  MessageType,
  GoalType,
  GoalStatus,
  BudgetPeriod,
  TransactionType,
  TransactionStatus,
  ReviewStatus,
  ActorType,
  RecipientType,
  NotificationType,
  NotificationPriority,
  NotificationChannel,
  IntegrationType,
  SyncStatus,
  DeliveryStatus,
  WhatsAppStatus,
};
