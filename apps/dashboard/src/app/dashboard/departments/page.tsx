import Link from "next/link";
import { ArrowRight, Bot, BriefcaseBusiness, Layers3, ShieldCheck, Workflow } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DEPARTMENTS } from "@/lib/factory-blueprints";

export default function DepartmentsPage() {
  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="outline">Configuration blueprints</Badge>
            <Badge variant="secondary" className="text-muted-foreground">0 deployed</Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">AI Departments</h1>
          <p className="mt-1 max-w-3xl text-muted-foreground">
            Define what each department may do, which systems it can access, where human approval is mandatory, and which autonomous loops it may run.
          </p>
        </div>
        <Button asChild variant="outline"><Link href="/dashboard/providers">Review model providers</Link></Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {DEPARTMENTS.map((department) => (
          <Card key={department.slug} className="flex flex-col">
            <CardHeader>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {department.slug === "ceo-orchestrator" ? <Layers3 className="h-5 w-5" /> : <BriefcaseBusiness className="h-5 w-5" />}
                </div>
                <Badge variant="secondary" className="font-normal text-muted-foreground">Not configured</Badge>
              </div>
              <CardTitle className="text-lg">{department.name}</CardTitle>
              <p className="text-sm leading-6 text-muted-foreground">{department.purpose}</p>
            </CardHeader>
            <CardContent className="mt-auto space-y-4">
              <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-3 text-center">
                <div><p className="font-semibold">{department.powers.length}</p><p className="text-[11px] text-muted-foreground">Defined powers</p></div>
                <div><p className="font-semibold">{department.loopBlueprints.length}</p><p className="text-[11px] text-muted-foreground">Loop designs</p></div>
                <div><p className="font-semibold">0</p><p className="text-[11px] text-muted-foreground">Live agents</p></div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Bot className="h-3.5 w-3.5" />Provider selectable</span>
                <span className="flex items-center gap-1"><Workflow className="h-3.5 w-3.5" />Loops inactive</span>
                <span className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" />Approval rules unset</span>
              </div>
              <Button asChild variant="outline" className="w-full">
                <Link href={`/dashboard/departments/${department.slug}`}>Open department <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

