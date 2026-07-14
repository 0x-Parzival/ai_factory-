import "server-only";

export type OpenOutreachStatus = {
  configured: boolean;
  reachable: boolean;
  externalSendsEnabled: boolean;
  senderIdentityComplete: boolean;
  mailboxes: number;
  pendingApprovals: number;
  humanReviews: number;
  readyLeads: number;
  suppressedRecipients: number;
  sentToday: number;
  error?: string;
};

function baseUrl() {
  const raw = process.env.OPENOUTREACH_BASE_URL;
  if (!raw) return;
  const url = new URL(raw);
  const local = url.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !local) return;
  return url.origin;
}

export async function getOpenOutreachStatus(): Promise<OpenOutreachStatus> {
  const url = baseUrl();
  const token = process.env.OPENOUTREACH_FACTORY_TOKEN;
  if (!url || !token) {
    return { configured: false, reachable: false, externalSendsEnabled: false, senderIdentityComplete: false, mailboxes: 0, pendingApprovals: 0, humanReviews: 0, readyLeads: 0, suppressedRecipients: 0, sentToday: 0 };
  }
  try {
    const response = await fetch(`${url}/api/spiritualai/status`, {
      cache: "no-store",
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(2_500),
    });
    const payload = await response.json().catch(() => ({})) as Partial<OpenOutreachStatus> & { error?: string };
    if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
    return {
      configured: true,
      reachable: true,
      externalSendsEnabled: payload.externalSendsEnabled === true,
      senderIdentityComplete: payload.senderIdentityComplete === true,
      mailboxes: Number(payload.mailboxes || 0),
      pendingApprovals: Number(payload.pendingApprovals || 0),
      humanReviews: Number(payload.humanReviews || 0),
      readyLeads: Number(payload.readyLeads || 0),
      suppressedRecipients: Number(payload.suppressedRecipients || 0),
      sentToday: Number(payload.sentToday || 0),
    };
  } catch (error) {
    return { configured: true, reachable: false, externalSendsEnabled: false, senderIdentityComplete: false, mailboxes: 0, pendingApprovals: 0, humanReviews: 0, readyLeads: 0, suppressedRecipients: 0, sentToday: 0, error: error instanceof Error ? error.message : "Service unreachable" };
  }
}
