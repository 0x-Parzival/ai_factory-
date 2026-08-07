import "server-only";

export type SecurityToolFinding = { source: string; severity: "info" | "low" | "medium" | "high" | "critical"; title: string; detail: string; url?: string };
export type SecurityConnectorStatus = { id: string; name: string; configured: boolean; reachable: boolean; detail: string; findings: SecurityToolFinding[] };

const timeout = 8_000;
const fetchJson = async (url: string, init?: RequestInit) => {
  const response = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(timeout) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return payload as Record<string, unknown>;
};
const severity = (value: unknown): SecurityToolFinding["severity"] => {
  const normalized = String(value || "info").toLowerCase();
  return ["low", "medium", "high", "critical"].includes(normalized) ? normalized as SecurityToolFinding["severity"] : "info";
};
const unavailable = (id: string, name: string, configured: boolean, error?: unknown): SecurityConnectorStatus => ({ id, name, configured, reachable: false, detail: configured ? (error instanceof Error ? error.message : "Connector unavailable") : "Not configured", findings: [] });

async function cloudflare(): Promise<SecurityConnectorStatus> {
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim(); const zoneTag = process.env.CLOUDFLARE_ZONE_ID?.trim();
  if (!token || !zoneTag) return unavailable("cloudflare", "Cloudflare WAF", false);
  try {
    const since = new Date(Date.now() - 60 * 60_000).toISOString();
    const payload = await fetchJson("https://api.cloudflare.com/client/v4/graphql", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ query: "query ($zoneTag: string!, $since: Time!) { viewer { zones(filter: {zoneTag: $zoneTag}) { firewallEventsAdaptive(filter: {datetime_geq: $since}, limit: 20, orderBy: [datetime_DESC]) { action clientRequestPath ruleId source datetime } } } }", variables: { zoneTag, since } }) });
    const events = (((payload.data as Record<string, unknown>)?.viewer as Record<string, unknown>)?.zones as Array<Record<string, unknown>>)?.[0]?.firewallEventsAdaptive as Array<Record<string, unknown>> || [];
    return { id: "cloudflare", name: "Cloudflare WAF", configured: true, reachable: true, detail: `${events.length} recent security events`, findings: events.map((event) => ({ source: "Cloudflare", severity: ["block", "managed_challenge", "js_challenge"].includes(String(event.action)) ? "medium" : "info", title: `${event.action || "security"} · ${event.source || "WAF"}`, detail: `Path: ${event.clientRequestPath || "redacted"}; rule: ${event.ruleId || "n/a"}` })) };
  } catch (error) { return unavailable("cloudflare", "Cloudflare WAF", true, error); }
}

async function github(): Promise<SecurityConnectorStatus> {
  const token = process.env.GITHUB_SECURITY_TOKEN?.trim(); const repo = process.env.GITHUB_SECURITY_REPOSITORY?.trim();
  if (!token || !repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) return unavailable("github", "GitHub Security", false);
  try {
    const headers = { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "x-github-api-version": "2026-03-10" };
    const base = `https://api.github.com/repos/${repo}`;
    const [dependabot, code, secrets] = await Promise.all(["dependabot/alerts", "code-scanning/alerts", "secret-scanning/alerts"].map((path) => fetchJson(`${base}/${path}?state=open&per_page=20`, { headers }).catch(() => [])));
    const findings: SecurityToolFinding[] = [];
    for (const alert of [...(Array.isArray(dependabot) ? dependabot : []), ...(Array.isArray(code) ? code : []), ...(Array.isArray(secrets) ? secrets : [])] as Array<Record<string, unknown>>) {
      const advisory = alert.security_advisory as Record<string, unknown> | undefined; const rule = alert.rule as Record<string, unknown> | undefined;
      findings.push({ source: "GitHub", severity: severity(alert.security_vulnerability ? (alert.security_vulnerability as Record<string, unknown>).severity : rule?.security_severity_level || advisory?.severity), title: String(advisory?.summary || rule?.description || alert.secret_type_display_name || "Open security alert"), detail: `Repository: ${repo}; alert #${alert.number || "n/a"}`, url: typeof alert.html_url === "string" ? alert.html_url : undefined });
    }
    return { id: "github", name: "GitHub Security", configured: true, reachable: true, detail: `${findings.length} open alerts (secret values excluded)`, findings };
  } catch (error) { return unavailable("github", "GitHub Security", true, error); }
}

