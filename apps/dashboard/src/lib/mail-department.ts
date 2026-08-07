import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { neonReadonlyStatus, readNeonTable } from "@/lib/neon-readonly";

export type MailDirection = "sent" | "received";
export type MailStatus = "queued" | "sent" | "failed" | "received";
export type MailLog = { id: string; direction: MailDirection; status: MailStatus; recipient: string; subject: string; event: string; preview: string; occurredAt: string; providerId?: string; error?: string };
export type MailCandidate = { id: string; email: string; name?: string; event: "recommendation" | "trial_ready" | "trial_ended" | "purchase_started" | "product_ready" | "subscription_review"; product?: string; accessUrl?: string; reason: string };

const mailFile = join(process.cwd(), ".factory-secrets", "mail-history.json");

function encryptionKey() {
  const secret = process.env.FACTORY_ENCRYPTION_KEY?.trim();
  if (!secret) throw new Error("Set FACTORY_ENCRYPTION_KEY before storing mail history.");
  return createHash("sha256").update(secret).digest();
}

async function history(): Promise<MailLog[]> {
  try {
    const stored = JSON.parse(await readFile(mailFile, "utf8")) as { iv: string; tag: string; value: string };
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(stored.iv, "base64"));
    decipher.setAuthTag(Buffer.from(stored.tag, "base64"));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(stored.value, "base64")), decipher.final()]).toString("utf8")) as MailLog[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function save(logs: MailLog[]) {
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(logs.slice(0, 1_000)), "utf8"), cipher.final()]);
  await mkdir(dirname(mailFile), { recursive: true, mode: 0o700 });
  await writeFile(mailFile, JSON.stringify({ iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), value: encrypted.toString("base64") }), { mode: 0o600 });
}

export async function mailLogs() { return (await history()).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)); }
export async function addMailLog(log: MailLog) { const logs = await history(); logs.unshift(log); await save(logs); }

const eventCopy: Record<MailCandidate["event"], { subject: (c: MailCandidate) => string; body: (c: MailCandidate) => string }> = {
  recommendation: { subject: (c) => `${c.name ? `${c.name}, ` : ""}your personalized next step is ready`, body: (c) => `Based on the report you generated, ${c.product || "your recommended product"} is the best next step. It is tailored to help you put your insights into practice. View it here: ${c.accessUrl || process.env.MAIL_PRODUCT_URL || "your Spiritual AI dashboard"}.` },
  trial_ready: { subject: () => "Your product is ready to access", body: (c) => `Your one-day trial product is ready. You can access it here: ${c.accessUrl || process.env.MAIL_PRODUCT_URL || "your Spiritual AI dashboard"}. Your trial access is active for one day.` },
  trial_ended: { subject: () => "Your trial has ended — keep your access", body: (c) => `Your one-day trial has ended. Purchase ${c.product || "your product"} to restore and keep access: ${c.accessUrl || process.env.MAIL_PRODUCT_URL || "your Spiritual AI dashboard"}.` },
  purchase_started: { subject: () => "Your product is being prepared", body: (c) => `Thank you for your purchase. We are now generating ${c.product || "your personalized product"}. We will email you as soon as it is ready.` },
  product_ready: { subject: () => "Your product is ready", body: (c) => `Your ${c.product || "personalized product"} is ready. Access it here: ${c.accessUrl || process.env.MAIL_PRODUCT_URL || "your Spiritual AI dashboard"}.` },
  subscription_review: { subject: () => "How was your experience?", body: (c) => `Your subscription has ended. We would value a short review of ${c.product || "your experience"}; it helps us improve for you and others.` },
};

export function draftFor(candidate: MailCandidate) { const copy = eventCopy[candidate.event]; return { subject: copy.subject(candidate), body: `Hi${candidate.name ? ` ${candidate.name}` : ""},\n\n${copy.body(candidate)}\n\nWarmly,\nSpiritual AI` }; }

