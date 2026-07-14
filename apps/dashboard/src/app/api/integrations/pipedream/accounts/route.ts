import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { isClerkConfigured } from "@/lib/auth-config";
import { getPipedreamClient, isPipedreamConfigured, pipedreamExternalUserId } from "@/lib/pipedream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isClerkConfigured()) return NextResponse.json({ error: "Secure login must be configured first." }, { status: 503 });
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Sign in to view connected accounts." }, { status: 401 });
  if (!isPipedreamConfigured()) return NextResponse.json({ configured: false, accounts: [] }, { headers: { "cache-control": "no-store" } });

  try {
    const page = await getPipedreamClient().accounts.list({
      externalUserId: pipedreamExternalUserId(userId),
      includeCredentials: false,
      limit: 100,
    });
    const accounts = [] as Array<Record<string, unknown>>;
    for await (const account of page) {
      accounts.push({
        id: account.id,
        name: account.name || account.app?.name || "Connected account",
        app: account.app?.nameSlug || account.app?.name || "unknown",
        appName: account.app?.name || "Connected platform",
        healthy: account.healthy !== false && !account.dead,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
        scopes: account.authorizedScopes || [],
      });
      if (accounts.length >= 100) break;
    }
    return NextResponse.json({ configured: true, accounts }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("Pipedream account listing failed", error);
    return NextResponse.json({ error: "Could not read connected account status." }, { status: 502 });
  }
}
