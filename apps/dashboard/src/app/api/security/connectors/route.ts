import { NextResponse } from "next/server";

import { getSecurityConnectorStatus } from "@/lib/security-connectors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getSecurityConnectorStatus(), { headers: { "cache-control": "no-store" } });
}
