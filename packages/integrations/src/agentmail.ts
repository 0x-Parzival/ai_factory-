import { ApprovalGatedConnector, type BusinessAction, type OutreachApprovalContext } from "./actions";
import { readProviderJson, requireIsoTimestamp, safeInteger } from "./provider-http";

export interface AgentMailConfig {
  apiKey?: string;
  inboxId?: string;
  domain?: string;
}

export interface AgentMailPayload extends Record<string, unknown> {
  operation?: "list" | "create_inbox" | "send";
  username?: string;
  domain?: string;
  displayName?: string;
  limit?: number;
  before?: string;
  after?: string;
  recipient?: string;
  subject?: string;
  text?: string;
  outreach?: OutreachApprovalContext;
}

const API_ROOT = "https://api.agentmail.to/v0";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class AgentMailConnector extends ApprovalGatedConnector<AgentMailPayload, unknown> {
  readonly id = "agentmail";
  readonly supportedActions = ["email.read", "email.inbox.create", "email.send"] as const as Array<"email.read" | "email.inbox.create" | "email.send">;

  constructor(private readonly config: AgentMailConfig) {
    super();
  }

  async health() {
    const configured = Boolean(this.config.apiKey && this.config.inboxId);
    if (!configured) return { configured: false, reachable: false, error: "AgentMail API key and inbox ID are not configured" };
    try {
      const response = await fetch(`${API_ROOT}/inboxes/${encodeURIComponent(this.config.inboxId!)}`, {
        headers: this.headers(),
        signal: AbortSignal.timeout(4_000),
      });
      await readProviderJson(response, "AgentMail", 250_000);
      return { configured: true, reachable: true };
    } catch (error) {
      return { configured: true, reachable: false, error: error instanceof Error ? error.message : "AgentMail is unreachable" };
    }
  }

  protected async executeApproved(action: BusinessAction<AgentMailPayload>): Promise<unknown> {
    if (!this.config.apiKey) throw new Error("AgentMail API key is not configured");
    if (action.kind === "email.inbox.create") return this.createInbox(action);
    if (!this.config.inboxId) throw new Error("AgentMail inbox ID is not configured");
    if (action.kind === "email.read") return this.listMessages(action.payload);
    if (action.kind === "email.send") return this.sendMessage(action);
    throw new Error(`Unsupported AgentMail action: ${action.kind}`);
  }

  private async createInbox(action: BusinessAction<AgentMailPayload>) {
    if (action.payload.operation !== "create_inbox") throw new Error("AgentMail inbox creation requires operation=create_inbox");
    const username = action.payload.username?.trim();
    if (!username || !/^[a-z0-9][a-z0-9._-]{2,62}$/i.test(username)) throw new Error("A valid AgentMail username is required");
    const domain = action.payload.domain?.trim() || this.config.domain?.trim() || "agentmail.to";
    if (this.config.domain && domain !== this.config.domain) throw new Error("Inbox domain must match AGENTMAIL_DOMAIN");
    if (!/^[a-z0-9.-]+$/i.test(domain)) throw new Error("A valid AgentMail domain is required");
    const response = await fetch(`${API_ROOT}/inboxes`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify({
        username,
        domain,
        display_name: (action.payload.displayName || "Spiritual AI Assistant").slice(0, 100),
        client_id: action.idempotencyKey.slice(0, 200),
        metadata: { organization_id: action.organizationId, department_id: action.departmentId },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    return readProviderJson(response, "AgentMail", 250_000);
  }

  private async listMessages(payload: AgentMailPayload) {
    if (payload.operation && payload.operation !== "list") throw new Error("email.read supports only operation=list");
    const query = new URLSearchParams({ limit: String(safeInteger(payload.limit, 25, 1, 50)) });
    if (payload.before) query.set("before", requireIsoTimestamp(payload.before, "before"));
    if (payload.after) query.set("after", requireIsoTimestamp(payload.after, "after"));
    query.set("include_spam", "false");
    query.set("include_blocked", "false");
    query.set("include_unauthenticated", "false");
    query.set("include_trash", "false");
    const response = await fetch(`${API_ROOT}/inboxes/${encodeURIComponent(this.config.inboxId!)}/messages?${query}`, {
      headers: this.headers(),
      signal: AbortSignal.timeout(10_000),
    });
    return readProviderJson(response, "AgentMail");
  }

  private async sendMessage(action: BusinessAction<AgentMailPayload>) {
    if (action.payload.operation && action.payload.operation !== "send") throw new Error("email.send requires operation=send");
    const recipient = action.payload.recipient?.trim();
    const text = action.payload.text?.trim();
    const subject = action.payload.subject?.trim();
    if (!recipient || !EMAIL.test(recipient)) throw new Error("A single valid recipient is required");
    if (!subject || subject.length > 200) throw new Error("A subject of at most 200 characters is required");
    if (!text || text.length > 10_000) throw new Error("A plain-text message of at most 10,000 characters is required");
    if (action.payload.outreach?.recipientId !== recipient || action.payload.outreach?.message !== text) {
      throw new Error("AgentMail recipient and body must exactly match the approved outreach context");
    }
    const response = await fetch(`${API_ROOT}/inboxes/${encodeURIComponent(this.config.inboxId!)}/messages/send`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify({
        to: recipient,
        subject,
        text,
        headers: { "X-AI-Factory-Idempotency-Key": action.idempotencyKey.slice(0, 200) },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    return readProviderJson(response, "AgentMail", 250_000);
  }

  private headers(json = false) {
    return {
      authorization: `Bearer ${this.config.apiKey}`,
      ...(json ? { "content-type": "application/json" } : {}),
    };
  }
}

export function agentMailConfigFromEnv(env: NodeJS.ProcessEnv = process.env): AgentMailConfig {
  return { apiKey: env.AGENTMAIL_API_KEY, inboxId: env.AGENTMAIL_INBOX_ID, domain: env.AGENTMAIL_DOMAIN };
}
