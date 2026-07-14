export type SalesChannelMode = "inbound" | "opt-in" | "restricted" | "internal" | "unsupported";

export type SalesChannel = {
  id: string;
  name: string;
  mode: SalesChannelMode;
  connection: string;
  permittedUse: string;
  firstContactRule: string;
  salesUse: string;
};

/**
 * Product capability map, not live connection state. Rules are intentionally
 * conservative: a provider exposing a send endpoint is not proof that a
 * recipient consented to sales outreach.
 */
export const SALES_CHANNELS: readonly SalesChannel[] = [
  {
    id: "website-chat",
    name: "SpiritualAI.store chat",
    mode: "inbound",
    connection: "First-party website widget + CRM webhook",
    permittedUse: "Answer visitors, qualify intent, capture consent, and schedule a human conversation.",
    firstContactRule: "The visitor starts the conversation.",
    salesUse: "Primary launch channel",
  },
  {
    id: "instagram",
    name: "Instagram Professional",
    mode: "inbound",
    connection: "Meta Instagram Messaging API / instagram_business",
    permittedUse: "Reply to people who interact with the professional account and route qualified leads to CRM.",
    firstContactRule: "Use the API only inside Meta's allowed conversation and permission model; no profile scraping or cold bot DMs.",
    salesUse: "Replies to comments, story interactions, and inbox leads",
  },
  {
    id: "messenger",
    name: "Facebook Messenger",
    mode: "inbound",
    connection: "Messenger Platform + Facebook Page",
    permittedUse: "Reply from the Page during the standard window or use a separately permitted message type.",
    firstContactRule: "The person must message the Page first or explicitly agree to messages outside the standard window.",
    salesUse: "Page inbox qualification",
  },
  {
    id: "whatsapp",
    name: "WhatsApp Business",
    mode: "opt-in",
    connection: "WhatsApp Business Platform / whatsapp_business",
    permittedUse: "Reply to inbound conversations and send approved templates to documented opt-ins.",
    firstContactRule: "Record opt-in source and time before business-initiated messaging; honor opt-outs immediately.",
    salesUse: "High-intent follow-up and appointment reminders",
  },
  {
    id: "email",
    name: "Gmail / business email",
    mode: "opt-in",
    connection: "Gmail API, SendGrid, or connected CRM",
    permittedUse: "One-to-one or campaign email with a lawful contact basis, truthful sender identity, and working opt-out.",
    firstContactRule: "Recipient, message, contact basis, and suppression check must be present in the approval payload.",
    salesUse: "Partner outreach and opted-in lead nurturing",
  },
  {
    id: "sms",
    name: "SMS / Twilio",
    mode: "opt-in",
    connection: "Twilio Messaging",
    permittedUse: "Transactional or sales follow-up to numbers with channel-specific consent.",
    firstContactRule: "Document consent and support STOP-style opt-out handling before sending.",
    salesUse: "Time-sensitive follow-up for opted-in leads",
  },
  {
    id: "telegram",
    name: "Telegram Bot",
    mode: "inbound",
    connection: "Telegram Bot API / telegram_bot_api",
    permittedUse: "Respond after a person starts the bot or adds it to an authorized group.",
    firstContactRule: "Telegram bots cannot start a conversation with a user.",
    salesUse: "Lead magnet, support, and owner escalation",
  },
  {
    id: "x",
    name: "X Direct Messages",
    mode: "restricted",
    connection: "Official X API with OAuth 2.0 user authorization",
    permittedUse: "Contextual, recipient-eligible messages through the official DM API.",
    firstContactRule: "No unsolicited automated DMs, duplicate messages, or browser automation; every first contact is human-approved.",
    salesUse: "Small-volume partner conversations",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    mode: "restricted",
    connection: "Approved LinkedIn Communications access or Message Ads",
    permittedUse: "Human-reviewed messages to eligible existing connections, or approved Message/Conversation Ads.",
    firstContactRule: "Do not automate member scraping or generic cold DMs; LinkedIn messaging access is restricted and review-based.",
    salesUse: "Partnerships, specialists, and approved lead-generation ads",
  },
  {
    id: "discord",
    name: "Discord Bot",
    mode: "inbound",
    connection: "Discord Bot API / discord_bot",
    permittedUse: "Respond to relevant interactions in communities where the bot is installed.",
    firstContactRule: "No frequent unsolicited DMs or promotional messages unrelated to the bot's disclosed function.",
    salesUse: "Community education and inbound qualification",
  },
  {
    id: "slack",
    name: "Slack",
    mode: "internal",
    connection: "Slack app / slack",
    permittedUse: "Coordinate the Sales team or respond inside workspaces that installed the app.",
    firstContactRule: "Workspace installation and scopes do not authorize prospecting outside that workspace context.",
    salesUse: "Internal alerts and approved partner workspaces",
  },
  {
    id: "tiktok",
    name: "TikTok",
    mode: "unsupported",
    connection: "Content Posting API for approved publishing",
    permittedUse: "Publish approved content and direct interested viewers to an inbound channel.",
    firstContactRule: "The public developer API does not provide a general sales-DM sending capability.",
    salesUse: "Demand generation, not automated DMs",
  },
] as const;

export const SALES_OUTREACH_GATES = [
  "A stable recipient ID or address and the exact message are required.",
  "The relationship basis must be inbound, documented opt-in, existing relationship, or an approved ad product.",
  "Suppressed, opted-out, vulnerable, or restricted recipients are blocked.",
  "The first outbound message and every changed campaign payload require owner approval.",
  "The AI identifies itself as Spiritual AI's assistant when a human could otherwise be implied.",
  "All sends use official APIs, idempotency keys, rate limits, and an audit event.",
] as const;
