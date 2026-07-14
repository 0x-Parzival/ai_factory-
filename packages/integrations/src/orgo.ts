import { ApprovalGatedConnector, type BusinessAction } from "./actions";
import { readProviderJson, safeInteger } from "./provider-http";

export interface OrgoConfig { apiKey?: string; workspaceId?: string }

export interface OrgoPayload extends Record<string, unknown> {
  operation?: "create" | "screenshot" | "click" | "type" | "key" | "bash" | "python" | "start" | "stop" | "restart";
  computerId?: string;
  name?: string;
  ram?: number;
  cpu?: number;
  x?: number;
  y?: number;
  text?: string;
  key?: string;
  command?: string;
  code?: string;
  timeout?: number;
}

const API_ROOT = "https://www.orgo.ai/api";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class OrgoConnector extends ApprovalGatedConnector<OrgoPayload, unknown> {
  readonly id = "orgo";
  readonly supportedActions = ["computer.create", "computer.read", "computer.execute"] as const as Array<"computer.create" | "computer.read" | "computer.execute">;

  constructor(private readonly config: OrgoConfig) { super(); }

  async health() {
    const configured = Boolean(this.config.apiKey && this.config.workspaceId);
    if (!configured) return { configured: false, reachable: false, error: "Orgo API key and workspace ID are not configured" };
    try {
      const response = await fetch(`${API_ROOT}/workspaces/${encodeURIComponent(this.workspace())}`, { headers: this.headers(), signal: AbortSignal.timeout(4_000) });
      await readProviderJson(response, "Orgo", 500_000);
      return { configured: true, reachable: true };
    } catch (error) {
      return { configured: true, reachable: false, error: error instanceof Error ? error.message : "Orgo is unreachable" };
    }
  }

  protected async executeApproved(action: BusinessAction<OrgoPayload>): Promise<unknown> {
    if (!this.config.apiKey) throw new Error("Orgo API key is not configured");
    const operation = action.payload.operation;
    if (action.kind === "computer.create") return this.create(action.payload);
    const computerId = action.payload.computerId?.trim();
    if (!computerId || !UUID.test(computerId)) throw new Error("A valid Orgo computer ID is required");
    if (action.kind === "computer.read") {
      if (operation !== "screenshot") throw new Error("computer.read supports screenshot only");
      return this.request(`/computers/${computerId}/screenshot`, "GET", undefined, 5_000_000);
    }
    if (action.kind !== "computer.execute") throw new Error(`Unsupported Orgo action: ${action.kind}`);
    return this.executeComputer(computerId, action.payload);
  }

  private create(payload: OrgoPayload) {
    if (payload.operation !== "create") throw new Error("computer.create requires operation=create");
    const name = payload.name?.trim();
    if (!name || !/^[a-z0-9][a-z0-9-]{2,62}$/i.test(name)) throw new Error("A valid Orgo computer name is required");
    return this.request("/computers", "POST", {
      workspace_id: this.workspace(), name, os: "linux",
      ram: [1, 2, 4].includes(Number(payload.ram)) ? Number(payload.ram) : 2,
      cpu: [1, 2].includes(Number(payload.cpu)) ? Number(payload.cpu) : 1,
      gpu: "none",
    });
  }

  private executeComputer(computerId: string, payload: OrgoPayload) {
    switch (payload.operation) {
      case "click": {
        const x = Number(payload.x); const y = Number(payload.y);
        if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x > 10_000 || y > 10_000) throw new Error("Orgo click coordinates must be integers between 0 and 10,000");
        return this.request(`/computers/${computerId}/click`, "POST", { x, y });
      }
      case "type": {
        const text = payload.text;
        if (typeof text !== "string" || !text.length || text.length > 4_000) throw new Error("Orgo type text must contain 1 to 4,000 characters");
        return this.request(`/computers/${computerId}/type`, "POST", { text, delay_ms: 12 });
      }
      case "key": {
        const key = payload.key?.trim();
        if (!key || !/^[a-z0-9_+ -]{1,60}$/i.test(key)) throw new Error("A valid Orgo key or key combination is required");
        return this.request(`/computers/${computerId}/key`, "POST", { key });
      }
      case "bash": {
        const command = payload.command?.trim();
        if (!command || command.length > 20_000) throw new Error("Orgo bash command must contain 1 to 20,000 characters");
        return this.request(`/computers/${computerId}/bash`, "POST", { command });
      }
      case "python": {
        const code = payload.code?.trim();
        if (!code || code.length > 20_000) throw new Error("Orgo Python code must contain 1 to 20,000 characters");
        return this.request(`/computers/${computerId}/exec`, "POST", { code, timeout: safeInteger(payload.timeout, 30, 1, 300) });
      }
      case "start": case "stop": case "restart":
        return this.request(`/computers/${computerId}/${payload.operation}`, "POST");
      default: throw new Error("Unsupported Orgo computer operation");
    }
  }

  private workspace() {
    const id = this.config.workspaceId?.trim();
    if (!id || !UUID.test(id)) throw new Error("A valid ORGO_WORKSPACE_ID is required");
    return id;
  }

  private async request(path: string, method: "GET" | "POST", body?: Record<string, unknown>, maxBytes = 2_000_000) {
    const response = await fetch(`${API_ROOT}${path}`, {
      method, headers: { ...this.headers(), ...(body ? { "content-type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(310_000),
    });
    return readProviderJson(response, "Orgo", maxBytes);
  }

  private headers() { return { authorization: `Bearer ${this.config.apiKey}` }; }
}

export function orgoConfigFromEnv(env: NodeJS.ProcessEnv = process.env): OrgoConfig {
  return { apiKey: env.ORGO_API_KEY, workspaceId: env.ORGO_WORKSPACE_ID };
}
