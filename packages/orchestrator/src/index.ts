/**
 * TypeScript bridge for IronClaw Orchestrator
 * Provides a clean API for the web application to interact with the Rust orchestrator
 */

import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import { randomUUID } from 'crypto';
import {
  Task,
  Employee,
  Workflow,
  WorkflowRun,
  Approval,
  TaskAssignment,
  OrchestratorDecision,
  EmployeeCapability,
  AcpMessage,
  AgentSession,
  RealtimeEvent,
  RealtimeEventType,
  ApiResponse,
  PaginatedResponse,
  ListQuery,
  TaskFilters,
  WorkflowFilters,
  EmployeeFilters,
} from '@ai-factory/core';

export * from './autonomy';

export interface OrchestratorConfig {
  rustBinaryPath: string;
  apiPort: number;
  acpEndpoint: string;
  databaseUrl: string;
  redisUrl: string;
  rabbitmqUrl: string;
}

export interface TaskAssignmentRequest {
  taskId: string;
  preferredEmployeeId?: string;
  force?: boolean;
}

export interface WorkflowExecutionRequest {
  workflowId: string;
  taskId?: string;
  input?: Record<string, unknown>;
}

export interface SkillInvocationRequest {
  employeeId: string;
  skillId: string;
  input: Record<string, unknown>;
  config?: Record<string, unknown>;
  async?: boolean;
}

export interface EmployeeMetrics {
  employeeId: string;
  totalTasksCompleted: number;
  averageCompletionTime: number; // hours
  qualityScore: number; // 0-1
  costEfficiency: number; // tasks per dollar
  utilizationRate: number; // 0-1
  skillProficiency: Record<string, number>;
}

export class IronClawOrchestrator extends EventEmitter {
  private rustProcess: ChildProcess | null = null;
  private config: OrchestratorConfig;
  private apiBaseUrl: string;
  private connected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private eventSource: EventSource | null = null;

  constructor(config: Partial<OrchestratorConfig> = {}) {
    super();
    this.config = {
      rustBinaryPath: config.rustBinaryPath || './packages/orchestrator/rust/target/release/ironclaw-orchestrator',
      apiPort: config.apiPort || 8081,
      acpEndpoint: config.acpEndpoint || 'http://localhost:8080',
      databaseUrl: config.databaseUrl || process.env.DATABASE_URL || '',
      redisUrl: config.redisUrl || process.env.REDIS_URL || '',
      rabbitmqUrl: config.rabbitmqUrl || process.env.RABBITMQ_URL || '',
    };
    this.apiBaseUrl = `http://localhost:${this.config.apiPort}`;
  }

  // ═══════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════════════════════════

