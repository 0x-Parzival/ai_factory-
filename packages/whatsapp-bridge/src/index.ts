// ═══════════════════════════════════════════════════════════════
// WhatsApp Bridge - connect-with-all-code integration
// ═══════════════════════════════════════════════════════════════

import { EventEmitter } from 'events';
import { makeWASocket, DisconnectReason, useMultiFileAuthState, BaileysEventMap, WASocket, proto } from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode-terminal';
import { randomUUID } from 'crypto';
import {
  WhatsAppSession,
  WhatsAppGroup,
  WhatsAppMessage,
  WhatsAppIncomingMessage,
  WhatsAppOutgoingMessage,
  WhatsAppGroupConfig,
  WhatsAppParticipant,
  WhatsAppStatus,
  AcpMessage,
  AgentSession,
} from '@ai-factory/core';
import { AcpxBridge } from '@ai-factory/acpx-bridge';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const logger = pino({ level: 'info' });

export interface WhatsAppBridgeConfig {
  sessionName: string;
  orgId: string;
  acpxBridge: AcpxBridge;
  onQRCode?: (qr: string) => void;
  onConnected?: () => void;
  onDisconnected?: (reason: string) => void;
  onMessage?: (message: WhatsAppIncomingMessage) => void;
  autoCreateGroup?: boolean;
  groupName?: string;
  groupDescription?: string;
}

export interface WhatsAppBridgeState {
  session: WhatsAppSession | null;
  socket: WASocket | null;
  isConnected: boolean;
  qrCode: string | null;
  groupJid: string | null;
  participants: Map<string, WhatsAppParticipant>;
  messageQueue: WhatsAppOutgoingMessage[];
}

export class WhatsAppBridge extends EventEmitter {
  private config: WhatsAppBridgeConfig;
  private state: WhatsAppBridgeState = {
    session: null,
    socket: null,
    isConnected: false,
    qrCode: null,
    groupJid: null,
    participants: new Map(),
    messageQueue: [],
  };

  constructor(config: WhatsAppBridgeConfig) {
    super();
    this.config = config;
  }

  // ═══════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════

