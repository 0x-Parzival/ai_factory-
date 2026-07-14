import { ApprovalGatedConnector, BusinessAction } from "./actions";

async function readJson(response: Response): Promise<unknown> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const record = payload as Record<string, any>;
    throw new Error(String(record?.error?.description || record?.error?.message || `HTTP ${response.status}`));
  }
  return payload;
}

export interface RazorpayPayload extends Record<string, unknown> {
  paymentId?: string;
  amount?: number;
  notes?: Record<string, string>;
  from?: number;
  to?: number;
  count?: number;
}

export class RazorpayConnector extends ApprovalGatedConnector<RazorpayPayload, unknown> {
  readonly id = "razorpay";
  readonly supportedActions = ["analytics.read", "payment.refund"] as const as Array<"analytics.read" | "payment.refund">;
  private readonly baseUrl = "https://api.razorpay.com/v1";

  constructor(private readonly keyId?: string, private readonly keySecret?: string) {
    super();
  }

  async health() {
    return {
      configured: Boolean(this.keyId && this.keySecret),
      reachable: false,
      ...(!this.keyId || !this.keySecret ? { error: "Razorpay credentials are not configured" } : {}),
    };
  }

  protected async executeApproved(action: BusinessAction<RazorpayPayload>): Promise<unknown> {
    if (!this.keyId || !this.keySecret) throw new Error("Razorpay credentials are not configured");
    const authorization = `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64")}`;
    if (action.kind === "analytics.read") {
      const params = new URLSearchParams();
      if (action.payload.from) params.set("from", String(action.payload.from));
      if (action.payload.to) params.set("to", String(action.payload.to));
      params.set("count", String(Math.min(Number(action.payload.count || 100), 100)));
      const response = await fetch(`${this.baseUrl}/payments?${params}`, { headers: { authorization } });
      return readJson(response);
    }
    if (action.kind === "payment.refund") {
      if (!action.payload.paymentId) throw new Error("paymentId is required for a refund");
      const response = await fetch(`${this.baseUrl}/payments/${encodeURIComponent(action.payload.paymentId)}/refund`, {
        method: "POST",
        headers: { authorization, "content-type": "application/json" },
        body: JSON.stringify({
          ...(action.payload.amount ? { amount: action.payload.amount } : {}),
          notes: { ...action.payload.notes, ai_factory_idempotency_key: action.idempotencyKey },
        }),
      });
      return readJson(response);
    }
    throw new Error(`Unsupported Razorpay action: ${action.kind}`);
  }
}

export interface ClarityPayload extends Record<string, unknown> {
  days?: 1 | 2 | 3;
  dimensions?: string[];
}

export class MicrosoftClarityConnector extends ApprovalGatedConnector<ClarityPayload, unknown> {
  readonly id = "microsoft-clarity";
  readonly supportedActions = ["analytics.read"] as const as Array<"analytics.read">;
  private readonly endpoint = "https://www.clarity.ms/export-data/api/v1/project-live-insights";

  constructor(private readonly apiToken?: string) {
    super();
  }

  async health() {
    return {
      configured: Boolean(this.apiToken),
      reachable: false,
      ...(!this.apiToken ? { error: "Clarity API token is not configured" } : {}),
    };
  }

  protected async executeApproved(action: BusinessAction<ClarityPayload>): Promise<unknown> {
    if (!this.apiToken) throw new Error("Clarity API token is not configured");
    const params = new URLSearchParams({ numOfDays: String(action.payload.days || 1) });
    (action.payload.dimensions || []).slice(0, 3).forEach((dimension, index) => {
      params.set(`dimension${index + 1}`, dimension);
    });
    const response = await fetch(`${this.endpoint}?${params}`, {
      headers: { authorization: `Bearer ${this.apiToken}`, "content-type": "application/json" },
    });
    return readJson(response);
  }
}

export type SearchConsoleDimension = "date" | "query" | "page" | "country" | "device" | "searchAppearance";

export interface GoogleSearchConsolePayload extends Record<string, unknown> {
  startDate?: string;
  endDate?: string;
  dimensions?: SearchConsoleDimension[];
  searchType?: "web" | "image" | "video" | "news" | "discover" | "googleNews";
  rowLimit?: number;
  startRow?: number;
}

export interface GoogleSearchConsoleRow {
  keys?: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GoogleSearchConsoleResult {
  rows?: GoogleSearchConsoleRow[];
  responseAggregationType?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Credential-gated, read-only Google Search Console Search Analytics adapter.
 * It deliberately exposes no sitemap, URL inspection, indexing or CMS writes.
 */
export class GoogleSearchConsoleConnector extends ApprovalGatedConnector<GoogleSearchConsolePayload, GoogleSearchConsoleResult> {
  readonly id = "google-search-console";
  readonly supportedActions = ["analytics.read"] as const as Array<"analytics.read">;
  private readonly baseUrl = "https://www.googleapis.com/webmasters/v3";

  constructor(
    private readonly accessToken?: string,
    private readonly siteUrl?: string,
  ) {
    super();
  }

  async health() {
    return {
      configured: Boolean(this.accessToken && this.siteUrl),
      reachable: false,
      ...(!this.accessToken || !this.siteUrl
        ? { error: "Google Search Console read-only OAuth token and site URL are not configured" }
        : {}),
    };
  }

  protected async executeApproved(action: BusinessAction<GoogleSearchConsolePayload>): Promise<GoogleSearchConsoleResult> {
    if (!this.accessToken || !this.siteUrl) {
      throw new Error("Google Search Console read-only OAuth token and site URL are not configured");
    }
    if (!action.payload.startDate || !action.payload.endDate) {
      throw new Error("startDate and endDate are required for Search Console analysis");
    }
    const isoDate = /^\d{4}-\d{2}-\d{2}$/;
    if (!isoDate.test(action.payload.startDate) || !isoDate.test(action.payload.endDate)) {
      throw new Error("Search Console dates must use YYYY-MM-DD");
    }
    const rowLimit = Math.max(1, Math.min(Number(action.payload.rowLimit || 1_000), 25_000));
    const startRow = Math.max(0, Number(action.payload.startRow || 0));
    const response = await fetch(
      `${this.baseUrl}/sites/${encodeURIComponent(this.siteUrl)}/searchAnalytics/query`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          startDate: action.payload.startDate,
          endDate: action.payload.endDate,
          dimensions: action.payload.dimensions || ["query", "page"],
          type: action.payload.searchType || "web",
          rowLimit,
          startRow,
          dataState: "final",
        }),
      },
    );
    return await readJson(response) as GoogleSearchConsoleResult;
  }
}
