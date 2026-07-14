import type { BusinessActionKind } from "./actions";

export type ConnectorCategory =
  | "MODEL"
  | "CRM"
  | "EMAIL"
  | "TELEPHONY"
  | "SOCIAL"
  | "MESSAGING"
  | "PAYMENTS"
  | "ANALYTICS"
  | "CONTENT"
  | "STORAGE"
  | "COMPUTE"
  | "LEGAL_RESEARCH";

export interface ConnectorDefinition {
  id: string;
  name: string;
  category: ConnectorCategory;
  departments: string[];
  requiredSecrets: string[];
  optionalSecrets?: string[];
  actions: BusinessActionKind[];
  notes?: string;
}

export const CONNECTOR_CATALOG: ConnectorDefinition[] = [
  {
    id: "agentmail",
    name: "AgentMail",
    category: "EMAIL",
    departments: ["ceo", "sales", "customer-care"],
    requiredSecrets: ["AGENTMAIL_API_KEY", "AGENTMAIL_INBOX_ID"],
    optionalSecrets: ["AGENTMAIL_DOMAIN"],
    actions: ["email.read", "email.inbox.create", "email.send"],
    notes: "One dedicated, owner-configured agent inbox. Inbox creation and every outbound message are approval-gated; reads exclude spam, blocked, unauthenticated, and trash mail.",
  },
  {
    id: "composio",
    name: "Composio Managed OAuth",
    category: "CONTENT",
    departments: ["ceo", "sales", "customer-care", "marketing", "product-management", "finance", "data-analytics", "seo-geo-aeo"],
    requiredSecrets: ["COMPOSIO_API_KEY", "COMPOSIO_ACTION_TOOL_ALLOWLIST", "COMPOSIO_TOOLKIT_VERSIONS"],
    optionalSecrets: ["COMPOSIO_ALLOWED_TOOLKITS"],
    actions: ["research.read", "analytics.read", "content.draft", "email.read", "email.send", "social.publish", "social.message", "customer.record.update", "payment.create", "payment.refund", "account.connect"],
    notes: "OAuth accounts are private to the signed-in owner. Tool execution is denied unless the exact tool slug is mapped to the requested factory action and its toolkit version is pinned.",
  },
  {
    id: "orgo",
    name: "Orgo Cloud Computer",
    category: "COMPUTE",
    departments: ["ceo", "product-management"],
    requiredSecrets: ["ORGO_API_KEY", "ORGO_WORKSPACE_ID"],
    actions: ["computer.create", "computer.read", "computer.execute"],
    notes: "Persistent cloud desktops. Creation, screenshots, typing, clicks, shell, Python, and lifecycle actions all require explicit human approval.",
  },
  {
    id: "firecrawl",
    name: "Firecrawl Web Data",
    category: "CONTENT",
    departments: ["ceo", "sales", "marketing", "product-management", "data-analytics", "seo-geo-aeo"],
    requiredSecrets: ["FIRECRAWL_API_KEY"],
    actions: ["research.read"],
    notes: "Public-web search and single-page extraction only. Private, local, credential-bearing, and non-HTTPS targets are rejected; bulk crawling and browser interaction are not exposed.",
  },
  {
    id: "e2b",
    name: "E2B Ephemeral Sandbox",
    category: "COMPUTE",
    departments: ["ceo", "product-management", "data-analytics", "finance"],
    requiredSecrets: ["E2B_API_KEY"],
    optionalSecrets: ["E2B_TEMPLATE"],
    actions: ["code.execute"],
    notes: "Approval-gated command execution in a new isolated sandbox. Runtime and output are capped, no company secrets are injected, and the sandbox is killed after each job.",
  },
  {
    id: "openoutreach",
    name: "Spiritual AI OpenOutreach",
    category: "EMAIL",
    departments: ["sales", "ceo", "legal"],
    requiredSecrets: ["OPENOUTREACH_BASE_URL", "OPENOUTREACH_FACTORY_TOKEN"],
    actions: ["research.read", "analytics.read", "email.send", "customer.record.update"],
    notes: "Pinned, separate GPLv3 service. External sends default off; each exact recipient/body/fingerprint remains approval-gated and rejections enter permanent suppression.",
  },
  {
    id: "pipedream-mcp",
    name: "Pipedream MCP and Managed OAuth",
    category: "CONTENT",
    departments: ["ceo", "sales", "customer-care", "marketing", "product-management", "finance", "data-analytics", "seo-geo-aeo"],
    requiredSecrets: ["PIPEDREAM_CLIENT_ID", "PIPEDREAM_CLIENT_SECRET", "PIPEDREAM_PROJECT_ID", "PIPEDREAM_ENVIRONMENT"],
    actions: ["research.read", "analytics.read", "content.draft", "customer.record.update", "email.send", "social.publish", "social.message", "payment.create", "payment.refund", "account.connect"],
    notes: "Managed OAuth and remote MCP tools. New account connections stay interactive; external writes, public posts, outreach, contracts, credential changes, and money movement remain approval-gated.",
  },
  {
    id: "razorpay",
    name: "Razorpay",
    category: "PAYMENTS",
    departments: ["finance", "sales", "customer-care"],
    requiredSecrets: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"],
    actions: ["payment.create", "payment.refund", "analytics.read"],
  },
  {
    id: "microsoft-clarity",
    name: "Microsoft Clarity",
    category: "ANALYTICS",
    departments: ["data-analytics", "marketing", "product-management"],
    requiredSecrets: ["CLARITY_PROJECT_ID", "CLARITY_API_TOKEN"],
    actions: ["analytics.read"],
  },
  {
    id: "google-analytics",
    name: "Google Analytics 4",
    category: "ANALYTICS",
    departments: ["data-analytics", "marketing", "product-management"],
    requiredSecrets: ["GA4_PROPERTY_ID", "GOOGLE_SERVICE_ACCOUNT_JSON"],
    actions: ["analytics.read"],
  },
  {
    id: "google-search-console",
    name: "Google Search Console",
    category: "ANALYTICS",
    departments: ["seo-geo-aeo", "marketing", "data-analytics"],
    requiredSecrets: ["GOOGLE_SEARCH_CONSOLE_ACCESS_TOKEN", "GOOGLE_SEARCH_CONSOLE_SITE_URL"],
    actions: ["analytics.read"],
    notes: "Read-only Search Analytics queries. The OAuth grant must use the webmasters.readonly scope; publishing and indexing writes are not supported.",
  },
  {
    id: "hubspot",
    name: "HubSpot CRM",
    category: "CRM",
    departments: ["sales", "customer-care", "marketing"],
    requiredSecrets: ["HUBSPOT_ACCESS_TOKEN"],
    actions: ["customer.record.update", "analytics.read"],
  },
  {
    id: "twilio",
    name: "Twilio Voice and Messaging",
    category: "TELEPHONY",
    departments: ["sales", "customer-care"],
    requiredSecrets: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER"],
    actions: ["voice.call", "social.message"],
    notes: "Outbound calls require consent, local calling-hour checks, recording disclosure, and approval.",
  },
  {
    id: "sendgrid",
    name: "SendGrid Email",
    category: "EMAIL",
    departments: ["sales", "customer-care", "marketing"],
    requiredSecrets: ["SENDGRID_API_KEY", "SENDGRID_FROM_EMAIL"],
    actions: ["email.send"],
  },
  {
    id: "meta",
    name: "Meta (Instagram and Facebook)",
    category: "SOCIAL",
    departments: ["marketing", "sales", "customer-care"],
    requiredSecrets: ["META_APP_ID", "META_APP_SECRET", "META_ACCESS_TOKEN"],
    actions: ["social.publish", "social.message", "analytics.read"],
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    category: "SOCIAL",
    departments: ["marketing", "sales"],
    requiredSecrets: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET", "LINKEDIN_ACCESS_TOKEN"],
    actions: ["social.publish", "social.message", "analytics.read"],
    notes: "Use approved LinkedIn APIs; do not scrape profiles or automate prohibited behavior.",
  },
  {
    id: "x",
    name: "X",
    category: "SOCIAL",
    departments: ["marketing", "sales", "customer-care"],
    requiredSecrets: ["X_API_KEY", "X_API_SECRET", "X_ACCESS_TOKEN", "X_ACCESS_TOKEN_SECRET"],
    actions: ["social.publish", "social.message", "analytics.read"],
  },
  {
    id: "youtube",
    name: "YouTube",
    category: "SOCIAL",
    departments: ["marketing", "product-management", "data-analytics"],
    requiredSecrets: ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET", "YOUTUBE_REFRESH_TOKEN"],
    actions: ["social.publish", "analytics.read"],
  },
  {
    id: "telegram",
    name: "Telegram",
    category: "MESSAGING",
    departments: ["ceo", "customer-care", "sales"],
    requiredSecrets: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_OWNER_CHAT_ID"],
    actions: ["social.message"],
    notes: "The CEO uses this channel for approval and exception escalation.",
  },
  {
    id: "whatsapp",
    name: "WhatsApp Business",
    category: "MESSAGING",
    departments: ["sales", "customer-care", "marketing"],
    requiredSecrets: ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_VERIFY_TOKEN"],
    actions: ["social.message"],
  },
];

export interface ConnectorReadiness {
  id: string;
  configured: boolean;
  missingSecrets: string[];
}

export function connectorReadiness(
  definition: ConnectorDefinition,
  env: NodeJS.ProcessEnv = process.env,
): ConnectorReadiness {
  const missingSecrets = definition.requiredSecrets.filter((key) => !env[key]);
  return { id: definition.id, configured: missingSecrets.length === 0, missingSecrets };
}

export interface SecretResolver {
  getSecret(organizationId: string, name: string): Promise<string | undefined>;
}
