import "server-only";

import { getProviderRuntimeStatus, type ProviderRuntimeStatus } from "@/lib/factory-runtime";

export type SiteCheck = {
  configured: boolean;
  url?: string;
  reachable: boolean;
  status?: number;
  latencyMs?: number;
  headers: Array<{ name: string; present: boolean; note: string }>;
  error?: string;
};

export type SecuritySnapshot = {
  checkedAt: string;
  site: SiteCheck;
  providers: ProviderRuntimeStatus[];
  checklist: Array<{ label: string; ok: boolean; detail: string }>;
  alertCount: number;
};

const securityHeaders = [
  ["Strict-Transport-Security", "Protects HTTPS-only transport"],
  ["Content-Security-Policy", "Limits browser resource origins"],
  ["X-Content-Type-Options", "Prevents MIME sniffing"],
  ["Referrer-Policy", "Limits referrer leakage"],
  ["Permissions-Policy", "Restricts browser capabilities"],
] as const;

function approvedUrl() {
  const raw = process.env.SECURITY_MONITOR_URL?.trim();
  if (!raw) return undefined;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "https:" ? parsed.toString() : undefined;
  } catch { return undefined; }
}

export async function getSecuritySnapshot(): Promise<SecuritySnapshot> {
  const url = approvedUrl();
  const startedAt = Date.now();
  let site: SiteCheck;
  if (!url) {
    site = { configured: false, reachable: false, headers: securityHeaders.map(([name, note]) => ({ name, present: false, note })), error: "Set SECURITY_MONITOR_URL to one approved HTTPS site." };
  } else {
    try {
      const response = await fetch(url, { cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(8_000) });
      site = {
        configured: true, url, reachable: response.ok, status: response.status, latencyMs: Date.now() - startedAt,
        headers: securityHeaders.map(([name, note]) => ({ name, present: Boolean(response.headers.get(name)), note })),
        ...(response.ok ? {} : { error: `HTTP ${response.status}` }),
      };
    } catch (error) {
      site = { configured: true, url, reachable: false, latencyMs: Date.now() - startedAt, headers: securityHeaders.map(([name, note]) => ({ name, present: false, note })), error: error instanceof Error ? error.message : "Site check failed" };
    }
  }
  const providers = await getProviderRuntimeStatus();
  const configured = providers.filter((provider) => provider.configured);
  const checklist = [
    { label: "Approved HTTPS target", ok: site.configured, detail: site.configured ? "Target is configured" : "No approved target configured" },
    { label: "Website availability", ok: site.reachable, detail: site.reachable ? `HTTP ${site.status} in ${site.latencyMs} ms` : site.error || "Unavailable" },
    { label: "Security response headers", ok: site.headers.every((header) => header.present), detail: `${site.headers.filter((header) => header.present).length}/${site.headers.length} observed` },
    { label: "AI providers", ok: configured.length === 0 || configured.some((provider) => provider.reachable), detail: configured.length ? `${configured.filter((provider) => provider.reachable).length}/${configured.length} configured provider endpoints reachable` : "No provider credentials configured" },
    { label: "Codex / Hermes advisory routes", ok: providers.some((provider) => (provider.id === "codex" || provider.id === "hermes") && provider.reachable), detail: "At least one trusted-host route is required only when advisory automation is enabled" },
  ];
  return { checkedAt: new Date().toISOString(), site, providers, checklist, alertCount: checklist.filter((item) => !item.ok).length };
}
