import type { ModelProviderId, ProviderConfig } from "./types";

const DEFAULT_ENDPOINTS: Record<ModelProviderId, string> = {
  openai: "https://api.openai.com/v1",
  codex: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
  groq: "https://api.groq.com/openai/v1",
  nvidia: "https://integrate.api.nvidia.com/v1",
  ollama: "http://localhost:11434/v1",
  hermes: "http://localhost:8080/v1",
};

const ENV_PREFIX: Record<ModelProviderId, string> = {
  openai: "OPENAI",
  codex: "OPENAI",
  anthropic: "ANTHROPIC",
  openrouter: "OPENROUTER",
  groq: "GROQ",
  nvidia: "NVIDIA",
  ollama: "OLLAMA",
  hermes: "HERMES",
};

export function providerConfigFromEnv(
  id: ModelProviderId,
  env: NodeJS.ProcessEnv = process.env,
): ProviderConfig {
  const prefix = ENV_PREFIX[id];
  const apiKey = env[`${prefix}_API_KEY`];
  const baseUrl = (env[`${prefix}_BASE_URL`] || DEFAULT_ENDPOINTS[id]).replace(/\/$/, "");
  const localProvider = id === "ollama" || id === "hermes";

  return {
    id,
    apiKey,
    baseUrl,
    defaultModel: env[`${prefix}_MODEL`],
    enabled: env[`${prefix}_ENABLED`] === "true" || (localProvider ? Boolean(baseUrl) : Boolean(apiKey)),
    organizationId: id === "openai" || id === "codex" ? env.OPENAI_ORGANIZATION_ID : undefined,
  };
}

export function allProviderConfigs(env: NodeJS.ProcessEnv = process.env): ProviderConfig[] {
  return (Object.keys(DEFAULT_ENDPOINTS) as ModelProviderId[]).map((id) =>
    providerConfigFromEnv(id, env),
  );
}
