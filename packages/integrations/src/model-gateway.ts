import {
  ModelRequest,
  ModelResponse,
  ModelToolCall,
  ProviderConfig,
  ProviderConfigurationError,
  ProviderHealth,
  ProviderRequestError,
} from "./types";

type JsonRecord = Record<string, any>;

function safeJson(value: unknown): Record<string, unknown> {
  if (typeof value !== "string") return (value as Record<string, unknown>) || {};
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null ? parsed : { value: parsed };
  } catch {
    return { value };
  }
}

export class ModelGateway {
  private readonly providers = new Map<string, ProviderConfig>();

  constructor(configs: ProviderConfig[]) {
    for (const config of configs) this.providers.set(config.id, config);
  }

  listProviders(): Array<Omit<ProviderConfig, "apiKey"> & { configured: boolean }> {
    return [...this.providers.values()].map(({ apiKey, ...config }) => ({
      ...config,
      configured: config.enabled && (Boolean(apiKey) || config.id === "ollama" || config.id === "hermes"),
    }));
  }

  async complete(request: ModelRequest): Promise<ModelResponse> {
    const config = this.requireConfig(request.provider);
    return request.provider === "anthropic"
      ? this.completeAnthropic(config, request)
      : this.completeOpenAICompatible(config, request);
  }

  async health(provider: ModelRequest["provider"], timeoutMs = 4_000): Promise<ProviderHealth> {
    const config = this.providers.get(provider);
    if (!config || !config.enabled) return { provider, configured: false, reachable: false };
    const startedAt = Date.now();
    try {
      const headers = this.headers(config);
      const path = provider === "anthropic" ? "/models" : "/models";
      const response = await fetch(`${config.baseUrl}${path}`, {
        headers,
        signal: AbortSignal.timeout(timeoutMs),
      });
      return {
        provider,
        configured: true,
        reachable: response.ok,
        latencyMs: Date.now() - startedAt,
        error: response.ok ? undefined : `HTTP ${response.status}`,
      };
    } catch (error) {
      return {
        provider,
        configured: true,
        reachable: false,
        latencyMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : "Health check failed",
      };
    }
  }

  private requireConfig(provider: ModelRequest["provider"]): ProviderConfig {
    const config = this.providers.get(provider);
    if (!config?.enabled) throw new ProviderConfigurationError(`${provider} is not enabled`);
    if (provider !== "ollama" && provider !== "hermes" && !config.apiKey) {
      throw new ProviderConfigurationError(`${provider} requires a server-side API key`);
    }
    return config;
  }

  private headers(config: ProviderConfig): Record<string, string> {
    const base: Record<string, string> = { "content-type": "application/json", ...config.extraHeaders };
    if (config.id === "anthropic") {
      if (config.apiKey) base["x-api-key"] = config.apiKey;
      base["anthropic-version"] = "2023-06-01";
    } else if (config.apiKey) {
      base.authorization = `Bearer ${config.apiKey}`;
    }
    if (config.organizationId) base["OpenAI-Organization"] = config.organizationId;
    return base;
  }

  private async post(config: ProviderConfig, path: string, body: JsonRecord, timeoutMs: number): Promise<JsonRecord> {
    const response = await fetch(`${config.baseUrl}${path}`, {
      method: "POST",
      headers: this.headers(config),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const payload = (await response.json().catch(() => ({}))) as JsonRecord;
    if (!response.ok) {
      const message = payload?.error?.message || payload?.message || `HTTP ${response.status}`;
      throw new ProviderRequestError(String(message), config.id, response.status);
    }
    return payload;
  }

  private async completeOpenAICompatible(config: ProviderConfig, request: ModelRequest): Promise<ModelResponse> {
    const body: JsonRecord = {
      model: request.model || config.defaultModel,
      messages: request.messages.map((message) => ({
        role: message.role,
        content: message.content,
        ...(message.name ? { name: message.name } : {}),
        ...(message.toolCallId ? { tool_call_id: message.toolCallId } : {}),
      })),
      ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
      ...(request.maxTokens ? { max_tokens: request.maxTokens } : {}),
      ...(request.tools?.length
        ? {
            tools: request.tools.map((tool) => ({
              type: "function",
              function: { name: tool.name, description: tool.description, parameters: tool.inputSchema },
            })),
          }
        : {}),
    };
    const payload = await this.post(config, "/chat/completions", body, request.timeoutMs || 60_000);
    const choice = payload.choices?.[0] || {};
    const message = choice.message || {};
    const toolCalls: ModelToolCall[] = (message.tool_calls || []).map((call: JsonRecord) => ({
      id: String(call.id || ""),
      name: String(call.function?.name || ""),
      arguments: safeJson(call.function?.arguments),
    }));
    return {
      provider: request.provider,
      model: String(payload.model || request.model),
      text: typeof message.content === "string" ? message.content : "",
      toolCalls,
      usage: {
        inputTokens: payload.usage?.prompt_tokens,
        outputTokens: payload.usage?.completion_tokens,
        totalTokens: payload.usage?.total_tokens,
      },
      requestId: payload.id,
      rawFinishReason: choice.finish_reason,
    };
  }

  private async completeAnthropic(config: ProviderConfig, request: ModelRequest): Promise<ModelResponse> {
    const system = request.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const body: JsonRecord = {
      model: request.model || config.defaultModel,
      max_tokens: request.maxTokens || 4096,
      messages: request.messages
        .filter((message) => message.role !== "system")
        .map((message) => ({ role: message.role === "tool" ? "user" : message.role, content: message.content })),
      ...(system ? { system } : {}),
      ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
      ...(request.tools?.length
        ? { tools: request.tools.map((tool) => ({ name: tool.name, description: tool.description, input_schema: tool.inputSchema })) }
        : {}),
    };
    const payload = await this.post(config, "/messages", body, request.timeoutMs || 60_000);
    const blocks = Array.isArray(payload.content) ? payload.content : [];
    return {
      provider: request.provider,
      model: String(payload.model || request.model),
      text: blocks.filter((block: JsonRecord) => block.type === "text").map((block: JsonRecord) => block.text).join("\n"),
      toolCalls: blocks.filter((block: JsonRecord) => block.type === "tool_use").map((block: JsonRecord) => ({
        id: String(block.id || ""),
        name: String(block.name || ""),
        arguments: safeJson(block.input),
      })),
      usage: {
        inputTokens: payload.usage?.input_tokens,
        outputTokens: payload.usage?.output_tokens,
        totalTokens: (payload.usage?.input_tokens || 0) + (payload.usage?.output_tokens || 0),
      },
      requestId: payload.id,
      rawFinishReason: payload.stop_reason,
    };
  }
}
