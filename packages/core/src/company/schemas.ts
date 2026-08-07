import { z } from "zod";

export const departmentIdSchema = z.enum([
  "ceo", "sales", "customer-care", "marketing", "influencer-partnerships", "product-management", "backend-engineering",
  "legal", "finance", "data-science-analytics", "seo-geo-aeo", "market-research",
]);

export const externalActionSchema = z.enum([
  "internal-read", "internal-write", "public-content-draft", "public-content-publish",
  "prospect-enrichment", "commercial-email-send", "social-direct-message-send",
  "outbound-call-place", "customer-message-send", "ad-spend-change",
  "contract-or-terms-change", "legal-advice-publish", "personal-data-export",
  "refund-create", "payout-create", "bank-or-payment-settings-change",
  "tax-or-regulatory-filing", "product-release", "credential-or-permission-change",
  "external-account-create", "external-mailbox-read", "cloud-computer-create",
  "cloud-computer-view", "cloud-computer-control", "sandbox-code-execute",
  "agent-loop-start", "agent-loop-pause",
]);

export const secretReferenceSchema = z.object({
  secretRef: z.string().min(1).max(500),
  keyVersion: z.string().min(1).max(100).optional(),
}).strict();

const connectorBaseShape = {
  id: z.string().min(1),
  organizationId: z.string().min(1),
  displayName: z.string().min(1).max(120),
  status: z.enum(["not-configured", "connected", "degraded", "disabled", "revoked"]),
  credentials: secretReferenceSchema.optional(),
  enabledDepartmentIds: z.array(departmentIdSchema).min(1),
  allowedActions: z.array(externalActionSchema),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
};

export const aiProviderConnectorSchema = z.object({
  ...connectorBaseShape,
  kind: z.literal("ai-provider"),
  provider: z.enum(["codex", "openai", "hermes", "anthropic", "ollama", "openrouter", "groq", "nvidia"]),
  endpoint: z.string().url().optional(),
  model: z.string().min(1).max(200),
  capabilities: z.array(z.enum(["text", "vision", "audio", "tool-use", "structured-output", "code-execution", "local-inference"])).min(1),
  limits: z.object({
    requestsPerMinute: z.number().int().positive().optional(),
    tokensPerMinute: z.number().int().positive().optional(),
    maxInputTokens: z.number().int().positive().optional(),
    maxOutputTokens: z.number().int().positive().optional(),
    monthlyBudgetMinor: z.number().int().nonnegative().optional(),
    currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  }).strict(),
  dataPolicy: z.object({
    allowPersonalData: z.boolean(),
    allowConfidentialData: z.boolean(),
    retentionMode: z.enum(["provider-default", "zero-retention", "local-only"]),
  }).strict(),
}).strict().superRefine((connector, context) => {
  if (connector.provider === "ollama" && connector.dataPolicy.retentionMode !== "local-only") {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["dataPolicy", "retentionMode"], message: "Ollama connectors must use local-only retention" });
  }
  if (connector.status === "connected" && connector.provider !== "ollama" && !connector.credentials) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["credentials"], message: "Connected remote providers require a secret reference" });
  }
});

export const communicationConnectorSchema = z.object({
  ...connectorBaseShape,
  kind: z.enum(["email", "social-media", "telephony", "messaging"]),
  provider: z.enum(["smtp", "sendgrid", "mailgun", "agentmail", "twilio", "telegram", "whatsapp", "linkedin", "x", "facebook", "instagram", "youtube", "tiktok"]),
  accountId: z.string().min(1).max(250),
  senderIdentity: z.string().min(1).max(250).optional(),
  webhookSigningSecret: secretReferenceSchema.optional(),
  compliance: z.object({
    requireConsentRecord: z.boolean(),
    honorSuppressionLists: z.boolean(),
    quietHoursTimezone: z.string().min(1).optional(),
    quietHoursStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
    quietHoursEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
    recordingDisclosureRequired: z.boolean().optional(),
  }).strict(),
}).strict().superRefine((connector, context) => {
  if (connector.kind === "telephony" && connector.provider !== "twilio") {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["provider"], message: "The configured telephony contract currently supports Twilio" });
  }
  if ((connector.kind === "email" || connector.kind === "telephony") && !connector.compliance.honorSuppressionLists) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["compliance", "honorSuppressionLists"], message: "Email and telephony connectors must honor suppression lists" });
  }
});

export const paymentConnectorSchema = z.object({
  ...connectorBaseShape,
  kind: z.literal("payment"),
  provider: z.enum(["razorpay", "stripe", "paypal"]),
  merchantAccountId: z.string().min(1).max(250),
  mode: z.enum(["test", "live"]),
  webhookSigningSecret: secretReferenceSchema,
  settlementCurrency: z.string().regex(/^[A-Z]{3}$/),
  permissions: z.array(z.enum(["payments:read", "refunds:read", "refunds:create", "payouts:read", "payouts:create", "settlements:read", "invoices:manage"])),
  transactionLimits: z.object({
    autonomousRefundMinor: z.number().int().nonnegative(),
    singlePayoutMinor: z.number().int().nonnegative(),
    dailyPayoutMinor: z.number().int().nonnegative(),
  }).strict(),
}).strict().superRefine((connector, context) => {
  if (connector.transactionLimits.singlePayoutMinor > connector.transactionLimits.dailyPayoutMinor) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["transactionLimits", "singlePayoutMinor"], message: "Single payout limit cannot exceed the daily payout limit" });
  }
});

export const analyticsConnectorSchema = z.object({
  ...connectorBaseShape,
  kind: z.literal("analytics"),
  provider: z.enum(["microsoft-clarity", "google-analytics-4", "google-search-console", "mixpanel", "posthog", "amplitude"]),
  propertyId: z.string().min(1).max(250),
  permissions: z.array(z.enum(["reports:read", "events:read", "events:write", "exports:create"])).min(1),
  privacy: z.object({
    maskText: z.boolean(),
    maskInputs: z.boolean(),
    excludeSensitivePages: z.array(z.string().min(1)),
    retentionDays: z.number().int().positive().optional(),
  }).strict(),
}).strict();

export const agentLoopGuardrailsSchema = z.object({
  maxIterations: z.number().int().min(1).max(10_000),
  maxRuntimeSeconds: z.number().int().min(1).max(86_400),
  maxConsecutiveFailures: z.number().int().min(1).max(20),
  maxSpendMinor: z.number().int().nonnegative(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  requireIdempotencyKey: z.literal(true),
  stopOnPolicyDenial: z.literal(true),
  heartbeatSeconds: z.number().int().min(5).max(300),
}).strict();
