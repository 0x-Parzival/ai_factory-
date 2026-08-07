import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, Layers3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BusinessDiscussionRoom } from "@/components/business-discussion-room";
import { isClerkConfigured } from "@/lib/auth-config";
import { DEPARTMENTS, MODEL_PROVIDERS } from "@/lib/factory-blueprints";
import { getProviderRuntimeStatus } from "@/lib/factory-runtime";

export const dynamic = "force-dynamic";

export default async function DepartmentsPage() {
  const providerStatus = await getProviderRuntimeStatus();
  const providers = providerStatus.filter((provider) => provider.configured && (provider.reachable || !["ollama", "hermes"].includes(provider.id))).map((provider) => ({
    id: provider.id,
    name: MODEL_PROVIDERS.find((definition) => definition.id === provider.id)?.name || provider.id,
    models: provider.models,
  }));

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Departments</h1>
          <p className="mt-1 max-w-3xl text-muted-foreground">
            Define what each department may do, which systems it can access, where human approval is mandatory, and which autonomous loops it may run.
          </p>
        </div>
        <Button asChild variant="outline"><Link href="/dashboard/providers">Review model providers</Link></Button>
      </div>

      <BusinessDiscussionRoom providers={providers} authenticationConfigured={isClerkConfigured()} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {DEPARTMENTS.map((department) => (
          <Card key={department.slug} className="flex flex-col">
            <CardHeader>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {department.slug === "ceo-orchestrator" ? <Layers3 className="h-5 w-5" /> : <BriefcaseBusiness className="h-5 w-5" />}
                </div>
              </div>
              <CardTitle className="text-lg">{department.name}</CardTitle>
              <p className="text-sm leading-6 text-muted-foreground">{department.purpose}</p>
            </CardHeader>
            <CardContent className="mt-auto space-y-4">
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
