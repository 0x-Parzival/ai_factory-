import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { isClerkConfigured } from "@/lib/auth-config";
import {
  getPipedreamClient,
  isAllowedPipedreamApp,
  isPipedreamConfigured,
  pipedreamExternalUserId,
  safeDashboardOrigin,
  validatePipedreamConnectUrl,
} from "@/lib/pipedream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isClerkConfigured()) return NextResponse.json({ error: "Secure login must be configured first." }, { status: 503 });
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Sign in to connect an account." }, { status: 401 });
  if (!isPipedreamConfigured()) return NextResponse.json({ error: "Pipedream Connect is not configured on the server." }, { status: 503 });
  if (request.headers.get("origin") && request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Cross-origin connection requests are not allowed." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({})) as { app?: unknown };
  if (typeof body.app !== "string" || !isAllowedPipedreamApp(body.app)) {
    return NextResponse.json({ error: "That platform is not in the approved connector catalog." }, { status: 400 });
  }

  try {
    const origin = safeDashboardOrigin();
    const success = new URL("/dashboard/connectors", origin);
    success.searchParams.set("connected", body.app);
    const failure = new URL("/dashboard/connectors", origin);
    failure.searchParams.set("connection_error", body.app);
    const token = await getPipedreamClient().tokens.create({
      externalUserId: pipedreamExternalUserId(userId),
      expiresIn: 900,
      scope: "connect:accounts:read connect:accounts:write",
      allowedOrigins: [origin],
      successRedirectUri: success.toString(),
      errorRedirectUri: failure.toString(),
      allowProgressiveScopes: true,
    });
    return NextResponse.json({
      url: validatePipedreamConnectUrl(token.connectLinkUrl, body.app),
      expiresAt: token.expiresAt,
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("Pipedream connect link creation failed", error);
    return NextResponse.json({ error: "Could not start the secure platform connection." }, { status: 502 });
  }
}
