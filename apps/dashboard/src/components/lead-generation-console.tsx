"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";

import { DepartmentChat, type ChatProviderOption } from "@/components/department-chat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const DEFAULT_LEAD_MODEL = "gpt-5.6-luna";

export function LeadGenerationConsole({ providers, authenticationConfigured }: { providers: ChatProviderOption[]; authenticationConfigured: boolean }) {
  const [open, setOpen] = useState(false);

  const hermes = providers.find((provider) => provider.id === "hermes");
  // Do not advertise an unconfigured Hermes endpoint. The requested model is
  // offered first only after Hermes is actually available to this page.
  const leadProviders = [
    ...(hermes ? [{ id: "hermes", name: hermes.name || "Hermes", models: [DEFAULT_LEAD_MODEL, ...hermes.models.filter((model) => model !== DEFAULT_LEAD_MODEL)] }] : []),
    ...providers.filter((provider) => provider.id !== "hermes"),
  ];

  return (
    <div className="w-full space-y-4">
      <Button type="button" aria-expanded={open} aria-controls="lead-generation-panel" onClick={() => setOpen((value) => !value)}><Search className="mr-2 h-4 w-4" />{open ? "Close lead generation" : "Lead generation"}</Button>
      {open && (
        <div id="lead-generation-panel" className="space-y-3 rounded-xl border border-primary/30 bg-primary/[0.03] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">Lead generation</h2><Badge variant="secondary">Planning mode</Badge></div>
              <p className="mt-1 text-sm text-muted-foreground">Give one instruction. The selected AI will turn it into a lead-research and qualification plan.</p>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close lead generation"><X className="h-4 w-4" /></Button>
          </div>
          <div className="grid gap-2 rounded-lg border bg-background/60 p-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
            <p><span className="font-medium text-emerald-600">Ready:</span> objective-to-plan chat</p>
            <p><span className="font-medium text-emerald-600">Ready:</span> provider and model choice</p>
            <p><span className="font-medium text-amber-600">Next:</span> connect discovery and enrichment</p>
            <p><span className="font-medium text-amber-600">Next:</span> verification, queue, and CSV export</p>
          </div>
          <DepartmentChat key={leadProviders.map((provider) => `${provider.id}:${provider.models.join(",")}`).join("|")} departmentSlug="sales" departmentName="Lead generation" providers={leadProviders} authenticationConfigured={authenticationConfigured} mode="lead_generation" />
          <p className="text-xs text-muted-foreground">No live lead sources, verification service, enrichment APIs, background queue, or CSV export are connected yet. The chat will not claim leads were found.</p>
        </div>
      )}
    </div>
  );
}
