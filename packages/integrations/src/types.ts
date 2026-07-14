export type ModelProviderId =
  | "openai"
  | "codex"
  | "anthropic"
  | "openrouter"
  | "groq"
  | "nvidia"
  | "ollama"
  | "hermes";

export type ModelRole = "system" | "user" | "assistant" | "tool";

export interface ModelMessage {
  role: ModelRole;
  content: string;
  name?: string;
  toolCallId?: string;
}

export interface ModelTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ModelRequest {
  provider: ModelProviderId;
  model: string;
  messages: ModelMessage[];
  tools?: ModelTool[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  metadata?: Record<string, string>;
}

export interface ModelToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ModelUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface ModelResponse {
  provider: ModelProviderId;
  model: string;
  text: string;
  toolCalls: ModelToolCall[];
  usage: ModelUsage;
  requestId?: string;
  rawFinishReason?: string;
}

export interface ProviderConfig {
  id: ModelProviderId;
  apiKey?: string;
  baseUrl: string;
  defaultModel?: string;
  enabled: boolean;
  organizationId?: string;
  extraHeaders?: Record<string, string>;
}

export interface ProviderHealth {
  provider: ModelProviderId;
  configured: boolean;
  reachable: boolean;
  latencyMs?: number;
  error?: string;
}

export class ProviderConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderConfigurationError";
  }
}

export class ProviderRequestError extends Error {
  constructor(
    message: string,
    readonly provider: ModelProviderId,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ProviderRequestError";
  }
}
