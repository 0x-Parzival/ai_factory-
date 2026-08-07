import { NextResponse } from "next/server";

import { getSecuritySnapshot } from "@/lib/security-monitor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getSecuritySnapshot(), { headers: { "cache-control": "no-store" } });
}
