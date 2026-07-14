"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Workflow, ShieldCheck, Target, HeartHandshake } from "lucide-react";

const workflowAreas = [
  { name: "Sales Follow-up", icon: Target },
  { name: "Seeker Onboarding", icon: HeartHandshake },
  { name: "Content Approval", icon: ShieldCheck },
];

export default function WorkflowsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Workflows</h1>
          <p className="mt-1 text-muted-foreground">
            Build real approval-based automations for sales, guidance, content, and care.
          </p>
        </div>
        <Button>Create Workflow</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {workflowAreas.map((area) => (
          <Card key={area.name}>
            <CardContent className="flex items-center justify-between gap-4 pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <area.icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">{area.name}</p>
                  <p className="text-sm text-muted-foreground">0 active workflows</p>
                </div>
              </div>
              <Badge variant="secondary">Not configured</Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workflow Runs</CardTitle>
        </CardHeader>
        <CardContent className="py-12 text-center">
          <Workflow className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-medium">No workflow runs yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Real run history, approvals, failures, and handoffs will appear here after the first workflow is created.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
