import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Bot,
  BrainCircuit,
  CircleDollarSign,
  Clock3,
  DatabaseZap,
  ListChecks,
  Power,
  ShieldAlert,
  Unplug,
  Workflow,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DepartmentChat } from "@/components/department-chat";
import { SalesChannelMatrix } from "@/components/sales-channel-matrix";
import { isClerkConfigured } from "@/lib/auth-config";
import { DEPARTMENTS, getDepartment, MODEL_PROVIDERS } from "@/lib/factory-blueprints";
import { getProviderRuntimeStatus, getWorkerRuntimeStatus } from "@/lib/factory-runtime";
import { getOpenOutreachStatus } from "@/lib/openoutreach";

export function generateStaticParams() {
  return DEPARTMENTS.map((department) => ({ slug: department.slug }));
}

export default async function DepartmentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const department = getDepartment(slug);

  if (!department) notFound();

  const [providerStatus, workerStatus, outreachStatus] = await Promise.all([
    getProviderRuntimeStatus(),
    getWorkerRuntimeStatus(),
    department.slug === "sales" ? getOpenOutreachStatus() : Promise.resolve(undefined),
  ]);
  const connectedProviders = providerStatus.filter((provider) => provider.configured && provider.reachable);
  const chatProviders = providerStatus.filter((provider) =>
    provider.configured && (provider.reachable || (provider.id !== "ollama" && provider.id !== "hermes")),
  ).map((provider) => ({
    id: provider.id,
    name: MODEL_PROVIDERS.find((blueprint) => blueprint.id === provider.id)?.name || provider.id,
    models: provider.id === workerStatus?.provider && provider.models.includes(workerStatus.model)
      ? [workerStatus.model, ...provider.models.filter((model) => model !== workerStatus.model)]
      : provider.models,
  }));
  const runtimeId = ({
    "ceo-orchestrator": "ceo",
    "customer-care": "customer_care",
    "product-management": "product",
    "legal-compliance": "legal",
    "data-analytics": "data_analytics",
    "seo-geo-aeo": "seo_geo_aeo",
  } as Record<string, string>)[department.slug] || department.slug;
  const departmentAgent = workerStatus?.agents?.find((agent) => agent.departmentId === runtimeId);
  const authenticationConfigured = isClerkConfigured();
  const agentDeployed = Boolean(departmentAgent);
  const agentWorking = departmentAgent?.status === "running";
  const agentQueued = departmentAgent?.status === "queued";

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-3 mb-3">
          <Link href="/dashboard/departments"><ArrowLeft className="mr-2 h-4 w-4" />All departments</Link>
        </Button>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant="outline">Department blueprint</Badge>
              {agentDeployed ? <Badge variant="success">Agent deployed</Badge> : <Badge variant="secondary" className="font-normal text-muted-foreground">Not deployed</Badge>}
            </div>
            <h1 className="text-3xl font-bold tracking-tight">{department.name}</h1>
            <p className="mt-2 max-w-3xl text-muted-foreground">{department.purpose}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><Link href="/dashboard/providers"><BrainCircuit className="mr-2 h-4 w-4" />Choose provider</Link></Button>
            <Button asChild><Link href="/dashboard/settings"><Power className="mr-2 h-4 w-4" />Configure deployment</Link></Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "Agents", value: agentDeployed ? "1" : "0", note: departmentAgent ? `${departmentAgent.provider} · ${departmentAgent.model}` : "None deployed", icon: Bot },
          { label: "Active tasks", value: agentWorking ? "1" : "0", note: agentWorking ? "Working now" : agentQueued ? "1 task queued" : "Queue clear", icon: ListChecks },
          { label: "Active loops", value: agentDeployed ? "1" : "0", note: agentDeployed ? "Recurring review active" : "Scheduler unset", icon: Workflow },
          { label: "Pending approvals", value: "0", note: "External actions disabled", icon: ShieldAlert },
          { label: "Budget", value: "Not set", note: "$0 recorded", icon: CircleDollarSign },
        ].map((metric) => (
          <Card key={metric.label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between gap-3"><p className="text-xs text-muted-foreground">{metric.label}</p><metric.icon className="h-4 w-4 text-muted-foreground" /></div>
              <p className="mt-2 text-xl font-bold">{metric.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{metric.note}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <DepartmentChat
        departmentSlug={department.slug}
        departmentName={department.name}
        providers={chatProviders}
        authenticationConfigured={authenticationConfigured}
      />

      {department.slug === "sales" && outreachStatus && <SalesChannelMatrix outreach={outreachStatus} />}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Power className="h-5 w-5" />Defined powers</CardTitle>
            <p className="text-sm text-muted-foreground">Intended authority after systems, policies, credentials, and approvals are configured.</p>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {department.powers.map((power, index) => (
                <li key={power} className="flex gap-3 rounded-lg border p-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{index + 1}</span>
                  <span className="text-sm leading-6">{power}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><DatabaseZap className="h-5 w-5" />Required systems</CardTitle>
            <p className="text-sm text-muted-foreground">Connection requirements, not detected integrations.</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {department.requiredSystems.map((system) => (
              <div key={system} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
                <span className="text-sm font-medium">{system}</span>
                <Badge variant="secondary" className="font-normal text-muted-foreground"><Unplug className="mr-1 h-3 w-3" />Not connected</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Workflow className="h-5 w-5" />Autonomous loop designs</CardTitle>
            <p className="text-sm text-muted-foreground">{agentDeployed ? "Recurring internal reviews run with limits, idempotency, retries, and stop controls." : "Blueprints remain inactive until triggers, limits, stop conditions, and runtime are configured."}</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {department.loopBlueprints.map((loop) => (
              <div key={loop} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div className="flex items-center gap-3"><Clock3 className="h-4 w-4 text-muted-foreground" /><span className="text-sm font-medium">{loop}</span></div>
                {agentDeployed ? <Badge variant="success">Active</Badge> : <Badge variant="outline" className="font-normal text-muted-foreground">Inactive</Badge>}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5" />Mandatory approval boundaries</CardTitle>
            <p className="text-sm text-muted-foreground">The runtime enforces these gates before high-risk actions; external actions are disabled in the local worker.</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {department.approvalBoundaries.map((boundary) => (
              <div key={boundary} className="flex items-start gap-3 rounded-lg border p-3">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <span className="text-sm leading-5">{boundary}</span>
              </div>
            ))}
            <Button asChild variant="outline" className="mt-2 w-full"><Link href="/dashboard/governance">Configure governance</Link></Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2"><BrainCircuit className="h-5 w-5" />Model routing</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">This department may be routed to any configured provider. Reachability is checked server-side.</p>
          </div>
          <Badge variant="secondary" className="text-muted-foreground">{connectedProviders.length} / {MODEL_PROVIDERS.length}</Badge>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {MODEL_PROVIDERS.map((provider) => {
              const runtimeStatus = providerStatus.find((status) => status.id === provider.id);
              const connected = Boolean(runtimeStatus?.configured && runtimeStatus.reachable);
              return (
                <div key={provider.id} className="flex items-center justify-between gap-2 rounded-lg border p-3">
                  <span className="text-sm font-medium">{provider.name}</span>
                  <span className={`h-2 w-2 shrink-0 rounded-full ${connected ? "bg-emerald-400" : "bg-muted-foreground/40"}`} aria-label={connected ? "Connected" : "Not connected"} />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Task queue</CardTitle></CardHeader>
          <CardContent className="py-10 text-center">
            <ListChecks className="mx-auto h-9 w-9 text-muted-foreground" />
            <p className="mt-3 font-medium">{departmentAgent?.currentTask || (departmentAgent?.lastTask ? "Waiting for the next loop" : "No tasks")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{departmentAgent ? `${departmentAgent.completedTasks} completed · ${departmentAgent.failedTasks} failed` : "A connected orchestrator or authorized user must create the first real task."}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Health and audit</CardTitle></CardHeader>
          <CardContent className="py-10 text-center">
            {departmentAgent ? <Bot className="mx-auto h-9 w-9 text-emerald-400" /> : <Unplug className="mx-auto h-9 w-9 text-muted-foreground" />}
            <p className="mt-3 font-medium">{departmentAgent ? `Agent ${departmentAgent.status}` : "No runtime telemetry"}</p>
            <p className="mt-1 text-sm text-muted-foreground">{departmentAgent?.lastRunAt ? `Last task update: ${new Date(departmentAgent.lastRunAt).toLocaleString()}` : "Health, failures, retries, and audit events appear only after deployment."}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
