// ═══════════════════════════════════════════════════════════════
// ACPX Bridge - Agent Client Protocol Communication Layer
// ═══════════════════════════════════════════════════════════════

import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { randomUUID } from 'crypto';
import {
  AcpMessage,
  AcpMessageType,
  AgentSession,
  SkillInvocation,
  SkillResult,
  RealtimeEvent,
  RealtimeEventType,
} from '@ai-factory/core';

export interface AcpxBridgeConfig {
  acpxEndpoint: string;
  orchestratorId: string;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  heartbeatInterval: number;
}

export interface AcpAgentRegistration {
  employeeId: string;
  name: string;
  capabilities: string[];
  status: 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
}

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

export class AcpxBridge extends EventEmitter {
  private config: AcpxBridgeConfig;
  private ws: WebSocket | null = null;
  private sessions: Map<string, AgentSession> = new Map();
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private messageId = 0;
  private reconnectAttempts = 0;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private connected = false;
  private connecting = false;

  constructor(config: Partial<AcpxBridgeConfig> = {}) {
    super();
    this.config = {
      acpxEndpoint: config.acpxEndpoint || process.env.ACPX_ENDPOINT || 'ws://localhost:8080/acp',
      orchestratorId: config.orchestratorId || 'orchestrator',
      reconnectInterval: config.reconnectInterval || 5000,
      maxReconnectAttempts: config.maxReconnectAttempts || 10,
      heartbeatInterval: config.heartbeatInterval || 30000,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // CONNECTION MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  async connect(): Promise<void> {
    if (this.connected || this.connecting) return;

    this.connecting = true;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.acpxEndpoint);

        this.ws.on('open', () => {
          console.log('[ACPX] Connected to ACP server');
          this.connected = true;
          this.connecting = false;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.registerOrchestrator();
          resolve();
        });

        this.ws.on('message', (data) => {
          this.handleMessage(data.toString());
        });

        this.ws.on('close', (code, reason) => {
          console.log(`[ACPX] Disconnected: ${code} - ${reason.toString()}`);
          this.connected = false;
          this.stopHeartbeat();
          this.handleDisconnect();
        });

        this.ws.on('error', (error) => {
          console.error('[ACPX] Connection error:', error);
          if (this.connecting) {
            this.connecting = false;
            reject(error);
          }
        });

        // Connection timeout
        setTimeout(() => {
          if (this.connecting) {
            this.connecting = false;
            this.ws?.close();
            reject(new Error('Connection timeout'));
          }
        }, 10000);
      } catch (error) {
        this.connecting = false;
        reject(error);
      }
    });
  }

  async disconnect(): Promise<void> {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close(1000, 'Graceful disconnect');
      this.ws = null;
    }
    this.connected = false;
    this.sessions.clear();
  }

  private handleDisconnect(): void {
    this.connected = false;
    this.emit('disconnected');

    // Reject all pending requests
    for (const [, request] of this.pendingRequests) {
      clearTimeout(request.timeout);
      request.reject(new Error('Connection lost'));
    }
    this.pendingRequests.clear();

    // Attempt reconnection
    if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`[ACPX] Reconnecting... (attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts})`);
      setTimeout(() => this.connect().catch(console.error), this.config.reconnectInterval);
    } else {
      console.error('[ACPX] Max reconnect attempts reached');
      this.emit('reconnect_failed');
    }
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.connected && this.ws?.readyState === WebSocket.OPEN) {
        this.sendRaw({ type: 'HEARTBEAT', timestamp: Date.now() });
      }
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // MESSAGE HANDLING
  // ═══════════════════════════════════════════════════════════════

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      // Handle response to pending request
      if (message.correlationId && this.pendingRequests.has(message.correlationId)) {
        const request = this.pendingRequests.get(message.correlationId)!;
        clearTimeout(request.timeout);
        this.pendingRequests.delete(message.correlationId);

        if (message.error) {
          request.reject(new Error(message.error));
        } else {
          request.resolve(message.payload);
        }
        return;
      }

      // Handle incoming ACP message
      if (message.type && this.isAcpMessageType(message.type)) {
        const acpMessage: AcpMessage = {
          id: message.id || randomUUID(),
          from: message.from,
          to: message.to,
          type: message.type,
          payload: message.payload,
          correlationId: message.correlationId,
          timestamp: message.timestamp || new Date().toISOString(),
          metadata: message.metadata,
        };

        this.handleAcpMessage(acpMessage);
      }
    } catch (error) {
      console.error('[ACPX] Failed to parse message:', error);
    }
  }

  private handleAcpMessage(message: AcpMessage): void {
    // Update session tracking
    this.updateSession(message.from, message);

    // Emit specific event
    this.emit(message.type.toLowerCase(), message);
    this.emit('message', message);

    // Handle specific message types
    switch (message.type) {
      case 'TASK_ASSIGNMENT':
        this.emit('task_assigned', message.payload);
        break;
      case 'TASK_COMPLETION':
        this.emit('task_completed', message.payload);
        break;
      case 'TASK_UPDATE':
        this.emit('task_updated', message.payload);
        break;
      case 'SKILL_RESULT':
        this.emit('skill_completed', message.payload);
        break;
      case 'APPROVAL_RESPONSE':
        this.emit('approval_response', message.payload);
        break;
      case 'WORKFLOW_EVENT':
        this.emit('workflow_event', message.payload);
        break;
      case 'STATUS_UPDATE':
        this.updateSessionStatus(message.from, message.payload);
        break;
      case 'ERROR':
        this.emit('agent_error', { from: message.from, error: message.payload });
        break;
      case 'LOG':
        this.emit('agent_log', { from: message.from, log: message.payload });
        break;
      case 'METRICS':
        this.emit('agent_metrics', { from: message.from, metrics: message.payload });
        break;
    }
  }

  private updateSession(agentId: string, message: AcpMessage): void {
    const existing = this.sessions.get(agentId);
    const payload = message.payload as { taskId?: unknown } | undefined;
    const session: AgentSession = {
      employeeId: agentId,
      status: existing?.status || 'CONNECTING',
      lastHeartbeat: new Date(),
      capabilities: existing?.capabilities || [],
      currentTask: typeof payload?.taskId === 'string' ? payload.taskId : undefined,
      metadata: {
        ...existing?.metadata,
        lastMessageType: message.type,
        lastMessageAt: message.timestamp,
      },
    };
    this.sessions.set(agentId, session);
  }

  private updateSessionStatus(agentId: string, payload: any): void {
    const session = this.sessions.get(agentId);
    if (session) {
      session.status = payload.status || session.status;
      session.currentTask = payload.currentTask;
      session.capabilities = payload.capabilities || session.capabilities;
      session.lastHeartbeat = new Date();
      this.sessions.set(agentId, session);
      this.emit('session_updated', session);
    }
  }

  private isAcpMessageType(type: string): type is AcpMessageType {
    const validTypes: AcpMessageType[] = [
      'TASK_ASSIGNMENT', 'TASK_UPDATE', 'TASK_COMPLETION',
      'QUESTION', 'ANSWER', 'STATUS_UPDATE', 'HEARTBEAT',
      'SKILL_INVOKE', 'SKILL_RESULT', 'APPROVAL_REQUEST',
      'APPROVAL_RESPONSE', 'WORKFLOW_EVENT', 'ERROR', 'LOG', 'METRICS',
    ];
    return validTypes.includes(type as AcpMessageType);
  }

  // ═══════════════════════════════════════════════════════════════
  // SENDING MESSAGES
  // ═══════════════════════════════════════════════════════════════

  private sendRaw(data: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  async sendMessage(message: Omit<AcpMessage, 'id' | 'timestamp'>): Promise<void> {
    const fullMessage: AcpMessage = {
      ...message,
      id: randomUUID(),
      timestamp: new Date().toISOString(),
    };

    this.sendRaw(fullMessage);
  }

  async sendRequest<T = any>(
    to: string,
    type: AcpMessageType,
    payload: any,
    timeout = 30000
  ): Promise<T> {
    const correlationId = randomUUID();

    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(correlationId);
        reject(new Error(`Request timeout after ${timeout}ms`));
      }, timeout);

      this.pendingRequests.set(correlationId, {
        resolve,
        reject,
        timeout: timeoutHandle,
      });

      this.sendRaw({
        id: randomUUID(),
        from: this.config.orchestratorId,
        to,
        type,
        payload,
        correlationId,
        timestamp: new Date().toISOString(),
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // HIGH-LEVEL OPERATIONS
  // ═══════════════════════════════════════════════════════════════

  async assignTask(employeeId: string, task: any): Promise<void> {
    await this.sendMessage({
      from: this.config.orchestratorId,
      to: employeeId,
      type: 'TASK_ASSIGNMENT',
      payload: task,
    });
  }

  async invokeSkill(employeeId: string, invocation: SkillInvocation): Promise<SkillResult> {
    return this.sendRequest<SkillResult>(employeeId, 'SKILL_INVOKE', invocation, invocation.timeout || 60000);
  }

  async requestApproval(employeeId: string, approval: any): Promise<any> {
    return this.sendRequest(employeeId, 'APPROVAL_REQUEST', approval, 3600000); // 1 hour
  }

  async sendQuestion(employeeId: string, question: string, context?: any): Promise<string> {
    const response = await this.sendRequest<{ answer: string }>(employeeId, 'QUESTION', { question, context }, 60000);
    return response.answer;
  }

  async broadcastToAll(type: AcpMessageType, payload: any): Promise<void> {
    for (const [employeeId] of this.sessions) {
      if (employeeId !== this.config.orchestratorId) {
        await this.sendMessage({
          from: this.config.orchestratorId,
          to: employeeId,
          type,
          payload,
        });
      }
    }
  }

  async broadcastToDepartment(departmentId: string, type: AcpMessageType, payload: any, employeeMap: Map<string, string>): Promise<void> {
    for (const [employeeId, deptId] of employeeMap) {
      if (deptId === departmentId) {
        await this.sendMessage({
          from: this.config.orchestratorId,
          to: employeeId,
          type,
          payload,
        });
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SESSION MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  registerAgent(registration: AcpAgentRegistration): void {
    const session: AgentSession = {
      employeeId: registration.employeeId,
      status: registration.status,
      lastHeartbeat: new Date(),
      capabilities: registration.capabilities,
      metadata: { registeredAt: new Date().toISOString() },
    };
    this.sessions.set(registration.employeeId, session);
    this.emit('agent_registered', session);
  }

  unregisterAgent(employeeId: string): void {
    this.sessions.delete(employeeId);
    this.emit('agent_unregistered', employeeId);
  }

  getSession(employeeId: string): AgentSession | undefined {
    return this.sessions.get(employeeId);
  }

  getAllSessions(): AgentSession[] {
    return Array.from(this.sessions.values());
  }

  getConnectedAgents(): AgentSession[] {
    return Array.from(this.sessions.values()).filter(s => s.status === 'CONNECTED');
  }

  isConnected(): boolean {
    return this.connected;
  }

  getOrchestratorId(): string {
    return this.config.orchestratorId;
  }

  // ═══════════════════════════════════════════════════════════════
  // ORCHESTRATOR REGISTRATION
  // ═══════════════════════════════════════════════════════════════

  private registerOrchestrator(): void {
    this.sendRaw({
      type: 'REGISTER',
      agentId: this.config.orchestratorId,
      name: 'IronClaw Orchestrator',
      capabilities: [
        'TASK_ASSIGNMENT',
        'WORKFLOW_EXECUTION',
        'APPROVAL_MANAGEMENT',
        'SKILL_INVOCATION',
        'METRICS_COLLECTION',
        'BUDGET_MONITORING',
      ],
      metadata: {
        version: '1.0.0',
        role: 'orchestrator',
      },
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// SINGLETON & HELPERS
// ═══════════════════════════════════════════════════════════════

let bridgeInstance: AcpxBridge | null = null;

export function getAcpxBridge(config?: Partial<AcpxBridgeConfig>): AcpxBridge {
  if (!bridgeInstance) {
    bridgeInstance = new AcpxBridge(config);
  }
  return bridgeInstance;
}

export async function initializeAcpxBridge(config?: Partial<AcpxBridgeConfig>): Promise<AcpxBridge> {
  const bridge = getAcpxBridge(config);
  await bridge.connect();
  return bridge;
}

export async function shutdownAcpxBridge(): Promise<void> {
  if (bridgeInstance) {
    await bridgeInstance.disconnect();
    bridgeInstance = null;
  }
}

// ═══════════════════════════════════════════════════════════════
// REACT HOOKS
// ═══════════════════════════════════════════════════════════════

/*
import { useEffect, useState, useCallback } from 'react';

export function useAcpxBridge() {
  const [bridge, setBridge] = useState<AcpxBridge | null>(null);
  const [connected, setConnected] = useState(false);
  const [sessions, setSessions] = useState<AgentSession[]>([]);

  useEffect(() => {
    const init = async () => {
      try {
        const b = await initializeAcpxBridge();
        setBridge(b);
        setConnected(true);

        b.on('connected', () => setConnected(true));
        b.on('disconnected', () => setConnected(false));
        b.on('agent_registered', (session) => {
          setSessions(prev => [...prev.filter(s => s.employeeId !== session.employeeId), session]);
        });
        b.on('agent_unregistered', (employeeId) => {
          setSessions(prev => prev.filter(s => s.employeeId !== employeeId));
        });
        b.on('session_updated', (session) => {
          setSessions(prev => prev.map(s => s.employeeId === session.employeeId ? session : s));
        });

        setSessions(b.getAllSessions());
      } catch (err) {
        console.error('Failed to initialize ACPX bridge:', err);
      }
    };

    init();

    return () => {
      shutdownAcpxBridge();
    };
  }, []);

  const sendMessage = useCallback(async (to: string, type: AcpMessageType, payload: any) => {
    if (!bridge) throw new Error('Bridge not initialized');
    await bridge.sendMessage({ from: bridge.getOrchestratorId(), to, type, payload });
  }, [bridge]);

  const invokeSkill = useCallback(async (employeeId: string, invocation: SkillInvocation) => {
    if (!bridge) throw new Error('Bridge not initialized');
    return bridge.invokeSkill(employeeId, invocation);
  }, [bridge]);

  return { bridge, connected, sessions, sendMessage, invokeSkill };
}
*/

export default AcpxBridge;