export async function sendLifecycleMail(candidate: MailCandidate) {
  const draft = draftFor(candidate); const logs = await history();
  if (logs.some((log) => log.direction === "sent" && log.status === "sent" && log.event === candidate.id)) return { skipped: true, log: logs.find((log) => log.event === candidate.id)! };
  const base = process.env.RESEND_API_KEY ? "https://api.resend.com/emails" : undefined;
  if (!base || !process.env.MAIL_FROM_ADDRESS) throw new Error("Connect Resend by setting RESEND_API_KEY and MAIL_FROM_ADDRESS before sending.");
  const response = await fetch(base, { method: "POST", headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" }, body: JSON.stringify({ from: process.env.MAIL_FROM_ADDRESS, to: [candidate.email], subject: draft.subject, text: draft.body }), signal: AbortSignal.timeout(15_000) });
  const payload = await response.json().catch(() => ({})) as { id?: string; message?: string };
  const log: MailLog = { id: randomUUID(), direction: "sent", status: response.ok ? "sent" : "failed", recipient: candidate.email, subject: draft.subject, event: candidate.id, preview: draft.body.slice(0, 240), occurredAt: new Date().toISOString(), providerId: payload.id, error: response.ok ? undefined : payload.message || `Email provider HTTP ${response.status}` };
  await addMailLog(log); if (!response.ok) throw new Error(log.error || "Email provider rejected the message."); return { skipped: false, log };
}

export function inboundLog(input: { from: string; subject?: string; text?: string; providerId?: string }): MailLog {
  return { id: randomUUID(), direction: "received", status: "received", recipient: input.from, subject: input.subject || "(no subject)", event: "inbound", preview: (input.text || "").slice(0, 240), occurredAt: new Date().toISOString(), providerId: input.providerId };
}

const value = (row: Record<string, unknown>, names: string[]) => {
  const key = Object.keys(row).find((candidate) => names.includes(candidate.toLowerCase()));
  return key && row[key] != null ? String(row[key]) : undefined;
};
const isEmail = (input?: string) => Boolean(input && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input));
const date = (input?: string) => input ? new Date(input) : undefined;

export async function lifecycleCandidates(): Promise<{ connected: boolean; candidates: MailCandidate[]; detail?: string }> {
  const status = await neonReadonlyStatus();
  if (!status.connected) return { connected: false, candidates: [], detail: "Connect the approved Neon database to read lifecycle signals." };
  const tables = status.tables.filter((table) => /(order|purchase|payment|trial|subscription|report|reading|blueprint|product)/i.test(table.name)).slice(0, 25);
  const candidates: MailCandidate[] = []; const paidEmails = new Set<string>(); const now = new Date();
  const data = await Promise.all(tables.map(async (table) => ({ table: table.name.toLowerCase(), rows: (await readNeonTable(table.schema, table.name, 100)).rows })));
  for (const item of data) for (const row of item.rows) {
    const email = value(row, ["email", "customer_email", "user_email", "buyer_email"]); if (!isEmail(email)) continue;
    const name = value(row, ["name", "first_name", "customer_name", "user_name"]); const product = value(row, ["product_name", "product", "plan_name", "title", "name"]);
    const accessUrl = value(row, ["access_url", "product_url", "download_url", "url"]); const state = (value(row, ["status", "state", "payment_status"]) || "").toLowerCase();
    if (/(order|purchase|payment)/.test(item.table) && /(paid|captured|complete|success)/.test(state)) paidEmails.add(email!.toLowerCase());
    const end = date(value(row, ["trial_ends_at", "trial_end", "ends_at", "expires_at", "subscription_ends_at", "end_date"]));
    if (/trial/.test(item.table) && end) candidates.push({ id: `trial:${email}:${end.toISOString()}`, email: email!, name, product, accessUrl, event: end > now ? "trial_ready" : "trial_ended", reason: end > now ? "One-day trial is active; product access is ready." : "Trial end time has passed." });
    else if (/subscription/.test(item.table) && end && end <= now) candidates.push({ id: `subscription-review:${email}:${end.toISOString()}`, email: email!, name, product, accessUrl, event: "subscription_review", reason: "Subscription end time has passed." });
    else if (/(order|purchase|payment)/.test(item.table) && /(paid|captured|complete|success)/.test(state)) candidates.push({ id: `purchase:${email}:${value(row, ["id", "order_id", "payment_id"]) || product || "order"}`, email: email!, name, product, accessUrl, event: /(ready|delivered|generated)/.test(state) || Boolean(accessUrl) ? "product_ready" : "purchase_started", reason: "Verified completed purchase." });
    else if (/(report|reading|blueprint)/.test(item.table) && /(ready|complete|generated|done)/.test(state || "ready")) candidates.push({ id: `recommendation:${email}:${value(row, ["id", "report_id", "reading_id"]) || product || "report"}`, email: email!, name, product, accessUrl, event: "recommendation", reason: "Report was generated and no matching completed purchase is currently visible." });
  }
  const unique = new Map<string, MailCandidate>(); for (const candidate of candidates) { if (candidate.event === "recommendation" && paidEmails.has(candidate.email.toLowerCase())) continue; unique.set(candidate.id, candidate); }
  return { connected: true, candidates: [...unique.values()].slice(0, 100), detail: `Read ${tables.length} approved product-lifecycle tables.` };
}
