import { ApprovalGatedConnector, type BusinessAction } from "./actions";

export interface OpenOutreachConfig {
  baseUrl?: string;
  factoryToken?: string;
}

export interface OpenOutreachPayload extends Record<string, unknown> {
  operation?: "status" | "approvals" | "approve" | "reject";
  dealId?: number;
  fingerprint?: string;
  reason?: string;
}

function safeBaseUrl(value?: string) {
  if (!value) throw new Error("OpenOutreach base URL is not configured");
  const url = new URL(value);
  const local = url.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !local) throw new Error("OpenOutreach must use HTTPS or a localhost URL");
  return url.origin;
}

export class OpenOutreachConnector extends ApprovalGatedConnector<OpenOutreachPayload, unknown> {
  readonly id = "openoutreach";
  readonly supportedActions = ["analytics.read", "research.read", "email.send", "customer.record.update"] as const as Array<"analytics.read" | "research.read" | "email.send" | "customer.record.update">;

  constructor(private readonly config: OpenOutreachConfig) {
    super();
  }

  async health() {
    if (!this.config.baseUrl || !this.config.factoryToken) {
      return { configured: false, reachable: false, error: "OpenOutreach URL and factory token are not configured" };
    }
    try {
      await this.request("/api/spiritualai/status", { signal: AbortSignal.timeout(3_000) });
      return { configured: true, reachable: true };
    } catch (error) {
      return { configured: true, reachable: false, error: error instanceof Error ? error.message : "OpenOutreach is unreachable" };
    }
  }

  protected async executeApproved(action: BusinessAction<OpenOutreachPayload>): Promise<unknown> {
    const operation = action.payload.operation;
    if ((action.kind === "analytics.read" || action.kind === "research.read") && operation === "status") {
      return this.request("/api/spiritualai/status");
    }
    if ((action.kind === "analytics.read" || action.kind === "research.read") && operation === "approvals") {
      return this.request("/api/spiritualai/approvals");
    }
    if (action.kind === "email.send" && operation === "approve") {
      const dealId = this.dealId(action.payload.dealId);
      if (!action.payload.fingerprint?.trim()) throw new Error("Exact draft fingerprint is required");
      const pending = await this.request("/api/spiritualai/approvals") as { approvals?: Array<{ id: number; recipient: string; body: string; fingerprint: string }> };
      const draft = pending.approvals?.find((item) => item.id === dealId);
      if (!draft) throw new Error("Pending OpenOutreach draft not found");
      const outreach = action.payload.outreach as { recipientId?: string; message?: string } | undefined;
      if (draft.recipient !== outreach?.recipientId || draft.body !== outreach?.message || draft.fingerprint !== action.payload.fingerprint) {
        throw new Error("Approval payload does not match the pending recipient, body, and fingerprint");
      }
      return this.request(`/api/spiritualai/approvals/${dealId}/approve`, {
        method: "POST",
        body: JSON.stringify({ fingerprint: action.payload.fingerprint }),
      });
    }
    if (action.kind === "customer.record.update" && operation === "reject") {
      const dealId = this.dealId(action.payload.dealId);
      return this.request(`/api/spiritualai/approvals/${dealId}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason: action.payload.reason || "Owner rejected outreach" }),
      });
    }
    throw new Error(`Unsupported OpenOutreach operation ${String(operation)} for ${action.kind}`);
  }

  private dealId(value?: number) {
    if (!Number.isSafeInteger(value) || Number(value) <= 0) throw new Error("A positive dealId is required");
    return Number(value);
  }

  private async request(path: string, init: RequestInit = {}) {
    if (!this.config.factoryToken) throw new Error("OpenOutreach factory token is not configured");
    const response = await fetch(`${safeBaseUrl(this.config.baseUrl)}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${this.config.factoryToken}`,
        "content-type": "application/json",
        ...init.headers,
      },
    });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) throw new Error(payload.error || `OpenOutreach returned HTTP ${response.status}`);
    return payload;
  }
}

export function openOutreachConfigFromEnv(env: NodeJS.ProcessEnv = process.env): OpenOutreachConfig {
  return { baseUrl: env.OPENOUTREACH_BASE_URL, factoryToken: env.OPENOUTREACH_FACTORY_TOKEN };
}
