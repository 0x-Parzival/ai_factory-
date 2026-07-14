import { afterEach, describe, expect, it, vi } from "vitest";
import { allProviderConfigs } from "./config";
import { evaluateBusinessAction } from "./actions";
import { CONNECTOR_CATALOG, connectorReadiness } from "./catalog";
import { GoogleSearchConsoleConnector } from "./business-connectors";
import { OpenOutreachConnector } from "./openoutreach";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("provider configuration", () => {
  it("never exposes a configured cloud provider without a credential", () => {
    const providers = allProviderConfigs({});
    expect(providers.find((provider) => provider.id === "openai")?.enabled).toBe(false);
    expect(providers.find((provider) => provider.id === "ollama")?.enabled).toBe(true);
  });
});

describe("connector readiness", () => {
  it("reports missing credentials without inventing a connected state", () => {
    const razorpay = CONNECTOR_CATALOG.find((connector) => connector.id === "razorpay")!;
    const readiness = connectorReadiness(razorpay, {});
    expect(readiness.configured).toBe(false);
    expect(readiness.missingSecrets).toContain("RAZORPAY_KEY_SECRET");
  });

  it("keeps Google Search Console disconnected until both read credentials are present", () => {
    const searchConsole = CONNECTOR_CATALOG.find((connector) => connector.id === "google-search-console")!;
    expect(connectorReadiness(searchConsole, {}).configured).toBe(false);
    expect(connectorReadiness(searchConsole, {
      GOOGLE_SEARCH_CONSOLE_ACCESS_TOKEN: "oauth-token",
      GOOGLE_SEARCH_CONSOLE_SITE_URL: "sc-domain:example.com",
    }).configured).toBe(true);
  });

  it("queries only the Search Console read-only analytics endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      rows: [{ keys: ["meditation"], clicks: 2, impressions: 20, ctr: 0.1, position: 4.5 }],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const connector = new GoogleSearchConsoleConnector("oauth-token", "sc-domain:example.com");
    const result = await connector.execute({
      id: "search-read-1",
      organizationId: "org-1",
      departmentId: "seo-geo-aeo",
      taskId: "task-1",
      kind: "analytics.read",
      payload: { startDate: "2026-06-01", endDate: "2026-06-30", dimensions: ["query"] },
      idempotencyKey: "org-1:task-1:search-read-1",
      requestedBy: "search-agent-1",
      requestedAt: new Date(),
    });

    expect(result.rows?.[0]?.impressions).toBe(20);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/searchAnalytics/query");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toMatchObject({ dataState: "final", type: "web" });
  });
});