  async start(): Promise<void> {
    if (this.connected) return;

    try {
      // Start Rust binary
      this.rustProcess = spawn(this.config.rustBinaryPath, [], {
        env: {
          ...process.env,
          IRONCLAW_DATABASE_URL: this.config.databaseUrl,
          IRONCLAW_REDIS_URL: this.config.redisUrl,
          IRONCLAW_RABBITMQ_URL: this.config.rabbitmqUrl,
          IRONCLAW_ACP_ENDPOINT: this.config.acpEndpoint,
          IRONCLAW_API_PORT: this.config.apiPort.toString(),
          RUST_LOG: 'info',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      this.rustProcess.stdout?.on('data', (data) => {
        console.log(`[IronClaw] ${data.toString().trim()}`);
      });

      this.rustProcess.stderr?.on('data', (data) => {
        console.error(`[IronClaw ERROR] ${data.toString().trim()}`);
      });

      this.rustProcess.on('close', (code) => {
        console.log(`[IronClaw] Process exited with code ${code}`);
        this.connected = false;
        this.emit('disconnected', code);
        this.attemptReconnect();
      });

      this.rustProcess.on('error', (err) => {
        console.error('[IronClaw] Failed to start:', err);
        this.emit('error', err);
      });

      // Wait for API to be ready
      await this.waitForHealthy();

      // Connect to SSE for real-time events
      this.connectEventStream();

      this.connected = true;
      this.emit('connected');
      console.log('✅ IronClaw Orchestrator connected');
    } catch (error) {
      console.error('Failed to start IronClaw:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    if (this.rustProcess) {
      this.rustProcess.kill('SIGTERM');
      this.rustProcess = null;
    }

    this.connected = false;
    this.emit('disconnected', 0);
  }

  private async waitForHealthy(timeout = 30000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        const response = await fetch(`${this.apiBaseUrl}/health`);
        if (response.ok) {
          const health = await response.json() as { status?: string };
          if (health.status === 'healthy') return;
        }
      } catch {
        // Not ready yet
      }
      await new Promise(r => setTimeout(r, 1000));
    }
    throw new Error('Orchestrator health check timeout');
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      this.emit('reconnect_failed');
      return;
    }

    this.reconnectAttempts++;
    console.log(`Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts}...`);

    setTimeout(() => {
      this.start().catch(err => {
        console.error('Reconnect failed:', err);
      });
    }, 5000 * this.reconnectAttempts);
  }

  private connectEventStream(): void {
    this.eventSource = new EventSource(`${this.apiBaseUrl}/events/stream`);

    this.eventSource.onopen = () => {
      console.log('Event stream connected');
      this.reconnectAttempts = 0;
    };

    this.eventSource.onmessage = (event) => {
      try {
        const realtimeEvent: RealtimeEvent = JSON.parse(event.data);
        this.emit('event', realtimeEvent);
        this.emit(realtimeEvent.type, realtimeEvent.payload);
      } catch (err) {
        console.error('Failed to parse event:', err);
      }
    };

    this.eventSource.onerror = () => {
      console.error('Event stream error');
      this.eventSource?.close();
      setTimeout(() => this.connectEventStream(), 5000);
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // API METHODS
  // ═══════════════════════════════════════════════════════════════

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.apiBaseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' })) as { message?: string };
      throw new Error(`API error: ${error.message || response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  // Health check
  async health(): Promise<{ status: string; version: string; uptime: number }> {
    return this.request('/health');
  }

  // ═══════════════════════════════════════════════════════════════
  // TASK MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  async listTasks(filters?: TaskFilters): Promise<PaginatedResponse<Task>> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          if (Array.isArray(value)) {
            value.forEach(v => params.append(key, String(v)));
          } else {
            params.set(key, String(value));
          }
        }
      });
    }
    return this.request(`/api/tasks?${params.toString()}`);
  }

  async getTask(taskId: string): Promise<Task> {
    return this.request(`/api/tasks/${taskId}`);
  }

  async createTask(task: Partial<Task>): Promise<Task> {
    return this.request('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(task),
    });
  }

  async updateTask(taskId: string, updates: Partial<Task>): Promise<Task> {
    return this.request(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async assignTask(request: TaskAssignmentRequest): Promise<TaskAssignment> {
    return this.request('/api/tasks/assign', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async reassignTask(taskId: string, reason: string): Promise<TaskAssignment> {
    return this.request(`/api/tasks/${taskId}/reassign`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async getTaskAssigneeRecommendations(taskId: string): Promise<EmployeeCapability[]> {
    return this.request(`/api/tasks/${taskId}/recommendations`);
  }

  // ═══════════════════════════════════════════════════════════════
  // EMPLOYEE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  async listEmployees(filters?: EmployeeFilters): Promise<PaginatedResponse<Employee>> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          params.set(key, String(value));
        }
      });
    }
    return this.request(`/api/employees?${params.toString()}`);
  }

  async getEmployee(employeeId: string): Promise<Employee> {
    return this.request(`/api/employees/${employeeId}`);
  }

  async getEmployeeCapabilities(employeeId: string): Promise<EmployeeCapability> {
    return this.request(`/api/employees/${employeeId}/capabilities`);
  }

  async getEmployeeMetrics(employeeId: string): Promise<EmployeeMetrics> {
    return this.request(`/api/employees/${employeeId}/metrics`);
  }

  async deployEmployee(personaId: string, departmentId: string, config?: Partial<Employee>): Promise<Employee> {
    return this.request('/api/employees/deploy', {
      method: 'POST',
      body: JSON.stringify({ personaId, departmentId, ...config }),
    });
  }

  async updateEmployeeStatus(employeeId: string, status: Employee['status']): Promise<Employee> {
    return this.request(`/api/employees/${employeeId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // WORKFLOW EXECUTION
  // ═══════════════════════════════════════════════════════════════

  async listWorkflows(filters?: WorkflowFilters): Promise<PaginatedResponse<Workflow>> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          params.set(key, String(value));
        }
      });
    }
    return this.request(`/api/workflows?${params.toString()}`);
  }

