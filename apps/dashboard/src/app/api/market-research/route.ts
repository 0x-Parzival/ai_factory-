import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { FirecrawlConnector, type FirecrawlPayload } from "@ai-factory/integrations/firecrawl";
import { allProviderConfigs } from "@ai-factory/integrations/config";
import { ModelGateway } from "@ai-factory/integrations/model-gateway";
import type { BusinessAction } from "@ai-factory/integrations/actions";
import { isClerkConfigured } from "@/lib/auth-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({ question: z.string().trim().min(8).max(1_000) });
const SOURCES = [
  { id: "reddit", label: "Reddit", domains: ["reddit.com"] },
  { id: "linkedin", label: "LinkedIn", domains: ["linkedin.com"] },
  { id: "x", label: "X / Twitter", domains: ["x.com", "twitter.com"] },
  { id: "news", label: "News and web", domains: undefined },
  { id: "video", label: "YouTube", domains: ["youtube.com"] },
  { id: "communities", label: "Product Hunt and Hacker News", domains: ["producthunt.com", "news.ycombinator.com"] },
  { id: "open-source", label: "GitHub", domains: ["github.com"] },
  { id: "research", label: "Research papers", domains: ["scholar.google.com", "arxiv.org", "semanticscholar.org", "pubmed.ncbi.nlm.nih.gov"] },
] as const;
const requestsByUser = new Map<string, number[]>();

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

function action(source: string, payload: FirecrawlPayload): BusinessAction<FirecrawlPayload> {
  return {
    id: crypto.randomUUID(), organizationId: "dashboard", departmentId: "market-research", taskId: `market-research-${crypto.randomUUID()}`,
    kind: "research.read", payload: { ...payload, source }, idempotencyKey: crypto.randomUUID(), requestedBy: "dashboard", requestedAt: new Date(),
  };
}

export async function POST(request: NextRequest) {
  if (!isClerkConfigured()) return NextResponse.json({ error: "Authentication is not configured." }, { status: 503 });
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Sign in to run market research." }, { status: 401 });
  if (!sameOrigin(request)) return NextResponse.json({ error: "Cross-origin research requests are not allowed." }, { status: 403 });
  const recent = (requestsByUser.get(userId) || []).filter((timestamp) => Date.now() - timestamp < 60_000);
  if (recent.length >= 3) return NextResponse.json({ error: "Research is limited to three runs per minute." }, { status: 429 });
  recent.push(Date.now()); requestsByUser.set(userId, recent);

  let body: unknown;
  try {
    const text = await request.text();
    if (Buffer.byteLength(text, "utf8") > 8_192) return NextResponse.json({ error: "The research request is too large." }, { status: 413 });
    body = JSON.parse(text);
  } catch { return NextResponse.json({ error: "The request body is not valid JSON." }, { status: 400 }); }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Ask a research question between 8 and 1,000 characters." }, { status: 400 });
  if (!process.env.FIRECRAWL_API_KEY) return NextResponse.json({ error: "Connect Firecrawl before running multi-source research." }, { status: 503 });

  const crawler = new FirecrawlConnector(process.env.FIRECRAWL_API_KEY);
  const searches = await Promise.all(SOURCES.map(async (source) => {
    try {
      const result = await crawler.execute(action(source.id, {
        operation: "search", query: `${parsed.data.question} market research customer insight trends evidence`, limit: 5, includeDomains: source.domains ? [...source.domains] : undefined,
      }));
      return { source: source.label, result };
    } catch (error) {
      return { source: source.label, error: error instanceof Error ? error.message : "Source search failed" };
    }
  }));
  const evidence = searches.filter((item) => !item.error).map((item) => `${item.source}: ${JSON.stringify(item.result).slice(0, 14_000)}`).join("\n\n");
  if (!evidence) return NextResponse.json({ error: "All configured research sources failed. Check Firecrawl and try again.", sources: searches }, { status: 502 });

  const hermes = allProviderConfigs().find((config) => config.id === "hermes");
  if (!hermes?.enabled || !hermes.defaultModel) return NextResponse.json({ error: "Configure HERMES_BASE_URL and HERMES_MODEL before synthesizing research." }, { status: 503 });
  try {
    const result = await new ModelGateway([hermes]).complete({
      provider: "hermes", model: hermes.defaultModel, temperature: 0.2, maxTokens: 2_048, timeoutMs: 90_000,
      metadata: { department: "market-research" },
      messages: [
        { role: "system", content: "You are a rigorous market researcher. Synthesize only from the supplied public-web evidence. Label direct evidence, source claims, and inference separately. Note missing sources, contradictions, recency, sample bias, and confidence. Never invent citations or claim private access. Return: executive answer, key insights, audience/user needs, market signals, competing viewpoints, evidence table with source labels and URLs when present, recommended actions, and open questions." },
        { role: "user", content: `Research question:\n${parsed.data.question}\n\nCollected evidence:\n${evidence}` },
      ],
    });
    return NextResponse.json({ question: parsed.data.question, insight: result.text, sources: searches.map(({ source, error }) => ({ source, ok: !error, error })) }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Hermes could not synthesize the research.", sources: searches }, { status: 502 });
  }
}
