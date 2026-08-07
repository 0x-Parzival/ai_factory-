"use client";

import { useState } from "react";
import { BarChart3, CircleDollarSign, Headphones, Megaphone, Target } from "lucide-react";

import { DepartmentChat, type ChatProviderOption } from "@/components/department-chat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const agents = [
  { slug: "ceo-orchestrator", name: "CEO", description: "Priorities and decisions", icon: Target },
  { slug: "sales", name: "Sales", description: "Demand and opportunities", icon: Megaphone },
  { slug: "marketing", name: "Marketing", description: "Growth and positioning", icon: BarChart3 },
  { slug: "finance", name: "Finance", description: "Margin and cash", icon: CircleDollarSign },
  { slug: "customer-care", name: "Customer Care", description: "Retention and support", icon: Headphones },
] as const;

export function BusinessDiscussionRoom({ providers, authenticationConfigured }: { providers: ChatProviderOption[]; authenticationConfigured: boolean }) {
  const [selectedSlug, setSelectedSlug] = useState<string>(agents[0].slug);
  const selected = agents.find((agent) => agent.slug === selectedSlug) || agents[0];

  return (
    <Card className="border-primary/30 bg-primary/[0.03]">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Business discussion room</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Ask the right specialist for a practical business answer, then switch perspectives without leaving the room.</p>
          </div>
          <Badge variant="outline">5 business agents</Badge>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5" role="tablist" aria-label="Business agents">
          {agents.map((agent) => (
            <Button key={agent.slug} type="button" role="tab" aria-selected={selectedSlug === agent.slug} variant={selectedSlug === agent.slug ? "default" : "outline"} className="h-auto justify-start gap-2 px-3 py-2 text-left" onClick={() => setSelectedSlug(agent.slug)}>
              <agent.icon className="h-4 w-4 shrink-0" />
              <span className="min-w-0"><span className="block truncate text-sm">{agent.name}</span><span className="block truncate text-[11px] font-normal opacity-80">{agent.description}</span></span>
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <DepartmentChat key={selected.slug} departmentSlug={selected.slug} departmentName={selected.name} providers={providers} authenticationConfigured={authenticationConfigured} />
      </CardContent>
    </Card>
  );
}
