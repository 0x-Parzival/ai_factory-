import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OpenOutreachStatus } from "@/lib/openoutreach";

export function SalesChannelMatrix({ outreach }: { outreach: OpenOutreachStatus }) {
  return (
    <div className="space-y-6">
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Approval-first email engine</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Pinned Spiritual AI OpenOutreach service. Research and drafting can run while the external-send switch remains off.</p>
          </div>
          <Badge variant={outreach.reachable ? "success" : "secondary"}>{outreach.reachable ? "Service reachable" : outreach.configured ? "Service offline" : "Setup required"}</Badge>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {[
            ["Mailboxes", outreach.mailboxes],
            ["Ready leads", outreach.readyLeads],
            ["Pending approval", outreach.pendingApprovals],
            ["Human review", outreach.humanReviews],
            ["Suppressed", outreach.suppressedRecipients],
            ["Sent today", outreach.sentToday],
          ].map(([label, value]) => <div key={String(label)} className="rounded-lg border bg-background/70 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-bold tabular-nums">{value}</p></div>)}
          <div className="sm:col-span-2 xl:col-span-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background/70 p-3">
            <p className="text-sm">External sending: <span className="font-semibold">{outreach.externalSendsEnabled ? "enabled" : "off"}</span> · Sender identity: <span className="font-semibold">{outreach.senderIdentityComplete ? "complete" : "incomplete"}</span></p>
            <Button asChild size="sm" variant="outline"><Link href="/dashboard/connectors">Open activation checklist<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
