"use client";

import { FormEvent, KeyboardEvent, useMemo, useState } from "react";
import { Bot, Loader2, MessageSquareText, Send, UserRound } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  provider?: string;
  model?: string;
};

export type ChatProviderOption = {
  id: string;
  name: string;
  models: string[];
};

type DepartmentChatProps = {
  departmentSlug: string;
  departmentName: string;
  providers: ChatProviderOption[];
  authenticationConfigured: boolean;
};

export function DepartmentChat({ departmentSlug, departmentName, providers, authenticationConfigured }: DepartmentChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [provider, setProvider] = useState(providers[0]?.id || "");
  const [model, setModel] = useState(providers[0]?.models[0] || "");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();

  const selectedProvider = useMemo(
    () => providers.find((option) => option.id === provider),
    [provider, providers],
  );

  function changeProvider(nextProvider: string) {
    const option = providers.find((item) => item.id === nextProvider);
    setProvider(nextProvider);
    setModel(option?.models[0] || "");
  }

  async function sendMessage(event?: FormEvent) {
    event?.preventDefault();
    const content = draft.trim();
    if (!content || sending || !provider) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setDraft("");
    setError(undefined);
    setSending(true);

    try {
      const response = await fetch(`/api/departments/${encodeURIComponent(departmentSlug)}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          provider,
          ...(model ? { model } : {}),
          messages: nextMessages.map(({ role, content: messageContent }) => ({ role, content: messageContent })),
        }),
      });
      const payload = await response.json().catch(() => ({})) as {
        message?: string;
        error?: string;
        provider?: string;
        model?: string;
      };
      if (!response.ok || !payload.message) {
        throw new Error(payload.error || `The model request failed with HTTP ${response.status}.`);
      }
      setMessages((current) => [
        ...current,
        { role: "assistant", content: payload.message!, provider: payload.provider, model: payload.model },
      ]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The model request failed.");
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  }

  return (
    <Card id="department-chat">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquareText className="h-5 w-5" /> Talk to {departmentName}
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Replies come from the selected live model using this department&apos;s defined purpose and powers.
            </p>
          </div>
          <Badge variant={providers.length && authenticationConfigured ? "outline" : "secondary"}>
            {!authenticationConfigured ? "Login setup required" : providers.length ? `${providers.length} available provider${providers.length === 1 ? "" : "s"}` : "No provider available"}
          </Badge>
        </div>
        {providers.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="space-y-1 text-xs text-muted-foreground">
              Provider
              <Select value={provider} onChange={(event) => changeProvider(event.target.value)} disabled={sending}>
                {providers.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
              </Select>
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">
              Model
              <Select value={model} onChange={(event) => setModel(event.target.value)} disabled={sending || !selectedProvider?.models.length}>
                {selectedProvider?.models.length
                  ? selectedProvider.models.map((modelName) => <option key={modelName} value={modelName}>{modelName}</option>)
                  : <option value="">Provider default</option>}
              </Select>
            </label>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {!authenticationConfigured && (
          <div className="flex flex-col gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground">Configure Clerk credentials and sign in before using any model. Anonymous AI access is disabled.</p>
            <Button asChild variant="outline" size="sm"><Link href="/sign-in">Open login setup</Link></Button>
          </div>
        )}
        <div className="min-h-64 max-h-[32rem] space-y-3 overflow-y-auto rounded-lg border bg-muted/20 p-3" aria-live="polite">
          {messages.length === 0 && (
            <div className="flex min-h-56 flex-col items-center justify-center text-center">
              <Bot className="h-10 w-10 text-muted-foreground" />
              <p className="mt-3 font-medium">Start a real model conversation</p>
              <p className="mt-1 max-w-lg text-sm text-muted-foreground">
                Ask for analysis, plans, drafts, or department guidance. Chat cannot execute payments, publish content, contact people, or bypass approvals.
              </p>
            </div>
          )}
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`flex gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              {message.role === "assistant" && <Bot className="mt-2 h-4 w-4 shrink-0 text-primary" />}
              <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-6 ${message.role === "user" ? "bg-primary text-primary-foreground" : "border bg-background"}`}>
                <p className="whitespace-pre-wrap">{message.content}</p>
                {message.role === "assistant" && message.model && (
                  <p className="mt-2 border-t pt-1 text-[11px] text-muted-foreground">{message.provider} · {message.model}</p>
                )}
              </div>
              {message.role === "user" && <UserRound className="mt-2 h-4 w-4 shrink-0 text-muted-foreground" />}
            </div>
          ))}
          {sending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Waiting for the live model…
            </div>
          )}
        </div>

        {error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        <form onSubmit={(event) => void sendMessage(event)} className="space-y-2">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={4_000}
            rows={3}
            placeholder={!authenticationConfigured ? "Configure secure login to enable chat" : providers.length ? `Message ${departmentName}…` : "Connect a model provider to enable chat"}
            disabled={sending || providers.length === 0 || !authenticationConfigured}
            aria-label={`Message ${departmentName}`}
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">Enter sends · Shift+Enter adds a line · last 20 messages are used</p>
            <Button type="submit" disabled={!draft.trim() || sending || providers.length === 0 || !authenticationConfigured}>
              {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Send
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
