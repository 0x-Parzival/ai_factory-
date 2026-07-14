import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  BrainCircuit,
  BriefcaseBusiness,
  CircleDollarSign,
  Clock3,
  KeyRound,
  ListChecks,
  MessageCircleMore,
  PauseCircle,
  ShieldCheck,
  Workflow,
  Target,
  UsersRound,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DEPARTMENTS, MODEL_PROVIDERS } from "@/lib/factory-blueprints";
import { getProviderRuntimeStatus, getWorkerRuntimeStatus } from "@/lib/factory-runtime";
import { COMPANY_MISSION } from "@/lib/company-mission";

function UnconfiguredBadge({ children = "Not configured" }: { children?: React.ReactNode }) {
  return <Badge variant="secondary" className="font-normal text-muted-foreground">{children}</Badge>;
}

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [providerRuntime, workerRuntime] = await Promise.all([
    getProviderRuntimeStatus(),
    getWorkerRuntimeStatus(),
  ]);
  const connectedProviders = providerRuntime.filter((provider) => provider.reachable).length;
  const workerActive = Boolean(workerRuntime);
  const liveMetrics = [
    { label: "Deployed agents", value: workerRuntime?.deployedAgents ?? 0, icon: Bot, note: workerActive ? "One local agent per department" : "No agents deployed" },
    { label: "Active loops", value: workerRuntime?.activeLoops ?? 0, icon: Workflow, note: workerActive ? "Recurring internal reviews" : "Scheduler not connected" },
    { label: "Queued tasks", value: workerRuntime?.queuedTasks ?? 0, icon: ListChecks, note: workerActive ? `${workerRuntime?.completedTasks ?? 0} completed · ${workerRuntime?.failedTasks ?? 0} failed` : "No task source connected" },
    { label: "Pending approvals", value: workerRuntime?.pendingApprovals ?? 0, icon: ShieldCheck, note: "External actions remain disabled" },
  ];
  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline">CEO control plane</Badge>
            {workerActive ? <Badge variant="success">Local worker active</Badge> : <UnconfiguredBadge>Live worker not connected</UnconfiguredBadge>}
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Spiritual AI Factory</h1>
          <p className="mt-1 max-w-3xl text-muted-foreground">
            Configure company departments, model providers, budgets, autonomous loops, and human approval boundaries from one place.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard/providers"><KeyRound className="mr-2 h-4 w-4" />Connect providers</Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/departments"><BriefcaseBusiness className="mr-2 h-4 w-4" />Configure departments</Link>
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden border-violet-500/40 bg-gradient-to-br from-violet-500/10 via-background to-cyan-500/5">
        <CardContent className="grid gap-6 pt-6 xl:grid-cols-[1.25fr_1fr]">
          <div>
            <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">Company purpose</Badge><a className="text-sm font-medium text-primary hover:underline" href={COMPANY_MISSION.website} target="_blank" rel="noreferrer">spiritualai.store ↗</a></div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">{COMPANY_MISSION.purpose}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground"><span className="font-medium text-foreground">Current objective:</span> {COMPANY_MISSION.currentObjective}</p>
            <p className="mt-3 rounded-lg border bg-background/60 p-3 text-sm leading-6 text-muted-foreground"><span className="font-medium text-foreground">CEO decision rule:</span> {COMPANY_MISSION.decisionRule}</p>
          </div>
          <div className="space-y-2">
            {COMPANY_MISSION.priorities.map((priority, index) => (
              <div key={priority} className="flex items-start gap-3 rounded-lg border bg-background/60 p-3">
                {index === 0 ? <UsersRound className="mt-0.5 h-4 w-4 shrink-0 text-violet-400" /> : <Target className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />}
                <p className="text-sm leading-5">{priority}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="flex flex-col gap-4 pt-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div>
              <p className="font-medium">{workerActive ? "Factory is running in safe internal-only mode" : "Factory is in configuration mode"}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {workerRuntime
                  ? `${workerRuntime.deployedAgents} department agents and ${workerRuntime.activeLoops} recurring loops are running on ${workerRuntime.provider} (${workerRuntime.model}). Cloud providers, outreach channels, telemetry, payments, and Telegram are not configured; external actions are disabled.`
                  : connectedProviders > 0
                  ? `${connectedProviders} model provider endpoint is reachable. The orchestrator, channels, workers, and telemetry sources are not connected; operational counts remain real zeros.`
                  : "No orchestrator, providers, channels, workers, or telemetry sources are connected. Counts below are real zeros; capabilities are blueprints only."}
              </p>
            </div>
          </div>
          <Button asChild size="sm" variant="outline" className="shrink-0">
            <Link href="/dashboard/settings">Open setup <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </CardContent>
      </Card>

      <section aria-labelledby="live-state-heading">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 id="live-state-heading" className="text-lg font-semibold">Live operating state</h2>
            <p className="text-sm text-muted-foreground">Only connected runtime data belongs here.</p>
          </div>
          <Badge variant="outline">{connectedProviders + (workerActive ? 1 : 0)} source{connectedProviders + (workerActive ? 1 : 0) === 1 ? "" : "s"} connected</Badge>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {liveMetrics.map((metric) => (
            <Card key={metric.label}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm text-muted-foreground">{metric.label}</p>
                  <metric.icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="mt-2 text-3xl font-bold tabular-nums">{metric.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{metric.note}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <section aria-labelledby="department-heading">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle id="department-heading" className="flex items-center gap-2">
                  <BriefcaseBusiness className="h-5 w-5" />Department control
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Company structure and deployment readiness.</p>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/dashboard/departments">View all <ArrowRight className="ml-1 h-4 w-4" /></Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2">
                {DEPARTMENTS.map((department) => (
                  <Link
                    href={`/dashboard/departments/${department.slug}`}
                    key={department.slug}
                    className="group rounded-lg border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-accent/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium group-hover:text-primary">{department.name}</p>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{department.purpose}</p>
                      </div>
                      <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${workerActive ? "bg-emerald-400" : "bg-muted-foreground/40"}`} aria-label={workerActive ? "Agent active" : "Not configured"} />
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{workerActive ? "1 agent · 1 recurring loop" : "0 agents · 0 tasks"}</span>
                      <span>{workerActive ? "Review →" : "Configure →"}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><BrainCircuit className="h-5 w-5" />CEO orchestrator</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                <div className="flex items-center gap-3">
                  {workerActive ? <Activity className="h-5 w-5 text-emerald-400" /> : <PauseCircle className="h-5 w-5 text-muted-foreground" />}
                  <div><p className="text-sm font-medium">Runtime</p><p className="text-xs text-muted-foreground">{workerRuntime ? `${workerRuntime.provider} · ${workerRuntime.model}` : "No worker attached"}</p></div>
                </div>
                {workerActive ? <Badge variant="success">Active</Badge> : <UnconfiguredBadge />}
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                <div className="flex items-center gap-3">
                  <MessageCircleMore className="h-5 w-5 text-muted-foreground" />
                  <div><p className="text-sm font-medium">Telegram escalation</p><p className="text-xs text-muted-foreground">No bot or owner chat configured</p></div>
                </div>
                <UnconfiguredBadge />
              </div>
              <Button asChild variant="outline" className="w-full">
                <Link href="/dashboard/departments/ceo-orchestrator">Review CEO powers</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2"><BrainCircuit className="h-5 w-5" />Model providers</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Available connection targets.</p>
              </div>
              <Badge variant="secondary">{connectedProviders} / {MODEL_PROVIDERS.length}</Badge>
            </CardHeader>
            <CardContent className="space-y-2">
              {MODEL_PROVIDERS.slice(0, 5).map((provider) => {
                const runtime = providerRuntime.find((item) => item.id === provider.id);
                return (
                <div key={provider.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                  <span className="text-sm font-medium">{provider.name}</span>
                  {runtime?.reachable ? <Badge variant="success">Connected</Badge> : <UnconfiguredBadge>Not connected</UnconfiguredBadge>}
                </div>
                );
              })}
              <Button asChild variant="ghost" className="mt-2 w-full">
                <Link href="/dashboard/providers">All {MODEL_PROVIDERS.length} providers <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Clock3 className="h-5 w-5" />Autonomous loops</CardTitle></CardHeader>
          <CardContent>
            <div className={`rounded-lg border p-6 text-center ${workerActive ? "border-emerald-500/30 bg-emerald-500/5" : "border-dashed"}`}>
              <Workflow className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 font-medium">{workerRuntime ? `${workerRuntime.activeLoops} loops running` : "No loops configured"}</p>
              <p className="mt-1 text-sm text-muted-foreground">{workerRuntime ? "Internal reviews recur every 30 minutes with retries, budgets, idempotency, and stop controls." : "Schedules, triggers, retry limits, and stop conditions have not been set."}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" />Approval queue</CardTitle></CardHeader>
          <CardContent>
            <div className="rounded-lg border border-dashed p-6 text-center">
              <ListChecks className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 font-medium">No approval requests</p>
              <p className="mt-1 text-sm text-muted-foreground">The queue will populate only from connected agents and policy rules.</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><CircleDollarSign className="h-5 w-5" />Budget guardrail</CardTitle></CardHeader>
          <CardContent>
            <div className="rounded-lg border border-dashed p-6 text-center">
              <CircleDollarSign className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 font-medium">No monthly budget set</p>
              <p className="mt-1 text-sm text-muted-foreground">Recorded spend is $0 because no billing or usage sources are connected.</p>
              <Button asChild variant="outline" size="sm" className="mt-4"><Link href="/dashboard/budget">Open budget</Link></Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" />Factory health</CardTitle>
          {workerActive ? <Badge variant="success">Runtime reporting</Badge> : <UnconfiguredBadge>No telemetry</UnconfiguredBadge>}
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {["Orchestrator worker", "Task queue", "Loop scheduler", "Audit stream"].map((service) => (
              <div key={service} className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm font-medium">{service}</span>
                <span className={`h-2 w-2 rounded-full ${workerActive ? "bg-emerald-400" : "bg-muted-foreground/40"}`} aria-label={workerActive ? "Active" : "Not connected"} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
