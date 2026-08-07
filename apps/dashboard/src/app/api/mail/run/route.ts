import { NextRequest, NextResponse } from "next/server";

import { lifecycleCandidates, sendLifecycleMail } from "@/lib/mail-department";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const secret = process.env.MAIL_AUTOMATION_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const scan = await lifecycleCandidates();
    if (!scan.connected) return NextResponse.json({ error: scan.detail || "Database is not connected." }, { status: 503 });
    const results = await Promise.allSettled(scan.candidates.map((candidate) => sendLifecycleMail(candidate)));
    const sent = results.filter((result) => result.status === "fulfilled" && !result.value.skipped).length;
    const skipped = results.filter((result) => result.status === "fulfilled" && result.value.skipped).length;
    const failed = results.filter((result) => result.status === "rejected").length;
    return NextResponse.json({ scanned: scan.candidates.length, sent, skipped, failed }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message.slice(0, 500) : "Mail automation failed." }, { status: 502 });
  }
}
