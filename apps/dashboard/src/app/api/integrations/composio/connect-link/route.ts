import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { isClerkConfigured } from "@/lib/auth-config";
import { createComposioConnectLink, dashboardOrigin, isAllowedComposioToolkit, isComposioConfigured } from "@/lib/composio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isClerkConfigured()) return NextResponse.json({ error: "Secure login must be configured first." }, { status: 503 });
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Sign in to connect an account." }, { status: 401 });
  if (!isComposioConfigured()) return NextResponse.json({ error: "Composio is not configured on the server." }, { status: 503 });
  if (request.headers.get("origin") && request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ error: "Cross-origin connection requests are not allowed." }, { status: 403 });
  const body = await request.json().catch(() => ({})) as { app?: unknown };
  if (typeof body.app !== "string" || !isAllowedComposioToolkit(body.app)) return NextResponse.json({ error: "That platform is not in the approved connector catalog." }, { status: 400 });
  try {
    const callback = new URL("/dashboard/connectors", dashboardOrigin());
    callback.searchParams.set("connected", body.app);
    const result = await createComposioConnectLink(userId, body.app, callback.toString());
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("Composio connect link creation failed", error);
    return NextResponse.json({ error: "Could not start the secure platform connection." }, { status: 502 });
  }
}
