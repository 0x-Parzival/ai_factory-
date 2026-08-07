import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Bot,
  BrainCircuit,
  ListChecks,
  Unplug,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DepartmentChat } from "@/components/department-chat";
import { BackendEngineeringConsole } from "@/components/backend-engineering-console";
import { SalesChannelMatrix } from "@/components/sales-channel-matrix";
import { LeadGenerationConsole } from "@/components/lead-generation-console";
import { isClerkConfigured } from "@/lib/auth-config";
import { DEPARTMENTS, getDepartment, MODEL_PROVIDERS } from "@/lib/factory-blueprints";
import { getProviderRuntimeStatus, getWorkerRuntimeStatus } from "@/lib/factory-runtime";
import { getOpenOutreachStatus } from "@/lib/openoutreach";
import { SecurityOperationsConsole } from "@/components/security-operations-console";
import { AnalyticsWorkspace } from "@/components/analytics-workspace";
import { MailOperationsConsole } from "@/components/mail-operations-console";
import { isPipedreamConfigured } from "@/lib/pipedream";
import { OpenSeoConsole } from "@/components/open-seo-console";
import { MarketResearchWorkspace } from "@/components/market-research-workspace";

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
    "backend-engineering": "backend_engineering",
    "legal-compliance": "legal",
    "data-analytics": "data_analytics",
    "seo-geo-aeo": "seo_geo_aeo",
    "cyber-security": "cyber_security",
  } as Record<string, string>)[department.slug] || department.slug;
  const departmentAgent = workerStatus?.agents?.find((agent) => agent.departmentId === runtimeId);
  const authenticationConfigured = isClerkConfigured();
  const agentDeployed = Boolean(departmentAgent);
  const agentWorking = departmentAgent?.status === "running";
  const agentQueued = departmentAgent?.status === "queued";

  if (department.slug === "sales") {
    return (
      <div className="mx-auto max-w-[1500px] space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant="outline">Sales workspace</Badge>
              <Badge variant={chatProviders.length ? "success" : "secondary"}>{chatProviders.length ? `${chatProviders.length} AI provider${chatProviders.length === 1 ? "" : "s"} ready` : "Connect an AI provider"}</Badge>
              {outreachStatus && <Badge variant={outreachStatus.reachable ? "success" : "secondary"}>{outreachStatus.reachable ? "Outreach service online" : outreachStatus.configured ? "Outreach service offline" : "Outreach setup required"}</Badge>}
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Sales</h1>
            <p className="mt-2 max-w-3xl text-muted-foreground">Use the AI to research and draft. External sending stays approval-controlled until the outreach service, sender identity, and consent checks are ready.</p>
          </div>
          <Button asChild variant="outline"><Link href="/dashboard/connectors">Configure sales services</Link></Button>
        </div>
        <LeadGenerationConsole providers={chatProviders} authenticationConfigured={authenticationConfigured} />
        <DepartmentChat departmentSlug={department.slug} departmentName={department.name} providers={chatProviders} authenticationConfigured={authenticationConfigured} />
        {outreachStatus && <SalesChannelMatrix outreach={outreachStatus} />}
      </div>
    );
  }

  if (department.slug === "backend-engineering") {
    return <BackendEngineeringConsole providers={chatProviders} authenticationConfigured={authenticationConfigured} />;
  }
  if (department.slug === "cyber-security") {
    return <SecurityOperationsConsole providers={chatProviders} authenticationConfigured={authenticationConfigured} />;
  }
  if (department.slug === "data-analytics") {
    return (
      <div className="mx-auto max-w-[1500px] space-y-6">
        <AnalyticsWorkspace authenticationConfigured={authenticationConfigured} gatewayConfigured={isPipedreamConfigured()} />
        <DepartmentChat
          departmentSlug={department.slug}
          departmentName="AI Data Analyst"
          providers={chatProviders}
          authenticationConfigured={authenticationConfigured}
        />
      </div>
    );
  }
  if (department.slug === "mail") {
    return <MailOperationsConsole authenticationConfigured={authenticationConfigured} />;
  }
  if (department.slug === "seo-geo-aeo") {
    return (
      <div className="mx-auto max-w-[1500px] space-y-6">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-3 mb-3"><Link href="/dashboard/departments"><ArrowLeft className="mr-2 h-4 w-4" />All departments</Link></Button>
          <Badge variant="outline">SEO, GEO & AEO</Badge>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Search growth</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">Use OpenSEO evidence with Codex to research opportunities and prepare changes for approval.</p>
        </div>
        <OpenSeoConsole />
        <DepartmentChat departmentSlug={department.slug} departmentName={department.name} providers={chatProviders} authenticationConfigured={authenticationConfigured} />
      </div>
    );
  }
  if (department.slug === "market-research") {
    return <MarketResearchWorkspace providers={chatProviders} authenticationConfigured={authenticationConfigured} />;
  }

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
          <Button asChild variant="outline"><Link href="/dashboard/providers"><BrainCircuit className="mr-2 h-4 w-4" />Choose provider</Link></Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {[
          { label: "Agents", value: agentDeployed ? "1" : "0", note: departmentAgent ? `${departmentAgent.provider} · ${departmentAgent.model}` : "None deployed", icon: Bot },
          { label: "Active tasks", value: agentWorking ? "1" : "0", note: agentWorking ? "Working now" : agentQueued ? "1 task queued" : "Queue clear", icon: ListChecks },
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
