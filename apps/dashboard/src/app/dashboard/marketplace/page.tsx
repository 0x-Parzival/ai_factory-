"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Store, Megaphone, MessageSquare, Sparkles, ShieldCheck } from "lucide-react";

const categories = [
  { name: "Marketing", icon: Megaphone },
  { name: "Conversations", icon: MessageSquare },
  { name: "Spiritual Guidance", icon: Sparkles },
  { name: "Safety", icon: ShieldCheck },
];

export default function MarketplacePage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Capability Market</h1>
          <p className="mt-1 text-muted-foreground">
            Add real skills and channel integrations after the marketplace source is connected.
          </p>
        </div>
        <Button>Connect Marketplace Source</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {categories.map((category) => (
          <Card key={category.name}>
            <CardContent className="flex items-center justify-between gap-4 pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <category.icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">{category.name}</p>
                  <p className="text-sm text-muted-foreground">0 available</p>
                </div>
              </div>
              <Badge variant="secondary">Pending</Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Available Capabilities</CardTitle>
        </CardHeader>
        <CardContent className="py-12 text-center">
          <Store className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-medium">No marketplace data connected</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Ratings, installs, pricing, and vendor details will appear only when they come from a real marketplace source.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
