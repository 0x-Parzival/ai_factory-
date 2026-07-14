import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import type { NextFetchEvent, NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { isClerkConfigured } from "@/lib/auth-config";

const isProtectedRoute = createRouteMatcher(["/dashboard(.*)", "/api/(.*)"]);
const isPublicApi = createRouteMatcher(["/api/health(.*)"]);

const authenticatedMiddleware = clerkMiddleware(async (auth, request) => {
  if (isProtectedRoute(request) && !isPublicApi(request)) await auth.protect();
});

export default function middleware(request: NextRequest, event: NextFetchEvent) {
  if (isClerkConfigured()) return authenticatedMiddleware(request, event);

  // Explicit setup mode keeps configuration pages visible on localhost, while
  // ensuring AI/model operations are never anonymously exposed.
  if (request.nextUrl.pathname.startsWith("/api/") && !isPublicApi(request)) {
    return NextResponse.json(
      { error: "Authentication is not configured. Add Clerk keys before using AI APIs." },
      { status: 503 },
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
