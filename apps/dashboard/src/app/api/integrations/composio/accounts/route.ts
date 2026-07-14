import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { isClerkConfigured } from "@/lib/auth-config";
import { isComposioConfigured, listComposioAccounts } from "@/lib/composio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isClerkConfigured()) return NextResponse.json({ error: "Secure login must be configured first." }, { status: 503 });
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Sign in to view connected accounts." }, { status: 401 });
  if (!isComposioConfigured()) return NextResponse.json({ configured: false, accounts: [] }, { headers: { "cache-control": "no-store" } });
  try {
    return NextResponse.json({ configured: true, accounts: await listComposioAccounts(userId) }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("Composio account listing failed", error);
    return NextResponse.json({ error: "Could not read connected account status." }, { status: 502 });
  }
}
