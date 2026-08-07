import { Cable, CheckCircle2, KeyRound, LockKeyhole, Search, Unplug } from "lucide-react";

import { agentInfrastructureFromEnv } from "@ai-factory/integrations/agent-infrastructure";
import { CONNECTOR_CATALOG, connectorReadiness } from "@ai-factory/integrations/catalog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlatformConnections } from "@/components/platform-connections";
import { isClerkConfigured } from "@/lib/auth-config";
import { COMPOSIO_TOOLKITS, isComposioConfigured } from "@/lib/composio";
import { isPipedreamConfigured, PIPEDREAM_APPS } from "@/lib/pipedream";

export const dynamic = "force-dynamic";

export default async function ConnectorsPage() {
  const connectors = CONNECTOR_CATALOG.map((definition) => ({
    definition,
    readiness: connectorReadiness(definition),
  }));
  const configured = connectors.filter((connector) => connector.readiness.configured).length;
  const authConfigured = isClerkConfigured();
  const composioConfigured = isComposioConfigured();
  const pipedreamConfigured = isPipedreamConfigured();
  const infrastructureHealth = await agentInfrastructureFromEnv().health();

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <div>
        <div className="mb-2 flex items-center gap-2"><Badge variant="outline">Credential readiness</Badge><Badge variant="secondary">{configured} configured</Badge></div>
        <h1 className="text-3xl font-bold tracking-tight">Business Connectors</h1>
        <p className="mt-1 max-w-3xl text-muted-foreground">Server-side connection requirements for analytics, payments, CRM, communications, and social platforms. Secret values are never rendered.</p>
      </div>

      <PlatformConnections
        apps={COMPOSIO_TOOLKITS.map((app) => ({ ...app }))}
        configured={composioConfigured}
        authenticationConfigured={authConfigured}
      />

      <PlatformConnections
        apps={PIPEDREAM_APPS.map((app) => ({ ...app }))}
        configured={pipedreamConfigured}
        authenticationConfigured={authConfigured}
        gateway="pipedream"
      />

      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader><CardTitle className="text-lg">Activate approval-first email outreach</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[
            ["1. Sending identity", "Create an owned reach.spiritualai.store mailbox and configure SPF, DKIM, and DMARC."],
            ["2. Discovery", "Create a BetterContact account and restrict discovery to relevant professional profiles."],
            ["3. Service secrets", "Generate OpenOutreach secret, credential-encryption, and factory-token values of at least 32 characters."],
            ["4. Sender disclosure", "Enter Spiritual AI's company name, valid postal address, operator country, and reply-to-unsubscribe policy."],
            ["5. Draft review", "Keep external sending off while Sales generates and you inspect the first recipient-specific drafts."],
            ["6. Controlled activation", "Enable sending only after mailbox DNS passes; approve or reject every exact draft fingerprint."],
          ].map(([title, detail]) => <div key={title} className="rounded-lg border bg-background/70 p-3"><p className="text-sm font-medium">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p></div>)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Composio managed OAuth setup</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg bg-muted/40 p-3">
            <p className="text-xs font-medium text-muted-foreground">Required server variables</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {["COMPOSIO_API_KEY", "COMPOSIO_ACTION_TOOL_ALLOWLIST", "COMPOSIO_TOOLKIT_VERSIONS"].map((secret) => <code key={secret} className="rounded bg-background px-2 py-1 text-[11px]">{secret}</code>)}
            </div>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-sm font-medium">{composioConfigured ? "Gateway configured" : "Gateway not configured"}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Uses hosted OAuth with private per-owner accounts. Exact tool slugs and dated toolkit versions must be configured before execution; external writes still pass through approval gates.</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardHeader><CardTitle className="text-lg">Agent capability stack</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {[
            ["agentmail", "AgentMail", "Dedicated agent inbox", "Read filtered inbox; approve every send"],
            ["composio", "Composio", "Connected platforms", "Private OAuth plus exact tool allowlists"],
            ["orgo", "Orgo", "Persistent cloud PC", "Approve every view and control operation"],
            ["firecrawl", "Firecrawl", "Public web data", "Search and single-page extraction only"],
            ["e2b", "E2B", "Ephemeral execution", "Approve, cap, execute, then destroy"],
          ].map(([id, name, purpose, boundary]) => {
            const status = infrastructureHealth[id as keyof typeof infrastructureHealth];
            return <div key={id} className="rounded-lg border bg-background/70 p-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-medium">{name}</p><Badge variant={status.reachable ? "success" : "secondary"}>{status.reachable ? "Reachable" : status.configured ? "Configured" : "Setup required"}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{purpose}</p><p className="mt-2 text-[11px] leading-4 text-muted-foreground">{boundary}</p></div>;
          })}
        </CardContent>
      </Card>

      <Card className="border-violet-500/30 bg-violet-500/5">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div><CardTitle className="flex items-center gap-2"><Search className="h-5 w-5" />Google Search Console</CardTitle><p className="mt-1 text-sm text-muted-foreground">Powers the SEO/GEO/AEO agent with verified query and page performance.</p></div>
          {connectors.find(({ definition }) => definition.id === "google-search-console")?.readiness.configured ? <Badge variant="success">Credentials set</Badge> : <Badge variant="secondary">Not configured</Badge>}
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border bg-background/60 p-3"><p className="text-xs text-muted-foreground">Access</p><p className="mt-1 text-sm font-medium">Search Analytics, read only</p></div>
          <div className="rounded-lg border bg-background/60 p-3"><p className="text-xs text-muted-foreground">OAuth scope</p><p className="mt-1 break-all text-sm font-medium">webmasters.readonly</p></div>
          <div className="rounded-lg border bg-background/60 p-3"><p className="text-xs text-muted-foreground">Writes</p><p className="mt-1 text-sm font-medium">Publishing and indexing disabled</p></div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {connectors.map(({ definition, readiness }) => (
          <Card key={definition.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div><CardTitle className="flex items-center gap-2 text-lg"><Cable className="h-4 w-4" />{definition.name}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{definition.category} · {definition.departments.join(", ")}</p></div>
              {readiness.configured ? <Badge variant="success"><CheckCircle2 className="mr-1 h-3 w-3" />Credentials set</Badge> : <Badge variant="secondary"><Unplug className="mr-1 h-3 w-3" />Not configured</Badge>}
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground"><KeyRound className="h-3.5 w-3.5" />Required server variables</p>
                <div className="mt-2 flex flex-wrap gap-1.5">{definition.requiredSecrets.map((secret) => <code key={secret} className="rounded bg-background px-2 py-1 text-[11px]">{secret}</code>)}</div>
              </div>
              <div className="flex flex-wrap gap-1.5">{definition.actions.map((action) => <Badge key={action} variant="outline" className="font-normal">{action}</Badge>)}</div>
              {definition.notes && <p className="text-xs leading-5 text-muted-foreground">{definition.notes}</p>}
              <p className="flex items-center gap-1 text-[11px] text-muted-foreground"><LockKeyhole className="h-3.5 w-3.5" />Configure values in the server secret environment and restart the runtime.</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
