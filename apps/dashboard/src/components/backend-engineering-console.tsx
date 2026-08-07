"use client";

import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, Database, FileText, Loader2, PlugZap, ShieldCheck, Table2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DepartmentChat, type ChatProviderOption } from "@/components/department-chat";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type NeonStatus = {
  connected: boolean;
  accessMode?: "read_only" | "engineering";
  database?: string;
  role?: string;
  tables?: Array<{ schema: string; name: string; columns: number }>;
  error?: string;
};

async function jsonOrError<T>(response: Response): Promise<T> {
  const text = await response.text();
  try { return JSON.parse(text) as T; } catch {
    if (response.status === 401 || response.status === 403 || text.includes("<!DOCTYPE")) {
      throw new Error("Your session needs attention. Sign in again, then retry the database request.");
    }
    throw new Error("The server returned an unexpected response. Check the dashboard server logs and retry.");
  }
}

export function BackendEngineeringConsole({ providers, authenticationConfigured }: { providers: ChatProviderOption[]; authenticationConfigured: boolean }) {
  const [databaseUrl, setDatabaseUrl] = useState("");
  const [accessMode, setAccessMode] = useState<"read_only" | "engineering">("engineering");
  const [status, setStatus] = useState<NeonStatus>({ connected: false });
  const [connecting, setConnecting] = useState(false);
  const [message, setMessage] = useState<string>();
  const [selectedTable, setSelectedTable] = useState<{ schema: string; name: string }>();
  const [data, setData] = useState<{ columns: string[]; rows: Record<string, unknown>[]; totalRows: number }>();
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState<string>();
  const [vaultPath, setVaultPath] = useState("");
  const [obsidian, setObsidian] = useState<{ connected: boolean; vaultPath?: string; lastSyncedAt?: string; error?: string }>({ connected: false });
  const [connectingObsidian, setConnectingObsidian] = useState(false);

  useEffect(() => {
    if (!authenticationConfigured) return;
    void fetch("/api/backend-engineering/neon", { credentials: "same-origin" })
      .then((response) => response.ok ? jsonOrError<NeonStatus>(response) : null)
      .then((payload) => payload && setStatus(payload))
      .catch(() => undefined);
  }, [authenticationConfigured]);

  useEffect(() => {
    if (!authenticationConfigured) return;
    void fetch("/api/backend-engineering/obsidian", { credentials: "same-origin" })
      .then((response) => response.ok ? jsonOrError<{ connected: boolean; vaultPath?: string; lastSyncedAt?: string; error?: string }>(response) : null)
      .then((payload) => payload && setObsidian(payload))
      .catch(() => undefined);
  }, [authenticationConfigured]);

  async function connect(event: FormEvent) {
    event.preventDefault();
    if (!databaseUrl.trim() || connecting) return;
    setConnecting(true); setMessage(undefined);
    try {
      const response = await fetch("/api/backend-engineering/neon", {
        method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin",
        body: JSON.stringify({ databaseUrl: databaseUrl.trim(), accessMode }),
      });
      const payload = await jsonOrError<NeonStatus & { error?: string }>(response);
      setStatus(payload);
      if (!response.ok) throw new Error(payload.error || "Connection failed.");
      setDatabaseUrl("");
      setMessage("Database connected. The URL was cleared from this form and is never sent back to the browser.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Connection failed."); } finally { setConnecting(false); }
  }

  async function loadTable(table: { schema: string; name: string }) {
    setSelectedTable(table); setLoadingData(true); setData(undefined); setDataError(undefined);
    try {
      const response = await fetch("/api/backend-engineering/data", { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ schema: table.schema, table: table.name }) });
      const payload = await jsonOrError<{ columns?: string[]; rows?: Record<string, unknown>[]; totalRows?: number; error?: string }>(response);
      if (!response.ok) throw new Error(payload.error || "Could not load data.");
      setData({ columns: payload.columns || [], rows: payload.rows || [], totalRows: payload.totalRows || 0 });
    } catch (error) { setDataError(error instanceof Error ? error.message : "Could not load data."); } finally { setLoadingData(false); }
  }

  async function connectObsidian(event: FormEvent) {
    event.preventDefault(); if (!vaultPath.trim() || connectingObsidian) return;
    setConnectingObsidian(true);
    try {
      const response = await fetch("/api/backend-engineering/obsidian", { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ vaultPath: vaultPath.trim() }) });
      const payload = await jsonOrError<{ connected: boolean; vaultPath?: string; lastSyncedAt?: string; error?: string }>(response);
      if (!response.ok) throw new Error(payload.error || "Obsidian connection failed.");
      setObsidian(payload); setVaultPath("");
    } catch (error) { setObsidian((current) => ({ ...current, error: error instanceof Error ? error.message : "Obsidian connection failed." })); } finally { setConnectingObsidian(false); }
  }

  return <div className="mx-auto max-w-[1500px] space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><div className="mb-2 flex gap-2"><Badge variant="outline">Backend Engineer</Badge><Badge variant={status.connected ? "success" : "secondary"}>{status.connected ? "Database connected" : "Database not connected"}</Badge></div><h1 className="text-3xl font-bold tracking-tight">Backend Engineering</h1><p className="mt-1 text-muted-foreground">Talk to the backend engineer, give it tasks, and approve database changes when it proposes them.</p></div>
      {status.connected && <p className="text-sm text-muted-foreground">{status.database} · {status.role} · {status.accessMode === "engineering" ? "engineering access" : "read-only"}</p>}
    </div>

    <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
      <Card className="h-fit">
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><PlugZap className="h-5 w-5" />Database connection</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {status.connected ? <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm"><CheckCircle2 className="mr-1 inline h-4 w-4 text-emerald-500" />Connected as <code>{status.role}</code>.</div> : <p className="text-sm text-muted-foreground">Connect Neon before asking the engineer to inspect or change data.</p>}
          <form onSubmit={connect} className="space-y-3">
            <label className="block text-xs text-muted-foreground">Access level<Select value={accessMode} onChange={(event) => setAccessMode(event.target.value as "read_only" | "engineering")} className="mt-1" disabled={connecting}><option value="engineering">Engineering read/write</option><option value="read_only">Read-only</option></Select></label>
            <Input type="password" autoComplete="off" value={databaseUrl} onChange={(event) => setDatabaseUrl(event.target.value)} placeholder="Neon PostgreSQL URL" disabled={connecting || !authenticationConfigured} />
            <Button type="submit" className="w-full" disabled={!databaseUrl.trim() || connecting || !authenticationConfigured}>{connecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}{connecting ? "Connecting…" : "Connect Neon"}</Button>
          </form>
          {message && <p className="text-xs leading-5 text-muted-foreground">{message}</p>}
          <p className="rounded-lg bg-muted/40 p-3 text-xs leading-5 text-muted-foreground"><ShieldCheck className="mr-1 inline h-3.5 w-3.5" />The engineer can prepare queries, migrations, and fixes. Writing data or changing schema must be confirmed by you before execution.</p>
        </CardContent>
      </Card>
      <DepartmentChat departmentSlug="backend-engineering" departmentName="Backend Engineer" providers={providers} authenticationConfigured={authenticationConfigured} enableDatabaseActions />
    </div>
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><FileText className="h-5 w-5" />Obsidian database structure</CardTitle><p className="text-sm text-muted-foreground">Continuously write an Obsidian-friendly database overview and one note per table into a vault on this server. Raw customer and payment records are not exported.</p></CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end"><form onSubmit={connectObsidian} className="flex flex-1 flex-col gap-2 sm:flex-row"><Input value={vaultPath} onChange={(event) => setVaultPath(event.target.value)} placeholder="Absolute server path to Obsidian vault, e.g. /home/user/Obsidian" disabled={!status.connected || connectingObsidian} /><Button type="submit" disabled={!status.connected || !vaultPath.trim() || connectingObsidian}>{connectingObsidian ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}{connectingObsidian ? "Connecting…" : "Connect Obsidian"}</Button></form><p className="text-xs text-muted-foreground">{obsidian.connected ? `Live sync active · ${obsidian.vaultPath} · ${obsidian.lastSyncedAt ? new Date(obsidian.lastSyncedAt).toLocaleString() : "syncing"}` : obsidian.error || "Connect a vault after Neon."}</p></CardContent>
    </Card>
    {status.connected && <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Table2 className="h-5 w-5" />Live database data</CardTitle><p className="text-sm text-muted-foreground">Select any detected table to view its current records. Up to 100 rows are shown at a time.</p></CardHeader>
      <CardContent className="space-y-4"><div className="flex flex-wrap gap-2">{(status.tables || []).map((table) => <Button key={`${table.schema}.${table.name}`} type="button" size="sm" variant={selectedTable?.schema === table.schema && selectedTable.name === table.name ? "default" : "outline"} onClick={() => void loadTable(table)}>{table.name} <span className="ml-1 text-xs opacity-70">{table.columns}</span></Button>)}</div>{!(status.tables || []).length && <p className="text-sm text-muted-foreground">No accessible tables were found.</p>}{loadingData && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading records…</p>}{dataError && <p className="text-sm text-destructive">{dataError}</p>}{data && <div className="overflow-auto rounded-lg border"><p className="border-b px-3 py-2 text-xs text-muted-foreground">{data.totalRows} visible row{data.totalRows === 1 ? "" : "s"} · showing up to 100</p><table className="min-w-full text-left text-xs"><thead className="bg-muted/50"><tr>{data.columns.map((column) => <th key={column} className="whitespace-nowrap px-3 py-2 font-medium">{column}</th>)}</tr></thead><tbody>{data.rows.map((row, index) => <tr key={index} className="border-t">{data.columns.map((column) => <td key={column} className="max-w-72 whitespace-nowrap px-3 py-2 align-top">{typeof row[column] === "object" && row[column] !== null ? JSON.stringify(row[column]) : String(row[column] ?? "—")}</td>)}</tr>)}</tbody></table>{!data.rows.length && <p className="p-4 text-sm text-muted-foreground">No rows are visible to the connected Neon role. If this table has data, reconnect with a role permitted to read its rows or review its row-level security policy.</p>}</div>}</CardContent>
    </Card>}
  </div>;
}
