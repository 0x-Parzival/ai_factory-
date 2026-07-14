import "server-only";

import { PipedreamClient } from "@pipedream/sdk";

export const PIPEDREAM_APPS = [
  { slug: "gmail", name: "Gmail", purpose: "Consent-aware outreach and customer care", risk: "Send requires approval" },
  { slug: "whatsapp_business", name: "WhatsApp Business", purpose: "Opt-in sales follow-up and customer conversations", risk: "Opt-in evidence, approved templates, and send approval required" },
  { slug: "telegram_bot_api", name: "Telegram Bot", purpose: "Inbound conversations and owner escalation", risk: "Bots can reply only after a user starts the conversation" },
  { slug: "discord_bot", name: "Discord Bot", purpose: "Community conversations where the bot is installed", risk: "Unsolicited promotional DMs are blocked" },
  { slug: "twilio", name: "Twilio", purpose: "Consented SMS and voice follow-up", risk: "Consent evidence and send or call approval required" },
  { slug: "google_calendar", name: "Google Calendar", purpose: "Meetings, deadlines, and follow-up", risk: "Creating events requires approval" },
  { slug: "google_sheets", name: "Google Sheets", purpose: "Pipeline, finance, and operating data", risk: "Writes are audited" },
  { slug: "google_drive", name: "Google Drive", purpose: "Company documents and approved assets", risk: "Sharing and deletion require approval" },
  { slug: "linkedin", name: "LinkedIn", purpose: "Find partners and publish company content", risk: "Messaging needs approved access plus recipient-specific human approval" },
  { slug: "instagram_business", name: "Instagram for Business", purpose: "Operate content and reply to eligible inbox conversations", risk: "Cold bot DMs are not supported; replies and publishing are governed" },
  { slug: "facebook_pages", name: "Facebook Pages & Messenger", purpose: "Page content and eligible inbox conversations", risk: "Standard messaging window and recipient consent rules apply" },
  { slug: "twitter", name: "X / Twitter", purpose: "Research, public distribution, and eligible DMs", risk: "Unsolicited automated DMs are blocked" },
  { slug: "youtube_data_api", name: "YouTube", purpose: "Video publishing and performance data", risk: "Uploading requires approval" },
  { slug: "slack", name: "Slack", purpose: "Internal coordination and alerts", risk: "External messages require approval" },
  { slug: "notion", name: "Notion", purpose: "Knowledge, plans, and operating memory", risk: "Destructive changes require approval" },
  { slug: "github", name: "GitHub", purpose: "Product delivery and engineering work", risk: "Merge, release, and deletion require approval" },
  { slug: "hubspot", name: "HubSpot", purpose: "Lead and customer relationship management", risk: "Outbound actions require approval" },
  { slug: "stripe", name: "Stripe", purpose: "Revenue and customer payment visibility", risk: "Money movement requires approval" },
  { slug: "razorpay", name: "Razorpay", purpose: "spiritualai.store payment operations", risk: "Refunds and payouts require approval" },
] as const;

export type PipedreamAppSlug = (typeof PIPEDREAM_APPS)[number]["slug"];

export function isPipedreamConfigured() {
  return Boolean(
    process.env.PIPEDREAM_CLIENT_ID?.trim()
    && process.env.PIPEDREAM_CLIENT_SECRET?.trim()
    && process.env.PIPEDREAM_PROJECT_ID?.trim(),
  );
}

export function isAllowedPipedreamApp(value: string): value is PipedreamAppSlug {
  return PIPEDREAM_APPS.some((app) => app.slug === value);
}

export function pipedreamExternalUserId(clerkUserId: string) {
  return `spiritual-ai:${clerkUserId}`.slice(0, 250);
}

export function getPipedreamClient() {
  if (!isPipedreamConfigured()) {
    throw new Error("Pipedream Connect is not configured");
  }
  return new PipedreamClient({
    clientId: process.env.PIPEDREAM_CLIENT_ID!,
    clientSecret: process.env.PIPEDREAM_CLIENT_SECRET!,
    projectId: process.env.PIPEDREAM_PROJECT_ID!,
    projectEnvironment: process.env.PIPEDREAM_ENVIRONMENT === "production" ? "production" : "development",
  });
}

export function safeDashboardOrigin() {
  const fallback = "http://localhost:3001";
  try {
    const value = new URL(process.env.NEXT_PUBLIC_APP_URL || fallback);
    if (value.protocol === "https:" || (value.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(value.hostname))) {
      return value.origin;
    }
  } catch {
    // Fall through to a local, non-secret default.
  }
  return fallback;
}

export function validatePipedreamConnectUrl(rawUrl: string, app: PipedreamAppSlug) {
  const url = new URL(rawUrl);
  const trustedHost = url.hostname === "pipedream.com" || url.hostname.endsWith(".pipedream.com");
  if (url.protocol !== "https:" || !trustedHost) {
    throw new Error("Pipedream returned an untrusted connection URL");
  }
  url.searchParams.set("app", app);
  return url.toString();
}