  async getWorkflow(workflowId: string): Promise<Workflow> {
    return this.request(`/api/workflows/${workflowId}`);
  }

  async executeWorkflow(request: WorkflowExecutionRequest): Promise<WorkflowRun> {
    return this.request('/api/workflows/execute', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async getWorkflowExecution(executionId: string): Promise<WorkflowRun> {
    return this.request(`/api/workflow-runs/${executionId}`);
  }

  async listWorkflowExecutions(workflowId: string): Promise<WorkflowRun[]> {
    return this.request(`/api/workflows/${workflowId}/executions`);
  }

  async cancelWorkflowExecution(executionId: string): Promise<WorkflowRun> {
    return this.request(`/api/workflow-runs/${executionId}/cancel`, {
      method: 'POST',
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // APPROVALS
  // ═══════════════════════════════════════════════════════════════

  async listApprovals(filters?: { status?: string; orgId?: string }): Promise<PaginatedResponse<Approval>> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) params.set(key, String(value));
      });
    }
    return this.request(`/api/approvals?${params.toString()}`);
  }

  async getApproval(approvalId: string): Promise<Approval> {
    return this.request(`/api/approvals/${approvalId}`);
  }

  async decideApproval(approvalId: string, decision: 'approved' | 'rejected', reason?: string): Promise<Approval> {
    return this.request(`/api/approvals/${approvalId}/decide`, {
      method: 'POST',
      body: JSON.stringify({ decision, reason }),
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // SKILLS
  // ═══════════════════════════════════════════════════════════════

  async invokeSkill(request: SkillInvocationRequest): Promise<{ success: boolean; output?: Record<string, unknown>; error?: string; metrics: any }> {
    return this.request('/api/skills/invoke', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async listAvailableSkills(employeeId?: string): Promise<any[]> {
    const params = employeeId ? `?employeeId=${employeeId}` : '';
    return this.request(`/api/skills${params}`);
  }

  async installSkill(employeeId: string, skillId: string): Promise<void> {
    return this.request(`/api/employees/${employeeId}/skills/${skillId}`, {
      method: 'POST',
    });
  }

  async uninstallSkill(employeeId: string, skillId: string): Promise<void> {
    return this.request(`/api/employees/${employeeId}/skills/${skillId}`, {
      method: 'DELETE',
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // BUDGET & COSTS
  // ═══════════════════════════════════════════════════════════════

  async getBudget(orgId: string): Promise<any> {
    return this.request(`/api/budget/${orgId}`);
  }

  async getCostBreakdown(orgId: string, startDate: Date, endDate: Date): Promise<any> {
    const params = new URLSearchParams({
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    });
    return this.request(`/api/budget/${orgId}/breakdown?${params.toString()}`);
  }

  async getEmployeeCosts(orgId: string, startDate: Date, endDate: Date): Promise<any[]> {
    const params = new URLSearchParams({
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    });
    return this.request(`/api/budget/${orgId}/employees?${params.toString()}`);
  }

  // ═══════════════════════════════════════════════════════════════
  // ACP MESSAGING
  // ═══════════════════════════════════════════════════════════════

  async sendAcpMessage(message: Omit<AcpMessage, 'id' | 'timestamp'>): Promise<void> {
    return this.request('/api/acp/send', {
      method: 'POST',
      body: JSON.stringify(message),
    });
  }

  async getAgentSessions(): Promise<AgentSession[]> {
    return this.request('/api/acp/sessions');
  }

  // ═══════════════════════════════════════════════════════════════
  // REAL-TIME SUBSCRIPTIONS
  // ═══════════════════════════════════════════════════════════════

  onTaskAssigned(callback: (task: Task, employee: Employee) => void): () => void {
    const handler = (data: any) => callback(data.task, data.employee);
    this.on('task:assigned', handler);
    return () => this.off('task:assigned', handler);
  }

  onTaskCompleted(callback: (task: Task, employee: Employee) => void): () => void {
    const handler = (data: any) => callback(data.task, data.employee);
    this.on('task:completed', handler);
    return () => this.off('task:completed', handler);
  }

  onWorkflowStarted(callback: (execution: WorkflowRun) => void): () => void {
    const handler = (data: any) => callback(data.execution);
    this.on('workflow:started', handler);
    return () => this.off('workflow:started', handler);
  }

  onWorkflowCompleted(callback: (execution: WorkflowRun) => void): () => void {
    const handler = (data: any) => callback(data.execution);
    this.on('workflow:completed', handler);
    return () => this.off('workflow:completed', handler);
  }

  onApprovalRequested(callback: (approval: Approval) => void): () => void {
    const handler = (data: any) => callback(data.approval);
    this.on('approval:requested', handler);
    return () => this.off('approval:requested', handler);
  }

  onBudgetAlert(callback: (alert: any) => void): () => void {
    const handler = (data: any) => callback(data);
    this.on('budget:alert', handler);
    return () => this.off('budget:alert', handler);
  }

  onEmployeeStatusChange(callback: (employee: Employee, oldStatus: string, newStatus: string) => void): () => void {
    const handler = (data: any) => callback(data.employee, data.oldStatus, data.newStatus);
    this.on('employee:status_changed', handler);
    return () => this.off('employee:status_changed', handler);
  }

  onPixelAgentUpdate(callback: (update: any) => void): () => void {
    const handler = (data: any) => callback(data);
    this.on('pixel_agent:state_changed', handler);
    return () => this.off('pixel_agent:state_changed', handler);
  }

  onWhatsAppMessage(callback: (message: any) => void): () => void {
    const handler = (data: any) => callback(data);
    this.on('whatsapp:message_received', handler);
    return () => this.off('whatsapp:message_received', handler);
  }

  onVoiceCommand(callback: (command: any) => void): () => void {
    const handler = (data: any) => callback(data);
    this.on('voice:command_received', handler);
    return () => this.off('voice:command_received', handler);
  }

  // Generic event listener
  onEvent<K extends RealtimeEventType>(eventType: K, callback: (payload: any) => void): () => void {
    this.on(eventType, callback);
    return () => this.off(eventType, callback);
  }
}

// ═══════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════

let orchestratorInstance: IronClawOrchestrator | null = null;

export function getOrchestrator(config?: Partial<OrchestratorConfig>): IronClawOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new IronClawOrchestrator(config);
  }
  return orchestratorInstance;
}

export async function initializeOrchestrator(config?: Partial<OrchestratorConfig>): Promise<IronClawOrchestrator> {
  const orchestrator = getOrchestrator(config);
  await orchestrator.start();
  return orchestrator;
}

export async function shutdownOrchestrator(): Promise<void> {
  if (orchestratorInstance) {
    await orchestratorInstance.stop();
    orchestratorInstance = null;
  }
}

// ═══════════════════════════════════════════════════════════════
// REACT HOOKS (for dashboard)
// ═══════════════════════════════════════════════════════════════

// These would be in a separate React package, but included here for completeness
/*
import { useEffect, useState } from 'react';

export function useOrchestrator() {
  const [orchestrator, setOrchestrator] = useState<IronClawOrchestrator | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const orch = await initializeOrchestrator();
        setOrchestrator(orch);
        setConnected(true);

        orch.on('connected', () => setConnected(true));
        orch.on('disconnected', () => setConnected(false));
        orch.on('error', (err) => setError(err));
      } catch (err) {
        setError(err as Error);
      }
    };

    init();

    return () => {
      shutdownOrchestrator();
    };
  }, []);

  return { orchestrator, connected, error };
}

export function useRealtimeEvent<K extends RealtimeEventType>(
  eventType: K,
  callback: (payload: any) => void
) {
  const { orchestrator } = useOrchestrator();

  useEffect(() => {
    if (!orchestrator) return;
    const cleanup = orchestrator.onEvent(eventType, callback);
    return cleanup;
  }, [orchestrator, eventType, callback]);
}
*/

export default IronClawOrchestrator;
