import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { allProviderConfigs } from "@ai-factory/integrations/config";
import { completeWithCodexCli } from "@ai-factory/integrations/codex-cli";
import { ModelGateway } from "@ai-factory/integrations/model-gateway";
import {
  ProviderConfigurationError,
  ProviderRequestError,
  type ModelProviderId,
} from "@ai-factory/integrations/types";
import { getDepartment } from "@/lib/factory-blueprints";
import { isClerkConfigured } from "@/lib/auth-config";
import { getSecurityEvidence } from "@/lib/security-connectors";
import { INFLUENCER_PLAYBOOK } from "@/lib/influencer-playbook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const providerIds = ["openai", "codex", "anthropic", "openrouter", "groq", "nvidia", "ollama", "hermes"] as const;
const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4_000),
});
const requestSchema = z.object({
  provider: z.enum(providerIds),
  model: z.string().trim().min(1).max(160).regex(/^[a-zA-Z0-9._:/-]+$/).optional(),
  mode: z.enum(["lead_generation"]).optional(),
  messages: z.array(messageSchema).min(1).max(20),
}).superRefine((value, context) => {
  if (value.messages[value.messages.length - 1]?.role !== "user") {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["messages"], message: "The final message must be from the user." });
  }
});

const rateLimits = new Map<string, number[]>();
const MAX_REQUESTS_PER_MINUTE = 20;
const MAX_BODY_BYTES = 32_768;

function clientKey(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "local";
}

function isRateLimited(key: string) {
  const now = Date.now();
  const recent = (rateLimits.get(key) || []).filter((timestamp) => now - timestamp < 60_000);
  if (recent.length >= MAX_REQUESTS_PER_MINUTE) {
    rateLimits.set(key, recent);
    return true;
  }
  recent.push(now);
  rateLimits.set(key, recent);
  return false;
}

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

function systemInstruction(department: NonNullable<ReturnType<typeof getDepartment>>, mode?: "lead_generation") {
  const instructions = [
    `You are the ${department.name} AI inside the Spiritual AI Factory.`,
    `Department purpose: ${department.purpose}`,
    "Defined powers:",
    ...department.powers.map((power) => `- ${power}`),
    "Mandatory boundaries:",
    ...department.approvalBoundaries.map((boundary) => `- ${boundary}`),
    ...(department.slug === "influencer-partnerships" ? ["Approved Influencer Partnerships playbook:", INFLUENCER_PLAYBOOK] : []),
    department.slug === "backend-engineering"
      ? "For backend tasks, provide a concise implementation plan and, when useful, exactly one PostgreSQL statement in a ```sql code block. The user can explicitly confirm execution through the dashboard. Do not claim SQL ran, data changed, or database access occurred unless the user supplies the result. Never include multiple statements, role changes, grants, ALTER SYSTEM, COPY PROGRAM, or secret-exfiltration queries."
      : department.slug === "cyber-security"
        ? "For security work, provide defensive analysis, safe checklists, incident triage, and human-approved remediation plans for the configured site only. You have no direct tools in this chat: do not claim to have scanned, tested, accessed logs, changed infrastructure, rotated secrets, blocked traffic, or sent an alert. Refuse exploit development, intrusion, credential theft, evasion, destructive commands, or reconnaissance outside the explicitly approved target."
        : department.slug === "influencer-partnerships"
          ? "Use the approved playbook as the source of truth for Spiritual AI referral guidance. When asked to contact a creator, draft a concise professional message and explicitly label it as a draft requiring the exact-recipient, consent/platform, suppression, and human-approval checks before sending. Check that commercial terms are current before presenting them as final."
          : department.slug === "seo-geo-aeo"
            ? "For SEO work, when this request is running through Codex and the OpenSEO MCP server is connected, use OpenSEO tools for evidence-backed keyword, SERP, competitor, backlink, rank, and Search Console research. If OpenSEO is unavailable, say so instead of inventing data. You may prepare briefs, metadata, structured-data drafts, and prioritized recommendations; never claim that production content, indexing, credentials, or CMS changes were published without explicit human approval and a verified execution result."
          : department.slug === "market-research"
            ? "For market research, direct the user to the Market Research workspace for live multi-source collection. In this chat, do not claim to have searched Reddit, LinkedIn, X, news, research papers, or any other source; distinguish assumptions from evidence and recommend the exact sources needed."
          : "This is an advisory chat only. You have no tools in this conversation and cannot claim to have contacted people, changed systems, published content, spent or moved money, accessed private data, or completed external actions.",
    "Give practical, truthful answers. Clearly distinguish known facts from assumptions. Ask for missing context when needed. Refuse requests that evade law, consent, platform policy, privacy, safety, or required human approval.",
    ...(mode === "lead_generation" ? ["Lead-generation mode: treat the user's message as the single search objective. Break the work into hunter, verification, enrichment, qualification, scoring, deduplication, CSV, and personalization stages. This chat has no search, enrichment, verification, queue, database, or export tools, so do not claim that leads were found or processed; provide an executable plan and explicitly identify the missing configured integrations."] : []),
  ];
  return instructions.join("\n");
}

