"use client";

import { ExternalLink, PlugZap, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function OpenSeoConsole() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg"><PlugZap className="h-5 w-5" />OpenSEO for Codex</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">Codex can use OpenSEO’s keyword, SERP, competitor, backlink, rank, and Search Console tools in this workspace.</p>
        </div>
        <Badge variant="success">MCP configured</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-muted/20 p-3 text-sm">
          <p className="font-medium">One-time setup on the trusted Codex host</p>
          <code className="mt-2 block overflow-x-auto text-xs">codex mcp add openseo --url https://app.openseo.so/mcp</code>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">Authorize OpenSEO when Codex opens the login flow. The project also includes the same MCP registration in <code>.codex/config.toml</code>.</p>
        </div>
        <div className="rounded-lg border bg-muted/20 p-3 text-sm">
          <p className="font-medium">Give Codex the workflows</p>
          <code className="mt-2 block overflow-x-auto text-xs">npx skills add every-app/open-seo --skill '*' --agent codex</code>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">Then use <code>/seo-coach</code>, <code>/seo-project-setup</code>, or a focused OpenSEO skill in Codex.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm"><a href="https://openseo.so/docs/mcp" target="_blank" rel="noreferrer">Open setup guide <ExternalLink className="ml-2 h-3.5 w-3.5" /></a></Button>
          <Button asChild variant="outline" size="sm"><a href="https://github.com/every-app/open-seo" target="_blank" rel="noreferrer">View OpenSEO source <ExternalLink className="ml-2 h-3.5 w-3.5" /></a></Button>
        </div>
        <p className="rounded-lg bg-muted/40 p-3 text-xs leading-5 text-muted-foreground"><ShieldCheck className="mr-1 inline h-3.5 w-3.5" />OpenSEO supplies research evidence. Codex may draft briefs and approved changes; publishing, indexing, credentials, and production content changes still require your approval.</p>
      </CardContent>
    </Card>
  );
}
