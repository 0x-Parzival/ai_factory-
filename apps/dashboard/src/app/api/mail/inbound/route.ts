import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { addMailLog, inboundLog } from "@/lib/mail-department";
export const runtime = "nodejs";
const inboundSchema = z.object({ from: z.string().email(), subject: z.string().max(500).optional(), text: z.string().max(20_000).optional(), id: z.string().max(500).optional() });
export async function POST(request: NextRequest) {
  const secret = process.env.MAIL_INBOUND_WEBHOOK_SECRET; if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = inboundSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Invalid inbound email payload." }, { status: 400 });
  await addMailLog(inboundLog({ from: parsed.data.from, subject: parsed.data.subject, text: parsed.data.text, providerId: parsed.data.id })); return NextResponse.json({ accepted: true });
}
