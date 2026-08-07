import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { isClerkConfigured } from "@/lib/auth-config";
import { readNeonTable } from "@/lib/neon-readonly";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({ schema: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/), table: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/) });

export async function POST(request: NextRequest) {
  if (!isClerkConfigured()) return NextResponse.json({ error: "Authentication is not configured." }, { status: 503 });
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Sign in to view database data." }, { status: 401 });
  if (request.headers.get("origin") && request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  const body = requestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid data explorer request." }, { status: 400 });
  try {
    return NextResponse.json(await readNeonTable(body.data.schema, body.data.table), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message.slice(0, 500) : "Unable to load database data." }, { status: 502 });
  }
}
