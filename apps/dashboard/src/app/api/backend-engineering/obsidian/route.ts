import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { isClerkConfigured } from "@/lib/auth-config";
import { connectObsidianVault, obsidianSyncStatus } from "@/lib/neon-readonly";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const vaultSchema = z.object({ vaultPath: z.string().trim().min(1).max(1_000) });

async function requireOwner(request: NextRequest) {
  if (!isClerkConfigured()) return NextResponse.json({ error: "Authentication is not configured." }, { status: 503 });
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Sign in to connect Obsidian." }, { status: 401 });
  if (request.headers.get("origin") && request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  return null;
}

export async function GET(request: NextRequest) {
  const failure = await requireOwner(request);
  return failure || NextResponse.json(await obsidianSyncStatus(), { headers: { "cache-control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const failure = await requireOwner(request);
  if (failure) return failure;
  const body = vaultSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Enter the absolute server path to your Obsidian vault." }, { status: 400 });
  try { return NextResponse.json(await connectObsidianVault(body.data.vaultPath), { headers: { "cache-control": "no-store" } }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Obsidian connection failed." }, { status: 502 }); }
}
