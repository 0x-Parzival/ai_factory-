"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ExternalLink, Loader2, PlugZap, RefreshCw, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type CatalogApp = { slug: string; name: string; purpose: string; risk: string };
type ConnectedAccount = { id: string; name: string; app: string; appName: string; healthy: boolean; scopes: string[] };

export function PlatformConnections({ apps, configured, authenticationConfigured }: {
  apps: CatalogApp[];
  configured: boolean;
  authenticationConfigured: boolean;
}) {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(configured && authenticationConfigured);
  const [connecting, setConnecting] = useState<string>();
  const [error, setError] = useState<string>();

  async function refresh() {
    if (!configured || !authenticationConfigured) return;
    setLoading(true);
    setError(undefined);
    try {
      const response = await fetch("/api/integrations/pipedream/accounts", { cache: "no-store", credentials: "same-origin" });
      const payload = await response.json().catch(() => ({})) as { accounts?: ConnectedAccount[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not load connected accounts.");
      setAccounts(payload.accounts || []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load connected accounts.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, [configured, authenticationConfigured]);

  const connectedByApp = useMemo(() => {
    const map = new Map<string, ConnectedAccount[]>();
    for (const account of accounts) map.set(account.app, [...(map.get(account.app) || []), account]);
    return map;
  }, [accounts]);

  async function connect(app: string) {
    setConnecting(app);
    setError(undefined);
    try {
      const response = await fetch("/api/integrations/pipedream/connect-link", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ app }),
      });
      const payload = await response.json().catch(() => ({})) as { url?: string; error?: string };
      if (!response.ok || !payload.url) throw new Error(payload.error || "Could not start account connection.");
      const popup = window.open(payload.url, "spiritual-ai-connect", "popup,width=720,height=760");
      if (!popup) window.location.assign(payload.url);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not start account connection.");
    } finally {
      setConnecting(undefined);
    }
  }

  return (
    <Card className="border-violet-500/30 bg-violet-500/5">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2"><PlugZap className="h-5 w-5" />Connect company accounts</CardTitle>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Secure OAuth through Pipedream MCP. Credentials stay isolated from the browser and AI models; every account is scoped to the signed-in factory owner.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading || !configured || !authenticationConfigured}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {!authenticationConfigured && <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-muted-foreground">Configure Clerk login first. Connected accounts are always attached to an authenticated user.</p>}
        {authenticationConfigured && !configured && <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-muted-foreground">Add the four Pipedream server variables shown below to activate one-click connections.</p>}
        {error && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {apps.map((app) => {
            const connected = connectedByApp.get(app.slug) || [];
            const healthy = connected.some((account) => account.healthy);
            return (
              <div key={app.slug} className="rounded-lg border bg-background/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="font-medium">{app.name}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{app.purpose}</p></div>
                  {connected.length ? <Badge variant={healthy ? "success" : "secondary"}>{connected.length} connected</Badge> : <Badge variant="secondary">Not connected</Badge>}
                </div>
                <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-4 text-muted-foreground"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />{app.risk}</p>
                <Button className="mt-3 w-full" size="sm" variant={connected.length ? "outline" : "default"} disabled={!configured || !authenticationConfigured || Boolean(connecting)} onClick={() => void connect(app.slug)}>
                  {connecting === app.slug ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : connected.length ? <CheckCircle2 className="mr-2 h-4 w-4" /> : <ExternalLink className="mr-2 h-4 w-4" />}
                  {connected.length ? "Add another account" : `Connect ${app.name}`}
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
