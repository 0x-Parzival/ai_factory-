import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { isClerkConfigured } from "@/lib/auth-config";
import { lifecycleCandidates, mailLogs, sendLifecycleMail, type MailCandidate } from "@/lib/mail-department";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const candidateSchema = z.object({ id: z.string().max(500), email: z.string().email(), name: z.string().max(160).optional(), event: z.enum(["recommendation", "trial_ready", "trial_ended", "purchase_started", "product_ready", "subscription_review"]), product: z.string().max(500).optional(), accessUrl: z.string().max(2_000).optional(), reason: z.string().max(500) });

async function guarded(request: NextRequest) {
  if (!isClerkConfigured()) return NextResponse.json({ error: "Authentication is not configured." }, { status: 503 });
  if (!(await auth()).userId) return NextResponse.json({ error: "Sign in to use the Mail department." }, { status: 401 });
  if (request.headers.get("origin") && request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  return null;
}
export async function GET(request: NextRequest) { const error = await guarded(request); if (error) return error; const [scan, logs] = await Promise.all([lifecycleCandidates(), mailLogs()]); return NextResponse.json({ ...scan, logs }, { headers: { "cache-control": "no-store" } }); }
export async function POST(request: NextRequest) { const error = await guarded(request); if (error) return error; const parsed = candidateSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Invalid lifecycle event." }, { status: 400 }); try { return NextResponse.json(await sendLifecycleMail(parsed.data as MailCandidate)); } catch (cause) { return NextResponse.json({ error: cause instanceof Error ? cause.message : "Unable to send mail." }, { status: 502 }); } }
