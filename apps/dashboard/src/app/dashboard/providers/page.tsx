import Link from "next/link";
import { BrainCircuit, CheckCircle2, KeyRound, ServerCog, TerminalSquare, Unplug } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MODEL_PROVIDERS } from "@/lib/factory-blueprints";
import { getProviderRuntimeStatus } from "@/lib/factory-runtime";

export const dynamic = "force-dynamic";

export default async function ProvidersPage() {
  const runtimeStatuses = await getProviderRuntimeStatus();
  const connected = runtimeStatuses.filter((provider) => provider.reachable).length;
  const configured = runtimeStatuses.filter((provider) => provider.configured).length;
  const discoveredModels = runtimeStatuses.reduce((total, provider) => total + provider.models.length, 0);
  const codexConnected = Boolean(runtimeStatuses.find((provider) => provider.id === "codex")?.reachable);
  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="outline">Model routing</Badge>
            <Badge variant="secondary" className="text-muted-foreground">{connected} connected · {configured} configured</Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">AI Providers</h1>
          <p className="mt-1 max-w-3xl text-muted-foreground">
            Server-side health checks and model discovery for connection targets that can power any department. Secrets are never sent to the browser.
          </p>
        </div>
        <Button asChild variant="outline"><Link href="/dashboard/connectors"><KeyRound className="mr-2 h-4 w-4" />Connect business systems</Link></Button>
      </div>

      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardContent className="grid gap-4 pt-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex items-start gap-3">
            <TerminalSquare className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
            <div>
              <p className="font-medium">{codexConnected ? "ChatGPT is connected through local Codex sign-in" : "Connect ChatGPT through local Codex sign-in"}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">On the trusted factory host, run <code className="rounded bg-background px-1.5 py-0.5">codex login</code> and complete the browser flow. This uses the signed-in ChatGPT workspace for Codex advisory work. It does not turn a ChatGPT subscription into an OpenAI API key and should not be exposed as a public shared credential.</p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm"><a href="https://learn.chatgpt.com/docs/auth#openai-authentication" target="_blank" rel="noreferrer">Official auth guide</a></Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Connected</span><CheckCircle2 className="h-5 w-5 text-muted-foreground" /></div>
            <p className="mt-2 text-3xl font-bold">{connected}</p>
            <p className="mt-1 text-xs text-muted-foreground">Reachable endpoints</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Healthy endpoints</span><ServerCog className="h-5 w-5 text-muted-foreground" /></div>
            <p className="mt-2 text-3xl font-bold">{connected}</p>
            <p className="mt-1 text-xs text-muted-foreground">Health checks passed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Discovered models</span><BrainCircuit className="h-5 w-5 text-muted-foreground" /></div>
            <p className="mt-2 text-3xl font-bold">{discoveredModels}</p>
            <p className="mt-1 text-xs text-muted-foreground">From reachable provider catalogs</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {MODEL_PROVIDERS.map((provider) => {
          const runtime = runtimeStatuses.find((item) => item.id === provider.id)!;
          return (
          <Card key={provider.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="text-lg">{provider.name}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">{provider.connectionLabel}</p>
              </div>
              {runtime.reachable ? (
                <Badge variant="success" className="shrink-0 font-normal"><CheckCircle2 className="mr-1 h-3 w-3" />Connected</Badge>
              ) : runtime.configured ? (
                <Badge variant="secondary" className="shrink-0 font-normal"><Unplug className="mr-1 h-3 w-3" />Configured</Badge>
              ) : (
                <Badge variant="secondary" className="shrink-0 font-normal text-muted-foreground"><Unplug className="mr-1 h-3 w-3" />Not configured</Badge>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-3 text-center">
                <div><p className="font-semibold">{runtime.reachable ? `${runtime.latencyMs} ms` : "—"}</p><p className="text-[11px] text-muted-foreground">Endpoint health</p></div>
                <div><p className="font-semibold">{runtime.models.length}</p><p className="text-[11px] text-muted-foreground">Models found</p></div>
              </div>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                {runtime.detail}. {runtime.reachable ? "This status comes from a live server-side health check." : runtime.configured ? "Credentials are present; this provider has not passed a live health check yet." : "Configure secure credentials before using this provider."}
              </p>
            </CardContent>
          </Card>
          );
        })}
      </div>
    </div>
  );
}
