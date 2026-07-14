/**
 * Stable domain vocabulary for the Spiritual AI Factory.
 *
 * These types deliberately describe authority, not UI presentation. Every
 * executor (dashboard, scheduler or agent runtime) must enforce the same
 * grants and approval policy before invoking an external connector.
 */

export type DepartmentId =
  | "ceo"
  | "sales"
  | "customer-care"
  | "marketing"
  | "product-management"
  | "legal"
  | "finance"
  | "data-science-analytics"
  | "seo-geo-aeo";

export type DepartmentCapability =
  | "company.strategy.read"
  | "company.strategy.write"
  | "company.objectives.assign"
  | "company.operations.monitor"
  | "company.operations.pause"
  | "company.budgets.allocate"
  | "company.approvals.request"
  | "company.escalations.notify"
  | "sales.prospects.research"
  | "sales.contacts.enrich"
  | "sales.crm.read"
  | "sales.crm.write"
  | "sales.outreach.draft"
  | "sales.outreach.send"
  | "sales.calls.schedule"
  | "sales.calls.place"
  | "sales.proposals.prepare"
  | "sales.deals.negotiate"
  | "sales.contracts.request"
  | "support.knowledge.read"
  | "support.tickets.read"
  | "support.tickets.write"
  | "support.messages.send"
  | "support.refunds.request"
  | "support.incidents.escalate"
  | "marketing.trends.research"
  | "marketing.content.create"
  | "marketing.content.publish"
  | "marketing.community.respond"
  | "marketing.campaigns.manage"
  | "marketing.ads.manage"
  | "product.orders.read"
  | "product.research.perform"
  | "product.requirements.write"
  | "product.assets.generate"
  | "product.personas.configure"
  | "product.quality.verify"
  | "product.delivery.release"
  | "legal.law.research"
  | "legal.compliance.review"
  | "legal.contracts.review"
  | "legal.privacy.review"
  | "legal.ip.review"
  | "legal.advice.publish"
  | "finance.payments.read"
  | "finance.payments.refund"
  | "finance.payouts.create"
  | "finance.invoices.manage"
  | "finance.reconcile"
  | "finance.forecast"
  | "finance.reports.prepare"
  | "finance.tax.prepare"
  | "analytics.sources.read"
  | "analytics.events.define"
  | "analytics.experiments.propose"
  | "analytics.experiments.run"
  | "analytics.reports.publish"
  | "analytics.data.export"
  | "analytics.pii.access"
  | "search.performance.read"
  | "search.queries.analyze"
  | "search.pages.analyze"
  | "search.intent.research"
  | "search.content.brief.create"
  | "search.structured-data.draft"
  | "search.geo.optimize"
  | "search.aeo.optimize"
  | "search.content.publish";

export type ExternalAction =
  | "internal-read"
  | "internal-write"
  | "public-content-draft"
  | "public-content-publish"
  | "prospect-enrichment"
  | "commercial-email-send"
  | "social-direct-message-send"
  | "outbound-call-place"
  | "customer-message-send"
  | "ad-spend-change"
  | "contract-or-terms-change"
  | "legal-advice-publish"
  | "personal-data-export"
  | "refund-create"
  | "payout-create"
  | "bank-or-payment-settings-change"
  | "tax-or-regulatory-filing"
  | "product-release"
  | "credential-or-permission-change"
  | "external-account-create"
  | "external-mailbox-read"
  | "cloud-computer-create"
  | "cloud-computer-view"
  | "cloud-computer-control"
  | "sandbox-code-execute"
  | "agent-loop-start"
  | "agent-loop-pause";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type ApprovalMode =
  | "autonomous"
  | "policy-check"
  | "human-approval"
  | "dual-control"
  | "qualified-professional";

export interface ActionPolicy {
  action: ExternalAction;
  risk: RiskLevel;
  approval: ApprovalMode;
  conditions: readonly string[];
  auditRequired: boolean;
}

export interface DepartmentDefinition {
  id: DepartmentId;
  name: string;
  mission: string;
  reportsTo: DepartmentId | "owner";
  canDelegateTo: readonly DepartmentId[];
  color: `#${string}`;
  icon: string;
  capabilities: readonly DepartmentCapability[];
  allowedConnectorKinds: readonly ConnectorKind[];
  autonomousActions: readonly ExternalAction[];
  approvalRequiredActions: readonly ExternalAction[];
  prohibitedActions: readonly string[];
  successMetrics: readonly string[];
}

