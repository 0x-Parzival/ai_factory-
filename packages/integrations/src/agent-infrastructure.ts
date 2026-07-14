import type { ActionConnector } from "./actions";
import { AgentMailConnector, agentMailConfigFromEnv } from "./agentmail";
import { ComposioConnector, composioConfigFromEnv } from "./composio";
import { E2BConnector, e2bConfigFromEnv } from "./e2b";
import { FirecrawlConnector } from "./firecrawl";
import { OrgoConnector, orgoConfigFromEnv } from "./orgo";

export type AgentInfrastructureProvider = "agentmail" | "composio" | "orgo" | "firecrawl" | "e2b";
type InfrastructureConnector = ActionConnector<any, unknown>;

export class AgentInfrastructure {
  private readonly connectors: ReadonlyMap<AgentInfrastructureProvider, InfrastructureConnector>;

  constructor(entries: readonly [AgentInfrastructureProvider, InfrastructureConnector][]) {
    this.connectors = new Map(entries);
  }

  get(provider: AgentInfrastructureProvider) {
    const connector = this.connectors.get(provider);
    if (!connector) throw new Error(`Agent infrastructure provider ${provider} is not registered`);
    return connector;
  }

  async health() {
    const results = await Promise.all([...this.connectors.entries()].map(async ([provider, connector]) => {
      try { return [provider, await connector.health()] as const; }
      catch (error) { return [provider, { configured: false, reachable: false, error: error instanceof Error ? error.message : "Health check failed" }] as const; }
    }));
    return Object.fromEntries(results) as Record<AgentInfrastructureProvider, { configured: boolean; reachable: boolean; error?: string }>;
  }
}

export function agentInfrastructureFromEnv(env: NodeJS.ProcessEnv = process.env) {
  return new AgentInfrastructure([
    ["agentmail", new AgentMailConnector(agentMailConfigFromEnv(env))],
    ["composio", new ComposioConnector(composioConfigFromEnv(env))],
    ["orgo", new OrgoConnector(orgoConfigFromEnv(env))],
    ["firecrawl", new FirecrawlConnector(env.FIRECRAWL_API_KEY)],
    ["e2b", new E2BConnector(e2bConfigFromEnv(env))],
  ]);
}
