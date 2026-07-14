"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldCheck, FileCheck2, AlertTriangle, History } from "lucide-react";
import { COMPANY_MISSION } from "@/lib/company-mission";

const controls = [
  { name: "Human Approval", icon: FileCheck2 },
  { name: "Sensitive Topic Escalation", icon: AlertTriangle },
  { name: "Audit History", icon: History },
];

export default function GovernancePage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Governance</h1>
          <p className="mt-1 text-muted-foreground">
            Configure real approval, safety, and audit controls before activating agents.
          </p>
        </div>
        <Button>Configure Governance</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {controls.map((control) => (
          <Card key={control.name}>
            <CardContent className="flex items-center justify-between gap-4 pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <control.icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">{control.name}</p>
                  <p className="text-sm text-muted-foreground">0 rules active</p>
                </div>
              </div>
              <Badge variant="secondary">Not configured</Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardHeader><CardTitle>CEO may run autonomously</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {COMPANY_MISSION.ceoAutonomy.map((item) => <div key={item} className="flex items-start gap-2 text-sm leading-6"><ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-emerald-400" /><span>{item}</span></div>)}
          </CardContent>
        </Card>
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader><CardTitle>Owner action or explicit approval required</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {COMPANY_MISSION.neverAutonomous.map((item) => <div key={item} className="flex items-start gap-2 text-sm leading-6"><AlertTriangle className="mt-1 h-4 w-4 shrink-0 text-amber-400" /><span>{item}</span></div>)}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Safety and Audit Log</CardTitle>
        </CardHeader>
        <CardContent className="py-12 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-medium">No governance events yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Real approvals, escalations, policy changes, and audit events will appear here after agents and workflows are active.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
