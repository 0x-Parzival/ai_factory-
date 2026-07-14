import { Activity, Bot, CheckCircle2, CircleX, Clock3, Cpu, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getWorkerRuntimeStatus, type WorkerAgentRuntimeStatus } from "@/lib/factory-runtime";

export const dynamic = "force-dynamic";

const statusPresentation: Record<WorkerAgentRuntimeStatus["status"], { label: string; className: string }> = {
  idle: { label: "Idle", className: "text-muted-foreground" },
  queued: { label: "Queued", className: "text-amber-400" },
  running: { label: "Working", className: "text-sky-400" },
  succeeded: { label: "Ready", className: "text-emerald-400" },
  failed: { label: "Failed", className: "text-red-400" },
};

function formatTime(value?: string) {
  if (!value) return "No completed run";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
}

export default async function AgentActivityPage() {
  const worker = await getWorkerRuntimeStatus();
  const agents = worker?.agents ?? [];

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="outline">Live worker feed</Badge>
            {worker ? <Badge variant="success">Process {worker.workerPid} active</Badge> : <Badge variant="secondary">Worker unavailable</Badge>}
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Agent Activity</h1>
          <p className="mt-1 max-w-3xl text-muted-foreground">Actual department-agent state emitted by the running orchestrator. This page does not simulate activity.</p>
        </div>
        {worker && <p className="text-sm text-muted-foreground">Updated {formatTime(worker.updatedAt)}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Agents", value: worker?.deployedAgents ?? 0, icon: Bot },
          { label: "Working or queued", value: agents.filter((agent) => agent.status === "running" || agent.status === "queued").length, icon: Activity },
          { label: "Completed tasks", value: worker?.completedTasks ?? 0, icon: CheckCircle2 },
          { label: "Failed tasks", value: worker?.failedTasks ?? 0, icon: CircleX },
        ].map((metric) => (
          <Card key={metric.label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">{metric.label}</p><metric.icon className="h-5 w-5 text-muted-foreground" /></div>
              <p className="mt-2 text-3xl font-bold tabular-nums">{metric.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {agents.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {agents.map((agent) => {
            const presentation = statusPresentation[agent.status];
            return (
              <Card key={agent.departmentId}>
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5" />{agent.departmentName}</CardTitle>
                    <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground"><Cpu className="h-3.5 w-3.5" />{agent.provider} · {agent.model}</p>
                  </div>
                  <Badge variant="outline" className={presentation.className}>{presentation.label}</Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Current state</p>
                    <p className="mt-1 text-sm font-medium">{agent.currentTask || (agent.status === "succeeded" ? "Waiting for the next scheduled loop" : "No task running")}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg border p-3"><p className="text-muted-foreground">Completed</p><p className="mt-1 text-lg font-semibold">{agent.completedTasks}</p></div>
                    <div className="rounded-lg border p-3"><p className="text-muted-foreground">Failed</p><p className="mt-1 text-lg font-semibold">{agent.failedTasks}</p></div>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{formatTime(agent.lastRunAt)}</span>
                    <span className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" />Internal actions only</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-16 text-center">
            <Activity className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-4 font-medium">No live agent trace feed</p>
            <p className="mt-1 text-sm text-muted-foreground">Start the local worker to publish real per-agent status.</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Clock3 className="h-5 w-5" />Recent orchestrator events</CardTitle>
          <p className="text-sm text-muted-foreground">A sanitized view of real runtime audit events; task inputs and model output are not exposed here.</p>
        </CardHeader>
        <CardContent>
          {worker?.recentEvents?.length ? (
            <div className="divide-y rounded-lg border">
              {worker.recentEvents.slice(0, 20).map((event) => (
                <div key={event.id} className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[1fr_1fr_auto] sm:items-center">
                  <span className="font-medium">{event.type}</span>
                  <span className="text-muted-foreground">{event.departmentId || "company"} · {event.actor}</span>
                  <time className="text-xs text-muted-foreground" dateTime={event.occurredAt}>{formatTime(event.occurredAt)}</time>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">No runtime events are available.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