function errorResponse(error: unknown) {
  if (error instanceof ProviderConfigurationError) {
    return NextResponse.json({ error: "That model provider is not configured on the server." }, { status: 503 });
  }
  if (error instanceof ProviderRequestError) {
    const status = error.status === 429 ? 429 : 502;
    return NextResponse.json({ error: status === 429 ? "The model provider rate limit was reached. Try again shortly." : "The configured model provider could not complete the request." }, { status });
  }
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return NextResponse.json({ error: "The model did not respond within 45 seconds." }, { status: 504 });
  }
  return NextResponse.json({ error: "The model request failed without producing a reply." }, { status: 502 });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!isClerkConfigured()) {
    return NextResponse.json({ error: "Authentication is not configured. Add Clerk keys before using AI chat." }, { status: 503 });
  }
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Sign in to use department chat." }, { status: 401 });

  if (!sameOrigin(request)) return NextResponse.json({ error: "Cross-origin chat requests are not allowed." }, { status: 403 });
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "Content-Type must be application/json." }, { status: 415 });
  }
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) return NextResponse.json({ error: "The chat request is too large." }, { status: 413 });
  if (isRateLimited(clientKey(request))) return NextResponse.json({ error: "Too many chat requests. Try again in one minute." }, { status: 429 });

  const { slug } = await params;
  const department = getDepartment(slug);
  if (!department) return NextResponse.json({ error: "Department not found." }, { status: 404 });

  let rawBody: unknown;
  try {
    const bodyText = await request.text();
    if (Buffer.byteLength(bodyText, "utf8") > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "The chat request is too large." }, { status: 413 });
    }
    rawBody = JSON.parse(bodyText);
  } catch {
    return NextResponse.json({ error: "The request body is not valid JSON." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(rawBody);
  if (!parsed.success) return NextResponse.json({ error: "The chat request is invalid." }, { status: 400 });

  const provider = parsed.data.provider as ModelProviderId;
  const securityEvidence = department.slug === "cyber-security" ? await getSecurityEvidence() : [];
  const evidenceContext = securityEvidence.length
    ? ["Live read-only connector evidence (may be incomplete; never expose secret values):", ...securityEvidence.map((finding) => `- [${finding.severity}] ${finding.source}: ${finding.title} — ${finding.detail}${finding.url ? ` (${finding.url})` : ""}`)].join("\n")
    : "No live security connector findings are available. Do not claim a connector was queried or a finding exists.";
  if (provider === "codex") {
    try {
      const result = await completeWithCodexCli({
        prompt: [
          systemInstruction(department, parsed.data.mode),
          ...(department.slug === "cyber-security" ? [evidenceContext] : []),
          "The following is an advisory conversation. Reply only to the final user message using the prior messages as context.",
          ...parsed.data.messages.map((message) => `${message.role.toUpperCase()}: ${message.content}`),
        ].join("\n\n"),
        model: parsed.data.model,
        timeoutMs: 90_000,
      });
      return NextResponse.json({
        message: result.text,
        provider: result.provider,
        model: result.model,
        usage: {},
      }, { headers: { "cache-control": "no-store" } });
    } catch (error) {
      console.error("Codex advisory chat failed", error);
      return NextResponse.json({ error: "The local ChatGPT/Codex connection could not complete the request." }, { status: 502 });
    }
  }
  const config = allProviderConfigs().find((item) => item.id === provider);
  if (!config?.enabled) return NextResponse.json({ error: "That model provider is not configured on the server." }, { status: 503 });

  const model = parsed.data.model || config.defaultModel;
  if (!model) return NextResponse.json({ error: "No model is configured for that provider." }, { status: 503 });

  try {
    const result = await new ModelGateway([config]).complete({
      provider,
      model,
      messages: [
        { role: "system", content: systemInstruction(department, parsed.data.mode) },
        ...(department.slug === "cyber-security" ? [{ role: "system" as const, content: evidenceContext }] : []),
        ...parsed.data.messages,
      ],
      temperature: 0.3,
      maxTokens: 1_024,
      timeoutMs: 45_000,
      metadata: { department: department.slug },
    });
    const message = result.text.trim();
    if (!message) return NextResponse.json({ error: "The model returned an empty reply." }, { status: 502 });

    return NextResponse.json({
      message,
      provider: result.provider,
      model: result.model,
      usage: result.usage,
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
