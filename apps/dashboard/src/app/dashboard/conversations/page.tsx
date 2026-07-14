"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageSquare, Globe, Radio, HeartHandshake } from "lucide-react";

const channels = [
  { name: "Web Chat", icon: MessageSquare },
  { name: "WhatsApp", icon: Globe },
  { name: "Social Inbox", icon: Radio },
  { name: "Community Care", icon: HeartHandshake },
];

export default function ConversationsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Care Inbox</h1>
          <p className="mt-1 text-muted-foreground">
            Live seeker conversations will appear after a channel is connected.
          </p>
        </div>
        <Button>Connect Channel</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {channels.map((channel) => (
          <Card key={channel.name}>
            <CardContent className="flex items-center justify-between gap-4 pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <channel.icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">{channel.name}</p>
                  <p className="text-sm text-muted-foreground">0 conversations</p>
                </div>
              </div>
              <Badge variant="secondary">Not connected</Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Inbox</CardTitle>
        </CardHeader>
        <CardContent className="py-12 text-center">
          <MessageSquare className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-medium">No live conversations yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            This page will show real messages, escalation status, and steward review queues once channels are configured.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