export type AIProviderId =
  | "codex"
  | "openai"
  | "hermes"
  | "anthropic"
  | "ollama"
  | "openrouter"
  | "groq"
  | "nvidia";

export type ConnectorKind =
  | "ai-provider"
  | "email"
  | "social-media"
  | "telephony"
  | "messaging"
  | "crm"
  | "contact-enrichment"
  | "payment"
  | "accounting"
  | "analytics"
  | "content-storage"
  | "web-data"
  | "cloud-computer"
  | "sandbox"
  | "commerce";

export type ConnectorStatus =
  | "not-configured"
  | "connected"
  | "degraded"
  | "disabled"
  | "revoked";

export interface SecretReference {
  /** Identifier in a secret manager. Raw credentials must never be persisted. */
  secretRef: string;
  keyVersion?: string;
}

export interface ConnectorBase {
  id: string;
  organizationId: string;
  kind: ConnectorKind;
  provider: string;
  displayName: string;
  status: ConnectorStatus;
  credentials?: SecretReference;
  enabledDepartmentIds: readonly DepartmentId[];
  allowedActions: readonly ExternalAction[];
  createdAt: string;
  updatedAt: string;
}

export interface AIProviderConnector extends ConnectorBase {
  kind: "ai-provider";
  provider: AIProviderId;
  endpoint?: string;
  model: string;
  capabilities: readonly (
    | "text"
    | "vision"
    | "audio"
    | "tool-use"
    | "structured-output"
    | "code-execution"
    | "local-inference"
  )[];
  limits: {
    requestsPerMinute?: number;
    tokensPerMinute?: number;
    maxInputTokens?: number;
    maxOutputTokens?: number;
    monthlyBudgetMinor?: number;
    currency?: string;
  };
  dataPolicy: {
    allowPersonalData: boolean;
    allowConfidentialData: boolean;
    retentionMode: "provider-default" | "zero-retention" | "local-only";
  };
}

export type CommunicationProvider =
  | "smtp"
  | "sendgrid"
  | "mailgun"
  | "twilio"
  | "telegram"
  | "whatsapp"
  | "linkedin"
  | "x"
  | "facebook"
  | "instagram"
  | "youtube"
  | "tiktok";

export interface CommunicationConnector extends ConnectorBase {
  kind: "email" | "social-media" | "telephony" | "messaging";
  provider: CommunicationProvider;
  accountId: string;
  senderIdentity?: string;
  webhookSigningSecret?: SecretReference;
  compliance: {
    requireConsentRecord: boolean;
    honorSuppressionLists: boolean;
    quietHoursTimezone?: string;
    quietHoursStart?: string;
    quietHoursEnd?: string;
    recordingDisclosureRequired?: boolean;
  };
}

export type PaymentProvider = "razorpay" | "stripe" | "paypal";

export interface PaymentConnector extends ConnectorBase {
  kind: "payment";
  provider: PaymentProvider;
  merchantAccountId: string;
  mode: "test" | "live";
  webhookSigningSecret: SecretReference;
  settlementCurrency: string;
  permissions: readonly (
    | "payments:read"
    | "refunds:read"
    | "refunds:create"
    | "payouts:read"
    | "payouts:create"
    | "settlements:read"
    | "invoices:manage"
  )[];
  transactionLimits: {
    autonomousRefundMinor: number;
    singlePayoutMinor: number;
    dailyPayoutMinor: number;
  };
}

export type AnalyticsProvider =
  | "microsoft-clarity"
  | "google-analytics-4"
  | "google-search-console"
  | "mixpanel"
  | "posthog"
  | "amplitude";

export interface AnalyticsConnector extends ConnectorBase {
  kind: "analytics";
  provider: AnalyticsProvider;
  propertyId: string;
  permissions: readonly ("reports:read" | "events:read" | "events:write" | "exports:create")[];
  privacy: {
    maskText: boolean;
    maskInputs: boolean;
    excludeSensitivePages: readonly string[];
    retentionDays?: number;
  };
}

export type CompanyConnector =
  | AIProviderConnector
  | CommunicationConnector
  | PaymentConnector
  | AnalyticsConnector
  | ConnectorBase;

export interface PolicyDecision {
  allowed: boolean;
  action: ExternalAction;
  risk: RiskLevel;
  approval: ApprovalMode;
  reasons: readonly string[];
}