  async initialize(): Promise<void> {
    logger.info(`[WhatsApp] Initializing bridge for ${this.config.sessionName}`);

    // Load or create session from database
    await this.loadSession();

    // Create socket with auth state
    const { state, saveCreds } = await useMultiFileAuthState(`./sessions/${this.config.sessionName}`);

    this.state.socket = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: logger.child({ level: 'silent' }),
      browser: ['AI Factory', 'Chrome', '1.0.0'],
    });

    this.setupEventHandlers(saveCreds);
    this.setupAcpxIntegration();

    // Wait for connection
    await this.waitForConnection();
  }

  private setupEventHandlers(saveCreds: () => Promise<void>): void {
    const socket = this.state.socket!;

    socket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.state.qrCode = qr;
        QRCode.generate(qr, { small: true });
        this.config.onQRCode?.(qr);
        this.emit('qr', qr);
        logger.info('[WhatsApp] QR code generated - scan with WhatsApp');
      }

      if (connection === 'open') {
        this.state.isConnected = true;
        this.state.qrCode = null;
        this.config.onConnected?.();
        this.emit('connected');
        logger.info('[WhatsApp] Connected successfully');

        // Save session to database
        await this.saveSession();

        // Create or join AI Factory group
        if (this.config.autoCreateGroup) {
          await this.ensureGroupExists();
        }
      }

      if (connection === 'close') {
        this.state.isConnected = false;
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        this.config.onDisconnected?.(lastDisconnect?.error?.message || 'Unknown');
        this.emit('disconnected', lastDisconnect?.error?.message);

        if (shouldReconnect) {
          logger.info('[WhatsApp] Reconnecting...');
          setTimeout(() => this.initialize(), 5000);
        } else {
          logger.warn('[WhatsApp] Logged out, clearing session');
          await this.clearSession();
        }
      }
    });

    socket.ev.on('creds.update', saveCreds);

    socket.ev.on('messages.upsert', async (m) => {
      await this.handleIncomingMessages(m);
    });

    socket.ev.on('groups.update', async (updates) => {
      for (const update of updates) {
        await this.handleGroupUpdate(update);
      }
    });

    socket.ev.on('group-participants.update', async (update) => {
      await this.handleParticipantUpdate(update);
    });

    socket.ev.on('presence.update', async (update) => {
      this.handlePresenceUpdate(update);
    });
  }

  private setupAcpxIntegration(): void {
    // Listen for ACPX messages to send via WhatsApp
    this.config.acpxBridge.on('message', async (message: AcpMessage) => {
      if (message.to.startsWith('whatsapp:')) {
        const phoneNumber = message.to.replace('whatsapp:', '');
        await this.sendMessage({
          groupJid: phoneNumber,
          content: typeof message.payload === 'string' ? message.payload : JSON.stringify(message.payload),
          type: 'text',
        });
      }
    });

    // Listen for task assignments to notify via WhatsApp
    this.config.acpxBridge.on('task_assigned', async (data: any) => {
      const message = `🎯 *New Task Assigned*\n\n*Task:* ${data.task?.title}\n*Priority:* ${data.task?.priority}\n*Assigned to:* ${data.employee?.name}\n\n_Reply to this message to communicate with the agent_`;
      await this.sendToGroup(message);
    });

    this.config.acpxBridge.on('task_completed', async (data: any) => {
      const message = `✅ *Task Completed*\n\n*Task:* ${data.task?.title}\n*Completed by:* ${data.employee?.name}\n*Time:* ${new Date().toLocaleString()}`;
      await this.sendToGroup(message);
    });

    this.config.acpxBridge.on('approval_requested', async (data: any) => {
      const message = `⚠️ *Approval Required*\n\n*Workflow:* ${data.workflow?.name}\n*Step:* ${data.step?.name}\n*Requested by:* ${data.requestedBy}\n\nReply with *APPROVE* or *REJECT* followed by reason.`;
      await this.sendToGroup(message);
    });

    this.config.acpxBridge.on('budget_alert', async (data: any) => {
      const message = `💰 *Budget Alert*\n\n*Organization:* ${data.orgName}\n*Spent:* $${data.spent}\n*Allocated:* $${data.allocated}\n*Usage:* ${data.percent}%\n\nPlease review budget allocation.`;
      await this.sendToGroup(message);
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // MESSAGE HANDLING
  // ═══════════════════════════════════════════════════════════════

  private async handleIncomingMessages(m: BaileysEventMap<'messages.upsert'>[0]): Promise<void> {
    const socket = this.state.socket!;

    for (const msg of m.messages) {
      if (!msg.message || msg.key.fromMe) continue;

      const incoming: WhatsAppIncomingMessage = {
        messageId: msg.key.id!,
        groupJid: msg.key.remoteJid!,
        senderJid: msg.key.participant || msg.key.remoteJid!,
        senderName: msg.pushName || 'Unknown',
        content: this.extractMessageContent(msg.message),
        type: this.getMessageType(msg.message),
        timestamp: new Date(msg.messageTimestamp! * 1000),
        isFromMe: false,
        isEmployee: false,
        quotedMessageId: msg.message?.extendedTextMessage?.contextInfo?.stanzaId,
        metadata: {
          msgKey: msg.key,
          message: msg.message,
        },
      };

      // Check if sender is an employee
      const employee = await this.findEmployeeByPhone(incoming.senderJid);
      if (employee) {
        incoming.isEmployee = true;
        incoming.employeeId = employee.id;
      }

      // Save to database
      await this.saveMessage(incoming);

      // Emit event
      this.config.onMessage?.(incoming);
      this.emit('message', incoming);

      // Handle group messages for AI Factory group
      if (incoming.groupJid === this.state.groupJid) {
        await this.handleGroupMessage(incoming);
      }

      // Handle DM to bot
      if (!incoming.groupJid.endsWith('@g.us')) {
        await this.handleDirectMessage(incoming);
      }
    }
  }

  private async handleGroupMessage(message: WhatsAppIncomingMessage): Promise<void> {
    const content = message.content.trim();

    // Handle commands
    if (content.startsWith('/')) {
      await this.handleCommand(message, content);
      return;
    }

    // Handle approval responses
    if (content.toUpperCase().startsWith('APPROVE') || content.toUpperCase().startsWith('REJECT')) {
      await this.handleApprovalResponse(message, content);
      return;
    }

    // Forward to ACPX bridge for agent processing
    const employee = message.employeeId
      ? await prisma.employee.findUnique({ where: { id: message.employeeId } })
      : null;

    if (employee) {
      // Send to agent via ACPX
      await this.config.acpxBridge.sendMessage({
        from: 'whatsapp_user',
        to: employee.id,
        type: 'QUESTION',
        payload: {
          question: message.content,
          context: {
            source: 'whatsapp',
            groupJid: message.groupJid,
            senderName: message.senderName,
            timestamp: message.timestamp,
          },
        },
      });
    } else {
      // Forward to orchestrator for routing
      await this.config.acpxBridge.sendMessage({
        from: 'whatsapp_user',
        to: 'orchestrator',
        type: 'QUESTION',
        payload: {
          question: message.content,
          context: {
            source: 'whatsapp',
            groupJid: message.groupJid,
            senderJid: message.senderJid,
            senderName: message.senderName,
            timestamp: message.timestamp,
          },
        },
      });
    }
  }

  private async handleDirectMessage(message: WhatsAppIncomingMessage): Promise<void> {
    // DM to bot - treat as direct command or query
    await this.handleGroupMessage(message);
  }

  private async handleCommand(message: WhatsAppIncomingMessage, content: string): Promise<void> {
    const parts = content.slice(1).split(' ');
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (command) {
      case 'help':
        await this.sendToGroup(this.getHelpMessage());
        break;

      case 'status':
        await this.sendStatus(message);
        break;

      case 'tasks':
        await this.sendTasks(message, args[0]);
        break;

      case 'employees':
        await this.sendEmployees(message);
        break;

      case 'budget':
        await this.sendBudget(message);
        break;

      case 'workflows':
        await this.sendWorkflows(message);
        break;

      case 'deploy':
        if (args.length >= 2) {
          await this.deployAgent(message, args[0], args[1]);
        } else {
          await this.sendToGroup('Usage: /deploy <persona-slug> <department>');
        }
        break;

      case 'approve':
        await this.handleApprovalResponse(message, `APPROVE ${args.join(' ')}`);
        break;

      case 'reject':
        await this.handleApprovalResponse(message, `REJECT ${args.join(' ')}`);
        break;

      case 'jarvis':
        await this.handleJarvisCommand(message, args.join(' '));
        break;

      default:
        await this.sendToGroup(`Unknown command: ${command}. Type /help for available commands.`);
    }
  }

  private async handleApprovalResponse(message: WhatsAppIncomingMessage, content: string): Promise<void> {
    const isApprove = content.toUpperCase().startsWith('APPROVE');
    const reason = content.slice(isApprove ? 7 : 6).trim();

    // Find pending approval for this user
    const approval = await prisma.approval.findFirst({
      where: {
        status: 'PENDING',
        approvers: {
          some: {
            user: {
              // Match by phone number or name
              name: { contains: message.senderName },
            },
          },
        },
      },
      include: { approvers: true },
    });

    if (!approval) {
      await this.sendToGroup('No pending approval found for you.');
      return;
    }

    // Update approval
    await prisma.approval.update({
      where: { id: approval.id },
      data: {
        status: isApprove ? 'APPROVED' : 'REJECTED',
        decidedBy: message.senderJid,
        decidedAt: new Date(),
        decision: reason || (isApprove ? 'Approved via WhatsApp' : 'Rejected via WhatsApp'),
      },
    });

    // Notify via ACPX
    await this.config.acpxBridge.sendMessage({
      from: 'whatsapp_bridge',
      to: 'orchestrator',
      type: 'APPROVAL_RESPONSE',
      payload: {
        approvalId: approval.id,
        decision: isApprove ? 'APPROVED' : 'REJECTED',
        reason,
        decidedBy: message.senderName,
      },
    });

    await this.sendToGroup(`${isApprove ? '✅' : '❌'} ${isApprove ? 'Approved' : 'Rejected'}: ${approval.title}`);
  }

  private async handleJarvisCommand(message: WhatsAppIncomingMessage, command: string): Promise<void> {
    // Forward to voice control / Jarvis integration
    await this.config.acpxBridge.sendMessage({
      from: 'whatsapp_bridge',
      to: 'jarvis',
      type: 'VOICE_COMMAND',
      payload: {
        transcript: command,
        intent: 'command',
        entities: [],
        confidence: 1.0,
        source: 'whatsapp',
        userId: message.senderJid,
      },
    });

    await this.sendToGroup(`🎤 *Jarvis Command:* ${command}\n_Processing..._`);
  }

  // ═══════════════════════════════════════════════════════════════
  // GROUP MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  private async ensureGroupExists(): Promise<void> {
    const socket = this.state.socket!;

    // Check if group already exists in database
    const existingGroup = await prisma.whatsAppGroup.findFirst({
      where: { sessionId: this.state.session?.id, isAIFactoryGroup: true },
    });

    if (existingGroup) {
      this.state.groupJid = existingGroup.groupJid;
      logger.info(`[WhatsApp] Found existing AI Factory group: ${existingGroup.groupJid}`);
      return;
    }

    // Create new group
    const participants: string[] = [];

    // Add all deployed employees with phone numbers
    const employees = await prisma.employee.findMany({
      where: {
        orgId: this.config.orgId,
        status: 'ACTIVE',
        employmentType: 'AI_AGENT',
        metadata: { path: ['phoneNumber'], not: null },
      },
    });

    for (const emp of employees) {
      const phone = emp.metadata?.phoneNumber as string;
      if (phone) participants.push(phone + '@s.whatsapp.net');
    }

    // Add owner
    const owner = await prisma.user.findFirst({ where: { clerkId: 'demo-owner' } });
    if (owner) {
      // Owner phone would be stored in preferences or metadata
    }

    try {
      const result = await socket.groupCreate(
        this.config.groupName || 'AI Factory',
        participants
      );

      this.state.groupJid = result.gid;

      // Update group description
      await socket.groupUpdateDescription(result.gid, this.config.groupDescription || 'AI Factory company chat');

      // Save to database
      await prisma.whatsAppGroup.create({
        data: {
          sessionId: this.state.session!.id,
          groupJid: result.gid,
          subject: this.config.groupName || 'AI Factory',
          description: this.config.groupDescription,
          isAIFactoryGroup: true,
          participantCount: participants.length + 1,
        },
      });

      logger.info(`[WhatsApp] Created AI Factory group: ${result.gid}`);

      // Send welcome message
      await this.sendToGroup(this.getWelcomeMessage());
    } catch (error) {
      logger.error('[WhatsApp] Failed to create group:', error);
    }
  }

  private async handleGroupUpdate(update: any): Promise<void> {
    if (update.id === this.state.groupJid) {
      await prisma.whatsAppGroup.update({
        where: { groupJid: update.id },
        data: {
          subject: update.subject,
          description: update.desc,
          participantCount: update.size || 0,
        },
      });
    }
  }

  private async handleParticipantUpdate(update: any): Promise<void> {
    const { id, participants, action } = update;

    if (id === this.state.groupJid) {
      for (const participant of participants) {
        const phoneNumber = participant.split('@')[0];

        if (action === 'add') {
          // Check if new participant is an employee
          const employee = await this.findEmployeeByPhone(participant);
          if (employee) {
            await this.sendToGroup(`👋 Welcome ${employee.name} to AI Factory!`);
          }
        } else if (action === 'remove') {
          logger.info(`[WhatsApp] Participant removed: ${participant}`);
        }
      }

      // Update count
      await prisma.whatsAppGroup.update({
        where: { groupJid: id },
        data: { participantCount: { [action === 'add' ? 'increment' : 'decrement']: 1 } },
      });
    }
  }

  private handlePresenceUpdate(update: any): void {
    // Track online/offline status of participants
    this.emit('presence_update', update);
  }

  // ═══════════════════════════════════════════════════════════════
  // SENDING MESSAGES
  // ═══════════════════════════════════════════════════════════════

  async sendMessage(message: WhatsAppOutgoingMessage): Promise<string | null> {
    const socket = this.state.socket;
    if (!socket || !this.state.isConnected) {
      logger.warn('[WhatsApp] Not connected, queuing message');
      this.state.messageQueue.push(message);
      return null;
    }

    try {
      const jid = message.groupJid || this.state.groupJid;
      if (!jid) throw new Error('No group JID available');

      let result: proto.WebMessageInfo;

      switch (message.type) {
        case 'text':
          result = await socket.sendMessage(jid, { text: message.content }, { quoted: message.quotedMessageId ? { key: { id: message.quotedMessageId } } : undefined });
          break;
        case 'image':
          result = await socket.sendMessage(jid, { image: { url: message.mediaUrl! }, caption: message.caption });
          break;
        case 'document':
          result = await socket.sendMessage(jid, { document: { url: message.mediaUrl! }, fileName: message.name, caption: message.caption });
          break;
        case 'audio':
          result = await socket.sendMessage(jid, { audio: { url: message.mediaUrl! }, mimetype: message.mimeType });
          break;
        default:
          throw new Error(`Unsupported message type: ${message.type}`);
      }

      // Save outgoing message
      await this.saveOutgoingMessage(jid, message, result.key.id!);

      return result.key.id!;
    } catch (error) {
      logger.error('[WhatsApp] Failed to send message:', error);
      return null;
    }
  }

  async sendToGroup(content: string, type: 'text' | 'image' | 'document' = 'text', options?: { mediaUrl?: string; caption?: string; name?: string }): Promise<string | null> {
    return this.sendMessage({
      groupJid: this.state.groupJid!,
      content,
      type,
      ...options,
    });
  }

  async sendToEmployee(employeeId: string, content: string): Promise<string | null> {
    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) return null;

    const phone = employee.metadata?.phoneNumber as string;
    if (!phone) return null;

    return this.sendMessage({
      groupJid: phone + '@s.whatsapp.net',
      content,
      type: 'text',
    });
  }

  async replyToMessage(messageId: string, content: string): Promise<string | null> {
    return this.sendMessage({
      groupJid: this.state.groupJid!,
      content,
      type: 'text',
      quotedMessageId: messageId,
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // COMMAND HANDLERS
  // ═══════════════════════════════════════════════════════════════

  private getWelcomeMessage(): string {
    return `
🏭 *Welcome to AI Factory!*

This is the official company chat where all AI employees and the owner communicate.

*Available Commands:*
/help - Show this help
/status - Company status overview
/tasks [status] - List tasks (optional: filter by status)
/employees - List all deployed employees
/budget - Current budget status
/workflows - Active workflows
/deploy <persona> <department> - Deploy a new agent
/approve <reason> - Approve pending request
/reject <reason> - Reject pending request
/jarvis <command> - Send voice command to Jarvis

*How it works:*
- Mention an agent by name to talk to them directly
- Agents will respond in this group
- Use commands to manage the company
- All activities are logged and auditable

Let's build something amazing! 🚀
    `.trim();
  }

  private getHelpMessage(): string {
    return this.getWelcomeMessage();
  }

  private async sendStatus(message: WhatsAppIncomingMessage): Promise<void> {
    const org = await prisma.organization.findUnique({ where: { id: this.config.orgId } });
    const employees = await prisma.employee.count({ where: { orgId: this.config.orgId, status: 'ACTIVE' } });
    const tasks = await prisma.task.count({ where: { orgId: this.config.orgId } });
    const activeTasks = await prisma.task.count({ where: { orgId: this.config.orgId, status: { in: ['IN_PROGRESS', 'IN_REVIEW'] } } });
    const budget = await prisma.budget.findUnique({ where: { orgId: this.config.orgId } });

    const statusMsg = `
📊 *AI Factory Status*

*Organization:* ${org?.name}
*Employees:* ${employees} active
*Tasks:* ${tasks} total, ${activeTasks} active
*Budget:* $${budget?.totalSpent || 0} / $${budget?.totalAllocated || 0} (${budget ? ((Number(budget.totalSpent) / Number(budget.totalAllocated)) * 100).toFixed(1) : 0}%)
*WhatsApp:* ${this.state.isConnected ? '✅ Connected' : '❌ Disconnected'}
*Orchestrator:* ${this.config.acpxBridge.isConnected() ? '✅ Running' : '❌ Stopped'}

_Updated: ${new Date().toLocaleString()}_
    `.trim();

    await this.replyToMessage(message.messageId, statusMsg);
  }

  private async sendTasks(message: WhatsAppIncomingMessage, statusFilter?: string): Promise<void> {
    const where: any = { orgId: this.config.orgId };
    if (statusFilter) where.status = statusFilter.toUpperCase();

    const tasks = await prisma.task.findMany({
      where,
      include: { assignee: true, project: true },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });

    if (tasks.length === 0) {
      await this.replyToMessage(message.messageId, 'No tasks found.');
      return;
    }

    const taskList = tasks.map(t => {
      const statusEmoji = {
        TODO: '📋', IN_PROGRESS: '⚙️', IN_REVIEW: '👀', DONE: '✅', BLOCKED: '🚫',
      }[t.status] || '📝';
      return `${statusEmoji} *${t.title}* (${t.priority}) - ${t.assignee?.name || 'Unassigned'} [${t.project?.name || 'No Project'}]`;
    }).join('\n');

    await this.replyToMessage(message.messageId, `📋 *Tasks${statusFilter ? ` (${statusFilter})` : ''}*:\n\n${taskList}`);
  }

  private async sendEmployees(message: WhatsAppIncomingMessage): Promise<void> {
    const employees = await prisma.employee.findMany({
      where: { orgId: this.config.orgId, status: 'ACTIVE' },
      include: { department: true, persona: true },
    });

    if (employees.length === 0) {
      await this.replyToMessage(message.messageId, 'No employees deployed.');
      return;
    }

    const deptGroups = employees.reduce((acc, emp) => {
      const dept = emp.department?.name || 'No Department';
      if (!acc[dept]) acc[dept] = [];
      acc[dept].push(emp);
      return acc;
    }, {} as Record<string, typeof employees>);

    let msg = '👥 *Deployed Employees:*\n\n';
    for (const [dept, emps] of Object.entries(deptGroups)) {
      msg += `*${dept}:*\n`;
      for (const emp of emps) {
        msg += `  • ${emp.name} (${emp.persona?.category || 'Custom'}) - ${emp.status}\n`;
      }
      msg += '\n';
    }

    await this.replyToMessage(message.messageId, msg);
  }

  private async sendBudget(message: WhatsAppIncomingMessage): Promise<void> {
    const budget = await prisma.budget.findUnique({ where: { orgId: this.config.orgId } });
    if (!budget) {
      await this.replyToMessage(message.messageId, 'No budget configured.');
      return;
    }

    const transactions = await prisma.transaction.findMany({
      where: { orgId: this.config.orgId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const msg = `
💰 *Budget Overview*

*Allocated:* $${budget.totalAllocated}
*Spent:* $${budget.totalSpent}
*Remaining:* $${Number(budget.totalAllocated) - Number(budget.totalSpent)}
*Usage:* ${((Number(budget.totalSpent) / Number(budget.totalAllocated)) * 100).toFixed(1)}%

*Recent Transactions:*
${transactions.map(t => `  • ${t.type}: $${t.amount} - ${t.description}`).join('\n') || '  None'}

_Period: ${budget.period} (${budget.periodStart.toLocaleDateString()} - ${budget.periodEnd.toLocaleDateString()})_
    `.trim();

    await this.replyToMessage(message.messageId, msg);
  }

  private async sendWorkflows(message: WhatsAppIncomingMessage): Promise<void> {
    const runs = await prisma.workflowRun.findMany({
      where: { workflow: { orgId: this.config.orgId } },
      include: { workflow: true },
      orderBy: { startedAt: 'desc' },
      take: 10,
    });

    if (runs.length === 0) {
      await this.replyToMessage(message.messageId, 'No workflow executions.');
      return;
    }

    const msg = runs.map(r => {
      const statusEmoji = {
        RUNNING: '⚙️', COMPLETED: '✅', FAILED: '❌', NEEDS_APPROVAL: '⚠️',
      }[r.status] || '📋';
      return `${statusEmoji} ${r.workflow.name} - ${r.status} (Step ${r.currentStep + 1})`;
    }).join('\n');

    await this.replyToMessage(message.messageId, `🔄 *Recent Workflows:*\n\n${msg}`);
  }

  private async deployAgent(message: WhatsAppIncomingMessage, personaSlug: string, departmentSlug: string): Promise<void> {
    const persona = await prisma.persona.findUnique({ where: { slug: personaSlug } });
    if (!persona) {
      await this.replyToMessage(message.messageId, `Persona not found: ${personaSlug}`);
      return;
    }

    const department = await prisma.department.findFirst({ where: { orgId: this.config.orgId, slug: departmentSlug } });
    if (!department) {
      await this.replyToMessage(message.messageId, `Department not found: ${departmentSlug}`);
      return;
    }

    // Check if already deployed
    const existing = await prisma.employee.findFirst({ where: { orgId: this.config.orgId, personaId: persona.id } });
    if (existing) {
      await this.replyToMessage(message.messageId, `${persona.name} is already deployed as ${existing.name}`);
      return;
    }

    // Create employee
    const employee = await prisma.employee.create({
      data: {
        orgId: this.config.orgId,
        departmentId: department.id,
        personaId: persona.id,
        name: persona.name,
        title: persona.name,
        slug: persona.slug,
        email: `${persona.slug}@aifactory.dev`,
        systemPrompt: persona.systemPrompt,
        personality: persona.personality || '',
        model: persona.model,
        temperature: persona.temperature,
        maxTokens: persona.maxTokens,
        tools: persona.tools,
        tags: persona.tags,
        status: 'ONBOARDING',
        employmentType: 'AI_AGENT',
      },
    });

    // Notify orchestrator to activate
    await this.config.acpxBridge.sendMessage({
      from: 'whatsapp_bridge',
      to: 'orchestrator',
      type: 'TASK_ASSIGNMENT',
      payload: {
        action: 'deploy_employee',
        employeeId: employee.id,
        personaId: persona.id,
      },
    });

    await this.replyToMessage(message.messageId, `✅ Deployed ${persona.name} to ${department.name}!\nEmployee ID: ${employee.id}`);
  }

  // ═══════════════════════════════════════════════════════════════
  // UTILITY METHODS
  // ═══════════════════════════════════════════════════════════════

  private extractMessageContent(msg: proto.IMessage): string {
    if (msg.conversation) return msg.conversation;
    if (msg.extendedTextMessage?.text) return msg.extendedTextMessage.text;
    if (msg.imageMessage?.caption) return `[Image] ${msg.imageMessage.caption}`;
    if (msg.videoMessage?.caption) return `[Video] ${msg.videoMessage.caption}`;
    if (msg.documentMessage?.title) return `[Document] ${msg.documentMessage.title}`;
    if (msg.audioMessage) return '[Audio Message]';
    if (msg.stickerMessage) return '[Sticker]';
    if (msg.locationMessage) return '[Location]';
    if (msg.contactMessage) return `[Contact] ${msg.contactMessage.displayName}`;
    return '[Unknown Message Type]';
  }

  private getMessageType(msg: proto.IMessage): string {
    if (msg.conversation || msg.extendedTextMessage) return 'text';
    if (msg.imageMessage) return 'image';
    if (msg.videoMessage) return 'video';
    if (msg.documentMessage) return 'document';
    if (msg.audioMessage) return 'audio';
    if (msg.stickerMessage) return 'sticker';
    if (msg.locationMessage) return 'location';
    if (msg.contactMessage) return 'contact';
    return 'unknown';
  }

  private async findEmployeeByPhone(phoneJid: string): Promise<any> {
    const phoneNumber = phoneJid.split('@')[0];
    return prisma.employee.findFirst({
      where: {
        orgId: this.config.orgId,
        metadata: { path: ['phoneNumber'], equals: phoneNumber },
      },
    });
  }

  private async saveMessage(message: WhatsAppIncomingMessage): Promise<void> {
    await prisma.whatsAppMessage.create({
      data: {
        groupId: (await this.getGroupId(message.groupJid)) || '',
        messageId: message.messageId,
        senderJid: message.senderJid,
        senderName: message.senderName,
        content: message.content,
        type: message.type,
        timestamp: message.timestamp,
        isFromMe: message.isFromMe,
        isEmployee: message.isEmployee,
        employeeId: message.employeeId,
        quotedMessageId: message.quotedMessageId,
        metadata: message.metadata,
      },
    });
  }

  private async saveOutgoingMessage(groupJid: string, message: WhatsAppOutgoingMessage, messageId: string): Promise<void> {
    const group = await this.getGroupId(groupJid);
    if (!group) return;

    await prisma.whatsAppMessage.create({
      data: {
        groupId: group,
        messageId,
        senderJid: this.state.socket?.user?.id || 'bot',
        senderName: 'AI Factory Bot',
        content: message.content,
        type: message.type,
        timestamp: new Date(),
        isFromMe: true,
        metadata: { quotedMessageId: message.quotedMessageId },
      },
    });
  }

  private async getGroupId(groupJid: string): Promise<string | null> {
    const group = await prisma.whatsAppGroup.findUnique({ where: { groupJid } });
    return group?.id || null;
  }

  // ═══════════════════════════════════════════════════════════════
  // SESSION PERSISTENCE
  // ═══════════════════════════════════════════════════════════════

  private async loadSession(): Promise<void> {
    const session = await prisma.whatsAppSession.findUnique({
      where: { orgId_phoneNumber: { orgId: this.config.orgId, phoneNumber: this.config.sessionName } },
    });

    if (session) {
      this.state.session = session;
      logger.info('[WhatsApp] Loaded existing session');
    } else {
      // Create new session
      this.state.session = await prisma.whatsAppSession.create({
        data: {
          orgId: this.config.orgId,
          phoneNumber: this.config.sessionName,
          name: this.config.sessionName,
          status: 'CONNECTING',
        },
      });
    }
  }

  private async saveSession(): Promise<void> {
    if (!this.state.session || !this.state.socket) return;

    const creds = this.state.socket.authState.creds;
    await prisma.whatsAppSession.update({
      where: { id: this.state.session.id },
      data: {
        sessionData: creds as any,
        status: 'CONNECTED',
        lastConnected: new Date(),
      },
    });
  }

  private async clearSession(): Promise<void> {
    if (this.state.session) {
      await prisma.whatsAppSession.update({
        where: { id: this.state.session.id },
        data: { status: 'LOGGED_OUT', sessionData: {} },
      });
    }
  }

  private waitForConnection(timeout = 60000): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.state.isConnected) return resolve();

      const timer = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, timeout);

      this.once('connected', () => {
        clearTimeout(timer);
        resolve();
      });

      this.once('disconnected', (reason) => {
        clearTimeout(timer);
        reject(new Error(`Disconnected: ${reason}`));
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════

  getState(): WhatsAppBridgeState {
    return { ...this.state };
  }

  isConnected(): boolean {
    return this.state.isConnected;
  }

  getGroupJid(): string | null {
    return this.state.groupJid;
  }

  async shutdown(): Promise<void> {
    if (this.state.socket) {
      await this.state.socket.logout();
      this.state.socket = null;
    }
    this.state.isConnected = false;
    this.removeAllListeners();
    logger.info('[WhatsApp] Bridge shutdown complete');
  }
}

// ═══════════════════════════════════════════════════════════════
// FACTORY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

let whatsappBridgeInstance: WhatsAppBridge | null = null;

export function getWhatsAppBridge(config?: WhatsAppBridgeConfig): WhatsAppBridge {
  if (!whatsappBridgeInstance && config) {
    whatsappBridgeInstance = new WhatsAppBridge(config);
  }
  return whatsappBridgeInstance!;
}

export async function initializeWhatsAppBridge(config: WhatsAppBridgeConfig): Promise<WhatsAppBridge> {
  const bridge = getWhatsAppBridge(config);
  await bridge.initialize();
  return bridge;
}

export async function shutdownWhatsAppBridge(): Promise<void> {
  if (whatsappBridgeInstance) {
    await whatsappBridgeInstance.shutdown();
    whatsappBridgeInstance = null;
  }
}

export default WhatsAppBridge;