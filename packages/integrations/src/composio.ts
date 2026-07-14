import { ApprovalGatedConnector, type BusinessAction, type BusinessActionKind } from "./actions";
import { readProviderJson } from "./provider-http";

export interface ComposioConfig {
  apiKey?: string;
  allowedToolkits: readonly string[];
  actionToolAllowlist: Partial<Record<BusinessActionKind, readonly string[]>>;
  toolkitVersions: Readonly<Record<string, string>>;
}

export interface ComposioPayload extends Record<string, unknown> {
  toolkit?: string;
  toolSlug?: string;
  userId?: string;
  connectedAccountId?: string;
  arguments?: Record<string, unknown>;
}

const API_ROOT = "https://backend.composio.dev/api/v3.1";
const SUPPORTED_ACTIONS: BusinessActionKind[] = [
  "research.read", "analytics.read", "content.draft", "email.read", "email.send",
  "social.publish", "social.message", "customer.record.update", "payment.create",
  "payment.refund", "account.connect",
];

export class ComposioConnector extends ApprovalGatedConnector<ComposioPayload, unknown> {
  readonly id = "composio";
  readonly supportedActions = SUPPORTED_ACTIONS;

  constructor(private readonly config: ComposioConfig) { super(); }

  async health() {
    if (!this.config.apiKey) return { configured: false, reachable: false, error: "Composio API key is not configured" };
    try {
      const response = await fetch(`${API_ROOT}/toolkits?sort_by=usage`, {
        headers: this.headers(), signal: AbortSignal.timeout(4_000),
      });
      await readProviderJson(response, "Composio", 500_000);
      return { configured: true, reachable: true };
    } catch (error) {
      return { configured: true, reachable: false, error: error instanceof Error ? error.message : "Composio is unreachable" };
    }
  }

  protected async executeApproved(action: BusinessAction<ComposioPayload>): Promise<unknown> {
    if (!this.config.apiKey) throw new Error("Composio API key is not configured");
    if (action.kind === "account.connect") throw new Error("Composio account connections require the signed-in owner's interactive OAuth flow");
    const toolkit = action.payload.toolkit?.trim().toLowerCase();
    const toolSlug = action.payload.toolSlug?.trim().toUpperCase();
    const userId = action.payload.userId?.trim();
    if (!toolkit || !/^[a-z0-9_]{2,80}$/.test(toolkit) || !this.config.allowedToolkits.includes(toolkit)) throw new Error("Composio toolkit is not allowlisted");
    if (!toolSlug || !/^[A-Z0-9_]{3,200}$/.test(toolSlug)) throw new Error("A valid Composio tool slug is required");
    if (!toolSlug.startsWith(`${toolkit.toUpperCase()}_`)) throw new Error("Composio tool slug does not belong to the selected toolkit");
    if (!userId || !userId.startsWith("spiritual-ai:") || userId.length > 250) throw new Error("Composio userId must be scoped to an authenticated Spiritual AI owner");
    if (!this.config.actionToolAllowlist[action.kind]?.includes(toolSlug)) {
      throw new Error(`${toolSlug} is not mapped to factory action ${action.kind}`);
    }
    const version = this.config.toolkitVersions[toolkit];
    if (!version || !/^\d{8}_\d{2}$/.test(version)) throw new Error(`A dated Composio toolkit version must be pinned for ${toolkit}`);
    if (action.payload.arguments && (Array.isArray(action.payload.arguments) || typeof action.payload.arguments !== "object")) throw new Error("Composio tool arguments must be an object");
    if (action.payload.connectedAccountId && !/^ca_[a-zA-Z0-9_-]{3,200}$/.test(action.payload.connectedAccountId)) throw new Error("A valid Composio connected account ID is required");
    const response = await fetch(`${API_ROOT}/tools/execute/${encodeURIComponent(toolSlug)}`, {
      method: "POST",
      headers: { ...this.headers(), "content-type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        version,
        ...(action.payload.connectedAccountId ? { connected_account_id: action.payload.connectedAccountId } : {}),
        arguments: action.payload.arguments || {},
      }),
      signal: AbortSignal.timeout(30_000),
    });
    return readProviderJson(response, "Composio", 5_000_000);
  }

  private headers() { return { "x-api-key": this.config.apiKey! }; }
}

function stringArray(value: string | undefined, fallback: string[]) {
  return (value || fallback.join(",")).split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
}

function jsonObject<T>(raw: string | undefined): T {
  if (!raw?.trim()) return {} as T;
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("not an object");
    return value as T;
  } catch { throw new Error("Composio allowlists and versions must be valid JSON objects"); }
}

export function composioConfigFromEnv(env: NodeJS.ProcessEnv = process.env): ComposioConfig {
  const fallback = ["gmail", "reddit", "linkedin", "instagram", "facebook", "slack", "notion", "github", "hubspot", "whatsapp", "youtube", "googlecalendar", "googledrive", "googlesheets", "stripe"];
  const rawAllowlist = jsonObject<Record<string, unknown>>(env.COMPOSIO_ACTION_TOOL_ALLOWLIST);
  const actionToolAllowlist: Partial<Record<BusinessActionKind, readonly string[]>> = {};
  for (const [action, tools] of Object.entries(rawAllowlist)) {
    if (Array.isArray(tools) && tools.every((tool) => typeof tool === "string")) {
      actionToolAllowlist[action as BusinessActionKind] = tools.map((tool) => String(tool).trim().toUpperCase());
    }
  }
  const rawVersions = jsonObject<Record<string, unknown>>(env.COMPOSIO_TOOLKIT_VERSIONS);
  const toolkitVersions = Object.fromEntries(Object.entries(rawVersions).filter(([, value]) => typeof value === "string").map(([toolkit, version]) => [toolkit.toLowerCase(), String(version)]));
  return {
    apiKey: env.COMPOSIO_API_KEY,
    allowedToolkits: stringArray(env.COMPOSIO_ALLOWED_TOOLKITS, fallback),
    actionToolAllowlist,
    toolkitVersions,
  };
}
