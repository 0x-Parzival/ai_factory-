"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, CheckCircle2, ExternalLink, Loader2, RefreshCw, ShieldCheck, Unplug } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type AnalyticsSource = {
  slug: "posthog" | "google_analytics" | "sentry" | "microsoft_clarity";
  name: string;
  description: string;
  measures: string;
};

type ConnectedAccount = { id: string; app: string; appName: string; healthy: boolean };

const SOURCES: AnalyticsSource[] = [
  { slug: "posthog", name: "PostHog", description: "Product usage, events, funnels, cohorts, and feature flags.", measures: "Events · funnels · retention" },
  { slug: "google_analytics", name: "Google Analytics 4", description: "Acquisition, engagement, conversions, and web revenue.", measures: "Users · traffic · conversions" },
  { slug: "sentry", name: "Sentry", description: "Application errors, performance traces, releases, and user impact.", measures: "Errors · traces · releases" },
  { slug: "microsoft_clarity", name: "Microsoft Clarity", description: "Session behaviour, rage clicks, dead clicks, and scroll depth.", measures: "Sessions · friction · recordings" },
];

export function AnalyticsWorkspace({ authenticationConfigured, gatewayConfigured }: { authenticationConfigured: boolean; gatewayConfigured: boolean }) {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(gatewayConfigured && authenticationConfigured);
  const [connecting, setConnecting] = useState<string>();
  const [error, setError] = useState<string>();

  async function refresh() {
    if (!gatewayConfigured || !authenticationConfigured) return;
    setLoading(true);
    setError(undefined);
    try {
      const response = await fetch("/api/integrations/pipedream/accounts", { cache: "no-store", credentials: "same-origin" });
      const payload = await response.json().catch(() => ({})) as { accounts?: ConnectedAccount[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not load analytics connections.");
      setAccounts(payload.accounts || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load analytics connections.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, [gatewayConfigured, authenticationConfigured]);

  const connected = useMemo(() => new Map(
    SOURCES.map((source) => [source.slug, accounts.filter((account) => account.app === source.slug)]),
  ), [accounts]);
  const activeSources = SOURCES.filter((source) => connected.get(source.slug)?.some((account) => account.healthy));

  async function connect(source: AnalyticsSource) {
    setConnecting(source.slug);
    setError(undefined);
    try {
      const response = await fetch("/api/integrations/pipedream/connect-link", {
        method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ app: source.slug }),
      });
      const payload = await response.json().catch(() => ({})) as { url?: string; error?: string };
      if (!response.ok || !payload.url) throw new Error(payload.error || "Could not start the secure connection.");
      const popup = window.open(payload.url, "analytics-connect", "popup,width=720,height=760");
      if (!popup) window.location.assign(payload.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start the secure connection.");
    } finally {
      setConnecting(undefined);
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2"><Badge variant="outline">Unified analytics</Badge><Badge variant="secondary">Read-only</Badge></div>
          <h1 className="text-3xl font-bold tracking-tight">Data Analytics</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">Connect your analytics sources, view their signals together, then ask AI to investigate the data.</p>
        </div>
        <Button variant="outline" onClick={() => void refresh()} disabled={loading || !gatewayConfigured || !authenticationConfigured}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Refresh connections
        </Button>
      </div>

      {!authenticationConfigured && <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-muted-foreground">Configure Clerk login and sign in to connect analytics accounts.</p>}
      {authenticationConfigured && !gatewayConfigured && <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-muted-foreground">Add Pipedream Connect server credentials to enable in-interface account connections.</p>}
      {error && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {SOURCES.map((source) => {
          const sourceAccounts = connected.get(source.slug) || [];
          const isConnected = sourceAccounts.some((account) => account.healthy);
          return <Card key={source.slug} className={isConnected ? "border-emerald-500/30" : ""}>
            <CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-base">{source.name}</CardTitle><p className="mt-1 text-xs leading-5 text-muted-foreground">{source.description}</p></div>{isConnected ? <Badge variant="success">Connected</Badge> : <Badge variant="secondary">Not connected</Badge>}</div></CardHeader>
            <CardContent><p className="text-xs text-muted-foreground">{source.measures}</p><Button className="mt-4 w-full" size="sm" variant={isConnected ? "outline" : "default"} disabled={!authenticationConfigured || !gatewayConfigured || Boolean(connecting)} onClick={() => void connect(source)}>{connecting === source.slug ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : isConnected ? <CheckCircle2 className="mr-2 h-4 w-4" /> : <ExternalLink className="mr-2 h-4 w-4" />}{isConnected ? "Add account" : `Connect ${source.name}`}</Button></CardContent>
          </Card>;
        })}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4"><div><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" />Unified analytics</CardTitle><p className="mt-1 text-sm text-muted-foreground">Data is displayed only after a connected provider completes its read-only sync.</p></div><Badge variant={activeSources.length ? "success" : "secondary"}>{activeSources.length} of {SOURCES.length} sources connected</Badge></CardHeader>
        <CardContent>
          {activeSources.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{activeSources.map((source) => <div key={source.slug} className="rounded-lg border bg-background p-4"><p className="font-medium">{source.name}</p><p className="mt-2 text-sm text-muted-foreground">Connected and ready for a read-only analytics sync.</p><p className="mt-3 text-xs text-muted-foreground">Use the AI analyst below to request an investigation.</p></div>)}</div> : <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center"><Unplug className="h-8 w-8 text-muted-foreground" /><p className="mt-3 font-medium">No analytics data connected</p><p className="mt-1 max-w-md text-sm text-muted-foreground">Connect PostHog, GA4, Sentry, or Clarity above. Credentials are handled in the provider&apos;s secure authorization window, never in this page.</p></div>}
          <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4" />Connections are read-only. This workspace does not create tracking, change events, or alter provider settings.</p>
        </CardContent>
      </Card>
    </section>
  );
}
