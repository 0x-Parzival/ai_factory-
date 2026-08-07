import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { isClerkConfigured } from "@/lib/auth-config";
import { executeNeonSql, hasEngineeringDatabaseAccess } from "@/lib/neon-readonly";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({ sql: z.string().trim().min(1).max(20_000), confirmWrite: z.literal(true).optional() });
const readOnlyStart = /^(select|with|show|explain|values)\b/i;
const blocked = /\b(copy\s+.+\s+program|alter\s+system|create\s+(role|user)|set\s+role|grant\s+.+\s+to|revoke\s+.+\s+from)\b/i;

export async function POST(request: NextRequest) {
  if (!isClerkConfigured()) return NextResponse.json({ error: "Authentication is not configured." }, { status: 503 });
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Sign in to use the engineering workspace." }, { status: 401 });
  if (request.headers.get("origin") && request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  const body = requestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Enter one SQL statement up to 20,000 characters." }, { status: 400 });
  const sql = body.data.sql.replace(/;\s*$/, "");
  if (sql.includes(";") || blocked.test(sql)) return NextResponse.json({ error: "This SQL form does not allow multiple statements, role changes, grants, ALTER SYSTEM, or COPY PROGRAM." }, { status: 400 });
  const readOnly = readOnlyStart.test(sql);
  if (!readOnly && (!body.data.confirmWrite || !(await hasEngineeringDatabaseAccess()))) {
    return NextResponse.json({ error: "Writing requires an engineering database connection and explicit Apply confirmation." }, { status: 403 });
  }
  try {
    const result = await executeNeonSql(sql);
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message.slice(0, 500) : "Database execution failed." }, { status: 502 });
  }
}
