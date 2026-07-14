"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings, User, Key, Bell, Plug, Shield } from "lucide-react";

const setupSections = [
  { name: "Channels", description: "Connect web chat, WhatsApp, email, and social inboxes.", icon: Plug },
  { name: "Safety", description: "Define escalation rules, blocked topics, and approval thresholds.", icon: Shield },
  { name: "Notifications", description: "Choose where steward review alerts should be delivered.", icon: Bell },
  { name: "API Access", description: "Create keys only when an integration needs them.", icon: Key },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Configure real account, channel, safety, and integration details for the factory.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Steward Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Display name</label>
              <Input placeholder="Enter steward name" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input type="email" placeholder="Enter email address" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium">Organization</label>
              <Input placeholder="Enter organization name" />
            </div>
            <div className="sm:col-span-2">
              <Button>Save Profile</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Factory Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Billing</span>
              <Badge variant="secondary">Not connected</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">API keys</span>
              <Badge variant="secondary">0 active</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Channels</span>
              <Badge variant="secondary">0 connected</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {setupSections.map((section) => (
          <Card key={section.name}>
            <CardContent className="flex items-start justify-between gap-4 pt-6">
              <div className="flex gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <section.icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">{section.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>
                </div>
              </div>
              <Badge variant="secondary">Unset</Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>API Keys</CardTitle>
        </CardHeader>
        <CardContent className="py-10 text-center">
          <Key className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-medium">No API keys created</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Keys and usage timestamps will appear only after you create real integration credentials.
          </p>
          <Button className="mt-4" variant="outline">Create API Key</Button>
        </CardContent>
      </Card>
    </div>
  );
}
