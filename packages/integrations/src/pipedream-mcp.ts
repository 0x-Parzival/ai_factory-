import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import { ApprovalGatedConnector, type BusinessAction, type BusinessActionKind } from "./actions";

export interface PipedreamMcpConfig {
  clientId?: string;
  clientSecret?: string;
  projectId?: string;
  environment?: "development" | "production";
  allowedApps: readonly string[];
  serverUrl?: string;
}

export interface PipedreamToolPayload extends Record<string, unknown> {
  externalUserId?: string;
  app?: string;
  toolName?: string;
  arguments?: Record<string, unknown>;
}

type CachedToken = { value: string; expiresAt: number };

const SUPPORTED_ACTIONS: BusinessActionKind[] = [
  "research.read",
  "analytics.read",
  "content.draft",
  "customer.record.update",
  "email.send",
  "social.publish",
  "social.message",
  "voice.call",
  "contract.accept",
  "payment.create",
  "payment.refund",
  "account.connect",
];

/**
 * A fixed-host MCP gateway for Pipedream Connect. Account OAuth stays
 * interactive; the CEO may use already-connected accounts only through a
 * typed BusinessAction, so public, financial, contractual and credential
 * changes keep the normal approval gate.
 */
export class PipedreamMcpConnector extends ApprovalGatedConnector<PipedreamToolPayload, unknown> {
  readonly id = "pipedream-mcp";
  readonly supportedActions = SUPPORTED_ACTIONS;
  private cachedToken?: CachedToken;

  constructor(private readonly config: PipedreamMcpConfig) {
    super();
  }

  async health() {
    const configured = Boolean(this.config.clientId && this.config.clientSecret && this.config.projectId);
    if (!configured) return { configured: false, reachable: false, error: "Pipedream MCP credentials are not configured" };
    try {
      await this.accessToken(4_000);
      return { configured: true, reachable: true };
    } catch (error) {
      return { configured: true, reachable: false, error: error instanceof Error ? error.message : "Pipedream MCP is unreachable" };
    }
  }

  protected async executeApproved(action: BusinessAction<PipedreamToolPayload>): Promise<unknown> {
    if (action.kind === "account.connect") {
      throw new Error("Connecting a new account requires the owner to complete the platform's interactive OAuth flow");
    }
    const { externalUserId, app, toolName, arguments: toolArguments } = action.payload;
    if (!externalUserId?.trim()) throw new Error("externalUserId is required for an MCP tool call");
    if (!app?.trim() || !this.config.allowedApps.includes(app)) throw new Error("The requested MCP app is not allowlisted");
    if (!toolName?.trim() || !/^[a-zA-Z0-9_.:/-]{1,200}$/.test(toolName)) throw new Error("A valid MCP toolName is required");
    if (toolArguments && (Array.isArray(toolArguments) || typeof toolArguments !== "object")) throw new Error("MCP tool arguments must be an object");

    const token = await this.accessToken();
    const serverUrl = new URL(this.config.serverUrl || "https://remote.mcp.pipedream.net/v3");
    if (serverUrl.protocol !== "https:" || serverUrl.hostname !== "remote.mcp.pipedream.net") {
      throw new Error("Pipedream MCP server URL must use the approved HTTPS host");
    }
    const transport = new StreamableHTTPClientTransport(serverUrl, {
      requestInit: {
        headers: {
          authorization: `Bearer ${token}`,
          "x-pd-project-id": this.config.projectId!,
          "x-pd-environment": this.config.environment || "development",
          "x-pd-external-user-id": externalUserId,
          "x-pd-app-slug": app,
        },
      },
    });
    const client = new Client({ name: "spiritual-ai-factory", version: "1.0.0" }, { capabilities: {} });
    try {
      await client.connect(transport);
      const available = await client.listTools();
      if (!available.tools.some((tool) => tool.name === toolName)) {
        throw new Error(`The connected ${app} MCP server does not expose ${toolName}`);
      }
      return await client.callTool({ name: toolName, arguments: toolArguments || {} });
    } finally {
      await client.close().catch(() => undefined);
    }
  }

  private async accessToken(timeoutMs = 10_000): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 60_000) return this.cachedToken.value;
    if (!this.config.clientId || !this.config.clientSecret || !this.config.projectId) {
      throw new Error("Pipedream MCP credentials are not configured");
    }
    const response = await fetch("https://api.pipedream.com/v1/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        scope: "connect:accounts:read connect:proxy",
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const payload = await response.json().catch(() => ({})) as { access_token?: string; expires_in?: number; error_description?: string };
    if (!response.ok || !payload.access_token) throw new Error(payload.error_description || `Pipedream authentication failed with HTTP ${response.status}`);
    this.cachedToken = { value: payload.access_token, expiresAt: Date.now() + Math.max(60, payload.expires_in || 3_600) * 1_000 };
    return payload.access_token;
  }
}

export function pipedreamMcpConfigFromEnv(env: NodeJS.ProcessEnv = process.env): PipedreamMcpConfig {
  return {
    clientId: env.PIPEDREAM_CLIENT_ID,
    clientSecret: env.PIPEDREAM_CLIENT_SECRET,
    projectId: env.PIPEDREAM_PROJECT_ID,
    environment: env.PIPEDREAM_ENVIRONMENT === "production" ? "production" : "development",
    allowedApps: (env.PIPEDREAM_ALLOWED_APPS || "gmail,whatsapp_business,telegram_bot_api,discord_bot,twilio,google_calendar,google_sheets,google_drive,linkedin,instagram_business,facebook_pages,twitter,youtube_data_api,slack,notion,github,hubspot,stripe,razorpay")
      .split(",").map((value) => value.trim()).filter(Boolean),
  };
}
