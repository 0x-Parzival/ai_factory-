"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bot, Plus } from "lucide-react";

export default function PersonasPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Persona Studio</h1>
          <p className="mt-1 text-muted-foreground">
            Create and manage the real personas used by your spiritual AI departments.
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Persona
        </Button>
      </div>

      <Card>
        <CardContent className="py-14 text-center">
          <Bot className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-medium">No personas created yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Personas created for this factory will appear here. No fabricated persona records are shown.
          </p>
          <Button className="mt-5">
            <Plus className="mr-2 h-4 w-4" />
            Create the first persona
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
