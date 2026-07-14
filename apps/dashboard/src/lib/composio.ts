import "server-only";

export const COMPOSIO_TOOLKITS = [
  { slug: "gmail", name: "Gmail", purpose: "Customer care and consent-aware email workflows", risk: "Every send remains recipient-scoped and approval-gated" },
  { slug: "reddit", name: "Reddit", purpose: "Research communities and publish approved useful posts", risk: "No mass DMs, vote manipulation, or cross-subreddit spam" },
  { slug: "linkedin", name: "LinkedIn", purpose: "Company content and eligible partner workflows", risk: "Only approved API capabilities and recipient-specific messaging" },
  { slug: "instagram", name: "Instagram", purpose: "Publish company content and handle eligible conversations", risk: "Cold automated DMs remain blocked" },
  { slug: "facebook", name: "Facebook", purpose: "Page publishing and eligible inbox conversations", risk: "Messaging windows and consent rules apply" },
  { slug: "whatsapp", name: "WhatsApp", purpose: "Opt-in sales and customer conversations", risk: "Consent evidence and approved templates are required" },
  { slug: "youtube", name: "YouTube", purpose: "Video operations and performance data", risk: "Publishing requires owner approval" },
  { slug: "slack", name: "Slack", purpose: "Internal alerts and team coordination", risk: "External messages require approval" },
  { slug: "notion", name: "Notion", purpose: "Company knowledge and operating plans", risk: "Destructive changes are not allowlisted by default" },
  { slug: "github", name: "GitHub", purpose: "Product delivery and engineering", risk: "Merge, release, and deletion require approval" },
  { slug: "hubspot", name: "HubSpot", purpose: "Lead and customer records", risk: "Outbound actions require separate approval" },
  { slug: "googlecalendar", name: "Google Calendar", purpose: "Meetings and follow-up scheduling", risk: "Creating or changing events requires approval" },
  { slug: "googlesheets", name: "Google Sheets", purpose: "Pipeline and operating data", risk: "Writes are audited and action-scoped" },
  { slug: "googledrive", name: "Google Drive", purpose: "Approved company documents and assets", risk: "Sharing and deletion are not enabled by default" },
  { slug: "stripe", name: "Stripe", purpose: "Revenue and customer payment visibility", risk: "Money movement is critical and requires approval" },
] as const;

export type ComposioToolkitSlug = (typeof COMPOSIO_TOOLKITS)[number]["slug"];
const V3 = "https://backend.composio.dev/api/v3";
const V31 = "https://backend.composio.dev/api/v3.1";

export function isComposioConfigured() { return Boolean(process.env.COMPOSIO_API_KEY?.trim()); }
export function isAllowedComposioToolkit(value: string): value is ComposioToolkitSlug {
  const configured = (process.env.COMPOSIO_ALLOWED_TOOLKITS || COMPOSIO_TOOLKITS.map((item) => item.slug).join(","))
    .split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  return configured.includes(value) && COMPOSIO_TOOLKITS.some((item) => item.slug === value);
}
export function composioUserId(clerkUserId: string) { return `spiritual-ai:${clerkUserId}`.slice(0, 250); }

async function request(path: string, init?: RequestInit, v31 = false) {
  if (!isComposioConfigured()) throw new Error("Composio is not configured");
  const response = await fetch(`${v31 ? V31 : V3}${path}`, {
    ...init,
    headers: { "x-api-key": process.env.COMPOSIO_API_KEY!, ...(init?.body ? { "content-type": "application/json" } : {}), ...init?.headers },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    const nested = payload.error && typeof payload.error === "object" ? payload.error as Record<string, unknown> : undefined;
    throw new Error(String(nested?.message || payload.message || `Composio HTTP ${response.status}`));
  }
  return payload;
}

export async function createComposioConnectLink(userId: string, toolkit: ComposioToolkitSlug, callbackUrl: string) {
  const session = await request("/tool_router/session", {
    method: "POST",
    body: JSON.stringify({
      user_id: composioUserId(userId),
      toolkits: { enabled: [toolkit] },
      manage_connections: { enable: true, enable_wait_for_connections: false, enable_connection_removal: true },
      workbench: { enable: false, enable_proxy_execution: false },
    }),
  });
  const sessionId = typeof session.session_id === "string" ? session.session_id : undefined;
  if (!sessionId || !/^trs_[a-zA-Z0-9_-]+$/.test(sessionId)) throw new Error("Composio did not return a valid session");
  const link = await request(`/tool_router/session/${encodeURIComponent(sessionId)}/link`, {
    method: "POST", body: JSON.stringify({ toolkit, callback_url: callbackUrl }),
  });
  const redirectUrl = typeof link.redirect_url === "string" ? link.redirect_url : undefined;
  if (!redirectUrl) throw new Error("Composio did not return a connection URL");
  const parsed = new URL(redirectUrl);
  if (parsed.protocol !== "https:" || !(parsed.hostname === "composio.dev" || parsed.hostname.endsWith(".composio.dev"))) throw new Error("Composio returned an untrusted connection URL");
  return { url: parsed.toString(), connectedAccountId: link.connected_account_id };
}

export async function listComposioAccounts(userId: string) {
  const query = new URLSearchParams({ user_ids: composioUserId(userId), limit: "100", account_type: "PRIVATE" });
  const payload = await request(`/connected_accounts?${query}`, undefined, true);
  const items = Array.isArray(payload.items) ? payload.items as Array<Record<string, unknown>> : [];
  return items.map((item) => {
    const toolkit = item.toolkit && typeof item.toolkit === "object" ? item.toolkit as Record<string, unknown> : {};
    const slug = String(toolkit.slug || "unknown").toLowerCase();
    const data = item.data && typeof item.data === "object" ? item.data as Record<string, unknown> : {};
    const status = String(item.status || "UNKNOWN");
    return {
      id: String(item.id || item.nanoid || "unknown"),
      name: String(data.email || data.name || `${slug} account`),
      app: slug,
      appName: COMPOSIO_TOOLKITS.find((candidate) => candidate.slug === slug)?.name || slug,
      healthy: status === "ACTIVE" && item.is_disabled !== true,
      scopes: [] as string[],
    };
  });
}

export function dashboardOrigin() {
  const fallback = "http://localhost:3001";
  try {
    const url = new URL(process.env.NEXT_PUBLIC_APP_URL || fallback);
    if (url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname))) return url.origin;
  } catch { /* use local fallback */ }
  return fallback;
}
