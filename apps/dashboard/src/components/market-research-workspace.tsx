"use client";

import { FormEvent, useState } from "react";
import { Loader2, Search, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { DepartmentChat, type ChatProviderOption } from "@/components/department-chat";

type Result = { question: string; insight: string; sources: Array<{ source: string; ok: boolean; error?: string }> };

export function MarketResearchWorkspace({ providers, authenticationConfigured }: { providers: ChatProviderOption[]; authenticationConfigured: boolean }) {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<Result>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function run(event: FormEvent) {
    event.preventDefault();
    if (!question.trim() || loading) return;
    setLoading(true); setError(undefined); setResult(undefined);
    try {
      const response = await fetch("/api/market-research", { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ question }) });
      const payload = await response.json() as Result & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Research failed.");
      setResult(payload);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Research failed."); } finally { setLoading(false); }
  }

  return <div className="mx-auto max-w-[1500px] space-y-6">
    <div><Badge variant="outline">Hermes research desk</Badge><h1 className="mt-2 text-3xl font-bold tracking-tight">Market Research</h1><p className="mt-2 max-w-3xl text-muted-foreground">Ask one question. The desk searches public Reddit, LinkedIn, X, news, web, and research-paper indexes, then Hermes produces an evidence-labeled brief.</p></div>
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Search className="h-5 w-5" />Research question</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={(event) => void run(event)} className="space-y-3">
          <Textarea value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={1_000} rows={4} placeholder="What do remote workers in India struggle with when choosing mental-wellness apps?" disabled={loading || !authenticationConfigured} />
          <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground">Public, indexed sources only. Availability varies by platform.</p><Button type="submit" disabled={loading || !question.trim() || !authenticationConfigured}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}{loading ? "Researching…" : "Research with Hermes"}</Button></div>
        </form>
        {error && <p role="alert" className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
    {result && <Card><CardHeader><CardTitle>Evidence brief</CardTitle><div className="flex flex-wrap gap-2">{result.sources.map((source) => <Badge key={source.source} variant={source.ok ? "success" : "secondary"}>{source.source}: {source.ok ? "searched" : "unavailable"}</Badge>)}</div></CardHeader><CardContent><div className="whitespace-pre-wrap text-sm leading-6">{result.insight}</div><p className="mt-5 rounded-lg bg-muted/40 p-3 text-xs leading-5 text-muted-foreground"><ShieldCheck className="mr-1 inline h-3.5 w-3.5" />Findings are decision support, not verified market truth. Validate important claims before publishing, spending, or changing product strategy.</p></CardContent></Card>}
    <DepartmentChat departmentSlug="market-research" departmentName="Market Research" providers={providers} authenticationConfigured={authenticationConfigured} preferredProvider="hermes" />
  </div>;
}
