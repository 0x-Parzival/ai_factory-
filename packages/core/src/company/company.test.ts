import { describe, expect, it } from "vitest";
import {
  ACTION_POLICIES,
  AI_PROVIDERS,
  SPIRITUAL_AI_DEPARTMENTS,
  agentLoopGuardrailsSchema,
  evaluateDepartmentAction,
  paymentConnectorSchema,
} from "./index";

describe("Spiritual AI company domain", () => {
  it("defines each required department exactly once", () => {
    expect(SPIRITUAL_AI_DEPARTMENTS).toHaveLength(12);
    expect(new Set(SPIRITUAL_AI_DEPARTMENTS.map(({ id }) => id)).size).toBe(12);
    expect(SPIRITUAL_AI_DEPARTMENTS.every(({ allowedConnectorKinds }) =>
      allowedConnectorKinds.includes("ai-provider"),
    )).toBe(true);
    expect(SPIRITUAL_AI_DEPARTMENTS.find(({ id }) => id === "ceo")?.reportsTo).toBe("owner");
    expect(SPIRITUAL_AI_DEPARTMENTS.filter(({ id }) => id !== "ceo").every(({ reportsTo }) =>
      reportsTo === "ceo",
    )).toBe(true);
  });

  it("keeps search optimization analysis autonomous but publishing approval-gated", () => {
    expect(evaluateDepartmentAction("seo-geo-aeo", "internal-read")).toMatchObject({
      allowed: true,
      approval: "autonomous",
    });
    expect(evaluateDepartmentAction("seo-geo-aeo", "public-content-publish")).toMatchObject({
      allowed: true,
      approval: "human-approval",
    });
  });

  it("supports all requested AI provider connector types", () => {
    expect(Object.keys(AI_PROVIDERS).sort()).toEqual([
      "anthropic", "codex", "groq", "hermes", "nvidia", "ollama", "openai", "openrouter",
    ]);
  });

  it("does not grant finance payouts to sales", () => {
    expect(evaluateDepartmentAction("sales", "payout-create")).toMatchObject({ allowed: false });
  });

  it("requires dual control for a finance payout", () => {
    expect(evaluateDepartmentAction("finance", "payout-create")).toMatchObject({
      allowed: true,
      approval: "dual-control",
      risk: "critical",
    });
  });

  it("lets the CEO propose an external account but requires dual control", () => {
    expect(evaluateDepartmentAction("ceo", "external-account-create")).toMatchObject({
      allowed: true,
      approval: "dual-control",
      risk: "critical",
    });
    expect(evaluateDepartmentAction("marketing", "external-account-create")).toMatchObject({ allowed: false });
  });

  it("requires audit logging for every external action", () => {
    expect(Object.values(ACTION_POLICIES).every(({ auditRequired }) => auditRequired)).toBe(true);
  });

  it("rejects unsafe payment limits", () => {
    const result = paymentConnectorSchema.safeParse({
      id: "connector-id",
      organizationId: "organization-id",
      kind: "payment",
      provider: "razorpay",
      displayName: "Primary payments",
      status: "connected",
      credentials: { secretRef: "vault://razorpay/key" },
      enabledDepartmentIds: ["finance"],
      allowedActions: ["refund-create", "payout-create"],
      createdAt: "2026-07-13T00:00:00.000Z",
      updatedAt: "2026-07-13T00:00:00.000Z",
      merchantAccountId: "merchant-account-id",
      mode: "live",
      webhookSigningSecret: { secretRef: "vault://razorpay/webhook" },
      settlementCurrency: "INR",
      permissions: ["payments:read", "payouts:create"],
      transactionLimits: { autonomousRefundMinor: 0, singlePayoutMinor: 20_000, dailyPayoutMinor: 10_000 },
    });

    expect(result.success).toBe(false);
  });

  it("requires bounded, stoppable loops", () => {
    expect(agentLoopGuardrailsSchema.safeParse({
      maxIterations: 100,
      maxRuntimeSeconds: 3_600,
      maxConsecutiveFailures: 3,
      maxSpendMinor: 0,
      currency: "USD",
      requireIdempotencyKey: true,
      stopOnPolicyDenial: true,
      heartbeatSeconds: 30,
    }).success).toBe(true);
  });
});
