import { ApprovalGatedConnector, type BusinessAction } from "./actions";
import { readProviderJson, safeInteger } from "./provider-http";

export interface FirecrawlPayload extends Record<string, unknown> {
  operation?: "search" | "scrape";
  query?: string;
  url?: string;
  limit?: number;
  includeDomains?: string[];
  excludeDomains?: string[];
}

const API_ROOT = "https://api.firecrawl.dev/v2";

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 10
    || parts[0] === 127
    || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168)
    || parts[0] === 0;
}

export function assertPublicWebUrl(raw: string) {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error("Firecrawl requires a valid public URL"); }
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) throw new Error("Firecrawl accepts public HTTPS URLs without credentials only");
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal")) throw new Error("Local and private Firecrawl targets are blocked");
  const ipv6 = hostname.includes(":");
  if (hostname === "::1" || (ipv6 && (hostname.startsWith("fc") || hostname.startsWith("fd") || hostname.startsWith("fe80:"))) || isPrivateIpv4(hostname)) throw new Error("Local and private Firecrawl targets are blocked");
  if (hostname === "metadata.google.internal" || hostname === "169.254.169.254") throw new Error("Cloud metadata targets are blocked");
  return url.toString();
}

function domains(values: unknown) {
  if (!values) return undefined;
  if (!Array.isArray(values) || values.length > 10) throw new Error("Domain filters must be an array of at most 10 hostnames");
  return values.map((value) => {
    if (typeof value !== "string" || !/^[a-z0-9.-]+$/i.test(value) || value.includes("..")) throw new Error("Domain filters must contain hostnames only");
    const hostname = value.toLowerCase();
    assertPublicWebUrl(`https://${hostname}/`);
    return hostname;
  });
}

export class FirecrawlConnector extends ApprovalGatedConnector<FirecrawlPayload, unknown> {
  readonly id = "firecrawl";
  readonly supportedActions = ["research.read"] as const as Array<"research.read">;

  constructor(private readonly apiKey?: string) { super(); }

  async health() {
    return { configured: Boolean(this.apiKey), reachable: false, ...(!this.apiKey ? { error: "Firecrawl API key is not configured" } : {}) };
  }

  protected async executeApproved(action: BusinessAction<FirecrawlPayload>): Promise<unknown> {
    if (!this.apiKey) throw new Error("Firecrawl API key is not configured");
    const operation = action.payload.operation || (action.payload.url ? "scrape" : "search");
    if (operation === "search") return this.search(action.payload);
    if (operation === "scrape") return this.scrape(action.payload);
    throw new Error("Firecrawl supports search and single-page scrape only");
  }

  private async search(payload: FirecrawlPayload) {
    const query = payload.query?.trim();
    if (!query || query.length > 500) throw new Error("Firecrawl search query must contain 1 to 500 characters");
    const includeDomains = domains(payload.includeDomains);
    const excludeDomains = domains(payload.excludeDomains);
    if (includeDomains?.length && excludeDomains?.length) throw new Error("Use either includeDomains or excludeDomains, not both");
    const response = await fetch(`${API_ROOT}/search`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        query,
        limit: safeInteger(payload.limit, 5, 1, 10),
        sources: ["web"],
        ...(includeDomains?.length ? { includeDomains } : {}),
        ...(excludeDomains?.length ? { excludeDomains } : {}),
        ignoreInvalidURLs: true,
        timeout: 30_000,
        scrapeOptions: { formats: [{ type: "markdown" }], onlyMainContent: true },
      }),
      signal: AbortSignal.timeout(35_000),
    });
    return readProviderJson(response, "Firecrawl", 5_000_000);
  }

  private async scrape(payload: FirecrawlPayload) {
    if (!payload.url) throw new Error("Firecrawl scrape requires a URL");
    const response = await fetch(`${API_ROOT}/scrape`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ url: assertPublicWebUrl(payload.url), formats: [{ type: "markdown" }], onlyMainContent: true, timeout: 30_000 }),
      signal: AbortSignal.timeout(35_000),
    });
    return readProviderJson(response, "Firecrawl", 5_000_000);
  }

  private headers() {
    return { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" };
  }
}