describe("business action policy", () => {
  it("requires approval for contact and financial actions", () => {
    const base = {
      id: "action-1",
      organizationId: "org-1",
      departmentId: "sales",
      taskId: "task-1",
      idempotencyKey: "org-1:task-1:action-1",
      requestedBy: "agent-1",
      requestedAt: new Date(),
      payload: {},
    };
    expect(evaluateBusinessAction({ ...base, kind: "email.send" }).requiresHumanApproval).toBe(true);
    expect(evaluateBusinessAction({ ...base, kind: "payment.refund" }).risk).toBe("CRITICAL");
    expect(evaluateBusinessAction({ ...base, kind: "account.connect" }).risk).toBe("CRITICAL");
    expect(evaluateBusinessAction({ ...base, kind: "account.connect" }).requiresHumanApproval).toBe(true);
    expect(evaluateBusinessAction({ ...base, kind: "research.read" }).requiresHumanApproval).toBe(false);
  });

  it("blocks email and DM actions without recipient-scoped outreach evidence", () => {
    const decision = evaluateBusinessAction({
      id: "dm-1",
      organizationId: "org-1",
      departmentId: "sales",
      taskId: "task-1",
      kind: "social.message",
      payload: {},
      idempotencyKey: "org-1:task-1:dm-1",
      requestedBy: "sales-agent-1",
      requestedAt: new Date(),
    });
    expect(decision.allowed).toBe(false);
    expect(decision.requiresHumanApproval).toBe(true);
    expect(decision.reasons).toContain("Outreach approval context is required");
  });

  it("accepts a complete inbound reply context but still requires human approval", () => {
    const decision = evaluateBusinessAction({
      id: "reply-1",
      organizationId: "org-1",
      departmentId: "sales",
      taskId: "task-1",
      kind: "social.message",
      payload: {
        outreach: {
          channel: "instagram",
          recipientId: "ig-scoped-user-123",
          message: "Hi — I’m Spiritual AI's assistant. What kind of personalized practice are you looking for?",
          relationshipBasis: "inbound",
          suppressionCheckedAt: "2026-07-14T04:00:00.000Z",
          suppressed: false,
          platformPolicyConfirmed: true,
          aiDisclosure: true,
        },
      },
      idempotencyKey: "org-1:task-1:reply-1",
      requestedBy: "sales-agent-1",
      requestedAt: new Date(),
    });
    expect(decision.allowed).toBe(true);
    expect(decision.requiresHumanApproval).toBe(true);
  });

  it("requires dated consent evidence for opt-in outreach", () => {
    const decision = evaluateBusinessAction({
      id: "wa-1",
      organizationId: "org-1",
      departmentId: "sales",
      taskId: "task-1",
      kind: "social.message",
      payload: {
        outreach: {
          channel: "whatsapp",
          recipientId: "+10000000000",
          message: "Spiritual AI follow-up",
          relationshipBasis: "opt_in",
          suppressionCheckedAt: "2026-07-14T04:00:00.000Z",
          suppressed: false,
          platformPolicyConfirmed: true,
          aiDisclosure: true,
        },
      },
      idempotencyKey: "org-1:task-1:wa-1",
      requestedBy: "sales-agent-1",
      requestedAt: new Date(),
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reasons).toContain("Opt-in outreach requires a source and dated consent evidence");
  });
});

describe("OpenOutreach connector", () => {
  it("approves only when recipient, body, and fingerprint match the pending draft", async () => {
    const draft = {
      id: 7,
      recipient: "creator@example.com",
      body: "I'm Spiritual AI's assistant. Would you test a Pattern Mirror?",
      fingerprint: "a".repeat(64),
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ approvals: [draft] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ approved: true, id: 7 }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const connector = new OpenOutreachConnector({ baseUrl: "http://127.0.0.1:8000", factoryToken: "factory-token" });

    const result = await connector.execute({
      id: "approve-7",
      organizationId: "spiritual-ai",
      departmentId: "sales",
      taskId: "campaign-1",
      kind: "email.send",
      payload: {
        operation: "approve",
        dealId: 7,
        fingerprint: draft.fingerprint,
        outreach: {
          channel: "email",
          recipientId: draft.recipient,
          message: draft.body,
          relationshipBasis: "existing_relationship",
          suppressionCheckedAt: "2026-07-14T05:00:00.000Z",
          suppressed: false,
          platformPolicyConfirmed: true,
          aiDisclosure: true,
        },
      },
      idempotencyKey: "spiritual-ai:campaign-1:approve-7",
      requestedBy: "owner",
      requestedAt: new Date(),
    }, "recipient-scoped-owner-approval");

    expect(result).toMatchObject({ approved: true, id: 7 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects a draft when the approval message differs", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ approvals: [{
      id: 7, recipient: "creator@example.com", body: "Stored body", fingerprint: "b".repeat(64),
    }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const connector = new OpenOutreachConnector({ baseUrl: "http://localhost:8000", factoryToken: "factory-token" });

    await expect(connector.execute({
      id: "approve-7",
      organizationId: "spiritual-ai",
      departmentId: "sales",
      taskId: "campaign-1",
      kind: "email.send",
      payload: {
        operation: "approve",
        dealId: 7,
        fingerprint: "b".repeat(64),
        outreach: {
          channel: "email",
          recipientId: "creator@example.com",
          message: "Different body",
          relationshipBasis: "existing_relationship",
          suppressionCheckedAt: "2026-07-14T05:00:00.000Z",
          suppressed: false,
          platformPolicyConfirmed: true,
          aiDisclosure: true,
        },
      },
      idempotencyKey: "spiritual-ai:campaign-1:approve-7",
      requestedBy: "owner",
      requestedAt: new Date(),
    }, "recipient-scoped-owner-approval")).rejects.toThrow("does not match");
  });
});
