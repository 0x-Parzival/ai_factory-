import "server-only";

import { readFile } from "node:fs/promises";

import { MODEL_PROVIDERS } from "@/lib/factory-blueprints";
import { getCodexCliStatus } from "@ai-factory/integrations/codex-cli";

export type ProviderRuntimeStatus = {
  id: string;
  configured: boolean;
  reachable: boolean;
  models: string[];
  latencyMs?: number;
  detail: string;
};

export type WorkerRuntimeStatus = {
  organizationId: string;
  state: "running" | "stopping" | "stopped";
  workerPid: number;
  provider: string;
  model: string;
  deployedAgents: number;
  activeLoops: number;
  queuedTasks: number;
  completedTasks: number;
  failedTasks: number;
  pendingApprovals: number;
  lastEventAt?: string;
  updatedAt: string;
  externalActionsEnabled: boolean;
  agents?: WorkerAgentRuntimeStatus[];
  recentEvents?: WorkerAuditEvent[];
  error?: string;
};

export type WorkerAgentRuntimeStatus = {
  departmentId: string;
  departmentName: string;
  status: "idle" | "queued" | "running" | "succeeded" | "failed";
  currentTask?: string;
  lastTask?: string;
  lastRunAt?: string;
  completedTasks: number;
  failedTasks: number;
  provider: string;
  model: string;
};

export type WorkerAuditEvent = {
  id: string;
  type: string;
  actor: string;
  departmentId?: string;
  taskId?: string;
  occurredAt: string;
};

const PROVIDER_KEYS: Record<string, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  groq: "GROQ_API_KEY",
  nvidia: "NVIDIA_API_KEY",
};

async function readLocalModels(
  id: "ollama" | "hermes",
  url: string,
): Promise<ProviderRuntimeStatus> {
  const startedAt = Date.now();
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(1_500),
    });
    if (!response.ok) {
      return { id, configured: true, reachable: false, models: [], latencyMs: Date.now() - startedAt, detail: `HTTP ${response.status}` };
    }
    const payload = await response.json() as Record<string, unknown>;
    const models = id === "ollama"
      ? (Array.isArray(payload.models) ? payload.models : []).map((item) => String((item as { name?: string }).name || "")).filter(Boolean)
      : (Array.isArray(payload.data) ? payload.data : []).map((item) => String((item as { id?: string }).id || "")).filter(Boolean);
    return {
      id,
      configured: true,
      reachable: true,
      models,
      latencyMs: Date.now() - startedAt,
      detail: models.length ? `${models.length} model${models.length === 1 ? "" : "s"} discovered` : "Endpoint reachable",
    };
  } catch {
    return { id, configured: true, reachable: false, models: [], latencyMs: Date.now() - startedAt, detail: "Endpoint unreachable" };
  }
}

export async function getProviderRuntimeStatus(): Promise<ProviderRuntimeStatus[]> {
  const ollamaBase = (process.env.OLLAMA_BASE_URL || "http://localhost:11434").replace(/\/v1\/?$/, "").replace(/\/$/, "");
  const localChecks: Promise<ProviderRuntimeStatus>[] = [
    readLocalModels("ollama", `${ollamaBase}/api/tags`),
  ];
  if (process.env.HERMES_BASE_URL) {
    localChecks.push(readLocalModels("hermes", `${process.env.HERMES_BASE_URL.replace(/\/$/, "")}/models`));
  }
  const [local, codex] = await Promise.all([Promise.all(localChecks), getCodexCliStatus()]);
  const localById = new Map(local.map((status) => [status.id, status]));

  return MODEL_PROVIDERS.map((provider) => {
    if (provider.id === "codex") {
      return {
        id: provider.id,
        configured: codex.authenticated,
        reachable: codex.authenticated,
        models: [],
        detail: codex.authenticated
          ? `${codex.detail}. This local, server-side connection is separate from OpenAI API billing.`
          : `${codex.detail}. Run codex login on the trusted factory host to connect ChatGPT.`,
      };
    }
    const localStatus = localById.get(provider.id);
    if (localStatus) return localStatus;
    const keyName = PROVIDER_KEYS[provider.id];
    const configured = keyName ? Boolean(process.env[keyName]) : provider.id === "hermes" && Boolean(process.env.HERMES_BASE_URL);
    return {
      id: provider.id,
      configured,
      reachable: false,
      models: [],
      detail: configured ? "Credential configured; health check not run" : "Credentials not configured",
    };
  });
}

export async function getWorkerRuntimeStatus(): Promise<WorkerRuntimeStatus | undefined> {
  const statusFile = process.env.FACTORY_STATUS_FILE || "/tmp/spiritual-ai-factory-worker-status.json";
  try {
    const parsed = JSON.parse(await readFile(statusFile, "utf8")) as WorkerRuntimeStatus;
    const ageMs = Date.now() - new Date(parsed.updatedAt).getTime();
    if (!Number.isFinite(ageMs) || ageMs > 10_000 || parsed.state !== "running") return undefined;
    if (!Number.isInteger(parsed.workerPid) || parsed.workerPid <= 0) return undefined;
    process.kill(parsed.workerPid, 0);
    return parsed;
  } catch {
    return undefined;
  }
}
