import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { isClerkConfigured } from "@/lib/auth-config";
import { connectNeon, neonReadonlyStatus } from "@/lib/neon-readonly";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const connectionSchema = z.object({
  databaseUrl: z.string().trim().min(20).max(4_000).url().refine(
    (value) => ["postgres:", "postgresql:"].some((protocol) => value.startsWith(protocol)),
    "Enter a PostgreSQL connection URL.",
  ),
  accessMode: z.enum(["read_only", "engineering"]).default("read_only"),
});

async function authenticated(request: NextRequest) {
  if (!isClerkConfigured()) return NextResponse.json({ error: "Authentication is not configured." }, { status: 503 });
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Sign in to configure Neon." }, { status: 401 });
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  return null;
}

export async function GET(request: NextRequest) {
  const failure = await authenticated(request);
  return failure || NextResponse.json(await neonReadonlyStatus(), { headers: { "cache-control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const failure = await authenticated(request);
  if (failure) return failure;
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "Content-Type must be application/json." }, { status: 415 });
  }
  const parsed = connectionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid PostgreSQL connection URL." }, { status: 400 });

  const status = await connectNeon(parsed.data.databaseUrl, parsed.data.accessMode);
  if (!status.connected) return NextResponse.json({ ...status, error: "Neon connection failed. Check the URL, network access, and read-only role." }, { status: 502 });
  return NextResponse.json(status, { headers: { "cache-control": "no-store" } });
}
