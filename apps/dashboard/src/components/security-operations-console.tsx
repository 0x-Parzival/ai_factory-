"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, CheckCircle2, CircleAlert, RefreshCw, ShieldCheck, Siren } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DepartmentChat, type ChatProviderOption } from "@/components/department-chat";
import type { SecuritySnapshot } from "@/lib/security-monitor";

type Connector = { id: string; name: string; configured: boolean; reachable: boolean; detail: string; findings: Array<{ severity: string }> };

export function SecurityOperationsConsole({ providers, authenticationConfigured }: { providers: ChatProviderOption[]; authenticationConfigured: boolean }) {
  const [snapshot, setSnapshot] = useState<SecuritySnapshot>();
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const response = await fetch("/api/security/status", { cache: "no-store" });
      if (!response.ok) throw new Error("Security status request failed");
      setSnapshot(await response.json());
      const connectorResponse = await fetch("/api/security/connectors", { cache: "no-store" });
      if (connectorResponse.ok) setConnectors(await connectorResponse.json());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Security checks could not be completed.");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 30_000); return () => window.clearInterval(timer); }, [load]);
  const monitorProviders = snapshot?.providers || [];
  return <div className="mx-auto max-w-[1600px] space-y-6">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div><div className="mb-2 flex gap-2"><Badge variant="outline">Defensive operations</Badge><Badge variant={snapshot?.alertCount ? "destructive" : "success"}>{snapshot ? `${snapshot.alertCount} attention items` : "Loading"}</Badge></div><h1 className="text-3xl font-bold tracking-tight">Cyber Security & Site Reliability</h1><p className="mt-2 max-w-3xl text-muted-foreground">Read-only monitoring of the approved public site and AI connections. The dashboard refreshes every 30 seconds while open; background alerting must run on the trusted host.</p></div>
      <Button onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />Run safe checks</Button>
    </div>
    {error && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Website" value={snapshot?.site.reachable ? "Healthy" : "Needs attention"} note={snapshot?.site.reachable ? `HTTP ${snapshot.site.status} · ${snapshot.site.latencyMs} ms` : snapshot?.site.error || "Awaiting check"} icon={Activity} good={snapshot?.site.reachable} />
      <Metric label="AI connections" value={`${monitorProviders.filter((p) => p.reachable).length}/${monitorProviders.filter((p) => p.configured).length}`} note="Configured endpoints reachable" icon={ShieldCheck} good={monitorProviders.some((p) => p.reachable)} />
      <Metric label="Security headers" value={snapshot ? `${snapshot.site.headers.filter((h) => h.present).length}/${snapshot.site.headers.length}` : "—"} note="Observed on public response" icon={CheckCircle2} good={snapshot?.site.headers.every((h) => h.present)} />
      <Metric label="Open alerts" value={snapshot?.alertCount?.toString() || "—"} note={snapshot ? `Last checked ${new Date(snapshot.checkedAt).toLocaleTimeString()}` : "Awaiting check"} icon={Siren} good={snapshot?.alertCount === 0} />
    </div>
    <Card><CardHeader><CardTitle>LLM routing, limits & active health</CardTitle><p className="text-sm text-muted-foreground">Limit data is displayed only when a provider safely reports it. Credentials and account balances never enter the browser.</p></CardHeader><CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{monitorProviders.map((provider) => <div key={provider.id} className="rounded-lg border p-4"><div className="flex items-center justify-between"><p className="font-medium capitalize">{provider.id}</p>{provider.reachable ? <Badge variant="success">Working</Badge> : <Badge variant="secondary">{provider.configured ? "Unreachable" : "Not connected"}</Badge>}</div><p className="mt-2 text-xs text-muted-foreground">{provider.detail}</p><p className="mt-2 text-xs text-muted-foreground">{provider.rateLimit || "Usage limit not exposed by this provider health endpoint."}</p></div>)}</CardContent></Card>
    <Card><CardHeader><CardTitle>Website security tools available to the AI</CardTitle><p className="text-sm text-muted-foreground">The Security AI receives only summarized, redacted read-only findings from connected tools.</p></CardHeader><CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">{connectors.map((connector) => <div key={connector.id} className="rounded-lg border p-4"><div className="flex items-center justify-between"><p className="font-medium">{connector.name}</p><Badge variant={connector.reachable ? "success" : "secondary"}>{connector.reachable ? "Connected" : connector.configured ? "Unavailable" : "Setup needed"}</Badge></div><p className="mt-2 text-xs text-muted-foreground">{connector.detail}</p><p className="mt-2 text-xs text-muted-foreground">{connector.findings.length} safe findings available to chat</p></div>)}</CardContent></Card>
    <div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader><CardTitle>Connection checklist</CardTitle></CardHeader><CardContent className="space-y-3">{(snapshot?.checklist || []).map((item) => <div key={item.label} className="flex gap-3 rounded-lg border p-3">{item.ok ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-500" /> : <CircleAlert className="mt-0.5 h-5 w-5 text-amber-500" />}<div><p className="font-medium">{item.label}</p><p className="text-sm text-muted-foreground">{item.detail}</p></div></div>)}</CardContent></Card><Card><CardHeader><CardTitle>Security workflow controls</CardTitle></CardHeader><CardContent className="space-y-3 text-sm text-muted-foreground"><p>Use <span className="font-medium text-foreground">Run safe checks</span> above to refresh website availability, response headers, configured AI routes, and evidence collection in one pass.</p><p className="rounded-lg bg-muted p-3">Remediation, scanning beyond the approved URL, secret rotation, WAF/firewall changes, and external alerts remain human-approved actions.</p></CardContent></Card></div>
    <DepartmentChat departmentSlug="cyber-security" departmentName="Cyber Security & Site Reliability" providers={providers} authenticationConfigured={authenticationConfigured} />
  </div>;
}

function Metric({ label, value, note, icon: Icon, good }: { label: string; value: string; note: string; icon: typeof Activity; good?: boolean }) { return <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">{label}</p><Icon className={good ? "h-5 w-5 text-emerald-500" : "h-5 w-5 text-amber-500"} /></div><p className="mt-2 text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{note}</p></CardContent></Card>; }