async function sentry(): Promise<SecurityConnectorStatus> {
  const token = process.env.SENTRY_AUTH_TOKEN?.trim(); const org = process.env.SENTRY_ORG?.trim(); const project = process.env.SENTRY_PROJECT?.trim();
  if (!token || !org || !project) return unavailable("sentry", "Sentry", false);
  try { const issues = await fetchJson(`https://sentry.io/api/0/projects/${encodeURIComponent(org)}/${encodeURIComponent(project)}/issues/?query=is:unresolved&limit=20`, { headers: { authorization: `Bearer ${token}` } }) as unknown as Array<Record<string, unknown>>;
    return { id: "sentry", name: "Sentry", configured: true, reachable: true, detail: `${issues.length} unresolved production issues`, findings: issues.map((issue) => ({ source: "Sentry", severity: "medium", title: String(issue.title || "Unresolved application issue"), detail: `${issue.count || 0} events; last seen ${issue.lastSeen || "unknown"}`, url: typeof issue.permalink === "string" ? issue.permalink : undefined })) };
  } catch (error) { return unavailable("sentry", "Sentry", true, error); }
}

async function snyk(): Promise<SecurityConnectorStatus> {
  const token = process.env.SNYK_API_TOKEN?.trim(); const org = process.env.SNYK_ORG_ID?.trim();
  if (!token || !org) return unavailable("snyk", "Snyk", false);
  try { const payload = await fetchJson(`https://api.snyk.io/rest/orgs/${encodeURIComponent(org)}/issues?version=2025-11-05&limit=20`, { headers: { authorization: `Token ${token}` } }); const data = Array.isArray(payload.data) ? payload.data as Array<Record<string, unknown>> : [];
    return { id: "snyk", name: "Snyk", configured: true, reachable: true, detail: `${data.length} reported issues`, findings: data.map((issue) => { const attributes = issue.attributes as Record<string, unknown> || {}; return { source: "Snyk", severity: severity(attributes.effective_severity_level || attributes.severity), title: String(attributes.title || "Security finding"), detail: String(attributes.description || "Review in Snyk").slice(0, 500) }; }) };
  } catch (error) { return unavailable("snyk", "Snyk", true, error); }
}

async function zap(): Promise<SecurityConnectorStatus> {
  const base = process.env.ZAP_API_URL?.trim(); if (!base || !/^https?:\/\/(127\.0\.0\.1|localhost)(?::\d+)?\/?$/.test(base)) return unavailable("zap", "OWASP ZAP", false);
  try { const key = process.env.ZAP_API_KEY?.trim(); const query = key ? `?apikey=${encodeURIComponent(key)}` : ""; const payload = await fetchJson(`${base.replace(/\/$/, "")}/JSON/core/view/alerts/${query}`); const alerts = Array.isArray(payload.alerts) ? payload.alerts as Array<Record<string, unknown>> : [];
    return { id: "zap", name: "OWASP ZAP", configured: true, reachable: true, detail: `${alerts.length} local DAST alerts`, findings: alerts.slice(0, 20).map((alert) => ({ source: "OWASP ZAP", severity: severity(alert.risk), title: String(alert.alert || "DAST finding"), detail: `Approved target: ${String(alert.url || "redacted").slice(0, 240)}` })) };
  } catch (error) { return unavailable("zap", "OWASP ZAP", true, error); }
}

export async function getSecurityConnectorStatus() { return Promise.all([cloudflare(), github(), sentry(), snyk(), zap()]); }
export async function getSecurityEvidence() { const connectors = await getSecurityConnectorStatus(); return connectors.flatMap((connector) => connector.findings).slice(0, 60); }
