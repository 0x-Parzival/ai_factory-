import { ApprovalGatedConnector, type BusinessAction } from "./actions";
import { safeInteger } from "./provider-http";

export interface E2BConfig { apiKey?: string; template?: string }
export interface E2BPayload extends Record<string, unknown> { command?: string; timeoutMs?: number }

export interface E2BSandboxLike {
  sandboxId: string;
  commands: { run(command: string, options?: { timeoutMs?: number }): Promise<{ stdout?: string; stderr?: string; exitCode?: number }> };
  kill(): Promise<void>;
}

export type E2BSandboxFactory = (config: E2BConfig, timeoutMs: number) => Promise<E2BSandboxLike>;

async function createSandbox(config: E2BConfig, timeoutMs: number): Promise<E2BSandboxLike> {
  const { Sandbox } = await import("e2b");
  return Sandbox.create({ apiKey: config.apiKey, timeoutMs, ...(config.template ? { template: config.template } : {}) }) as unknown as Promise<E2BSandboxLike>;
}

export class E2BConnector extends ApprovalGatedConnector<E2BPayload, unknown> {
  readonly id = "e2b";
  readonly supportedActions = ["code.execute"] as const as Array<"code.execute">;

  constructor(private readonly config: E2BConfig, private readonly sandboxFactory: E2BSandboxFactory = createSandbox) { super(); }

  async health() {
    return { configured: Boolean(this.config.apiKey), reachable: false, ...(!this.config.apiKey ? { error: "E2B API key is not configured" } : {}) };
  }

  protected async executeApproved(action: BusinessAction<E2BPayload>): Promise<unknown> {
    if (!this.config.apiKey) throw new Error("E2B API key is not configured");
    const command = action.payload.command?.trim();
    if (!command || command.length > 20_000) throw new Error("E2B command must contain 1 to 20,000 characters");
    const timeoutMs = safeInteger(action.payload.timeoutMs, 60_000, 1_000, 300_000);
    const sandbox = await this.sandboxFactory(this.config, timeoutMs + 10_000);
    try {
      const result = await sandbox.commands.run(command, { timeoutMs });
      return {
        sandboxId: sandbox.sandboxId,
        stdout: String(result.stdout || "").slice(0, 1_000_000),
        stderr: String(result.stderr || "").slice(0, 250_000),
        exitCode: result.exitCode,
        ephemeral: true,
      };
    } finally {
      await sandbox.kill().catch(() => undefined);
    }
  }
}

export function e2bConfigFromEnv(env: NodeJS.ProcessEnv = process.env): E2BConfig {
  return { apiKey: env.E2B_API_KEY, template: env.E2B_TEMPLATE };
}
