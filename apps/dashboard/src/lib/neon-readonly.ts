import { PrismaClient } from "@prisma/client";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";

type NeonTable = { schema: string; name: string; columns: number };

export type NeonConnectionStatus = {
  connected: boolean;
  accessMode?: "read_only" | "engineering";
  database?: string;
  role?: string;
  tables: NeonTable[];
  checkedAt?: string;
  error?: string;
};

type NeonRuntime = { url?: string; accessMode?: "read_only" | "engineering"; obsidianVaultPath?: string; obsidianInterval?: NodeJS.Timeout; status: NeonConnectionStatus };

const globalForNeon = globalThis as unknown as { spiritualAiNeon?: NeonRuntime };
const runtime = globalForNeon.spiritualAiNeon ?? { status: { connected: false, tables: [] } };
globalForNeon.spiritualAiNeon = runtime;
const connectionFile = process.env.FACTORY_NEON_CONNECTION_FILE || join(process.cwd(), ".factory-secrets", "neon-connection.json");

function key() {
  const secret = process.env.FACTORY_ENCRYPTION_KEY?.trim();
  if (!secret) throw new Error("Set FACTORY_ENCRYPTION_KEY to persist the Neon connection securely.");
  return createHash("sha256").update(secret).digest();
}

async function persistConnection(url: string, accessMode: "read_only" | "engineering") {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify({ url, accessMode, obsidianVaultPath: runtime.obsidianVaultPath }), "utf8"), cipher.final()]);
  await mkdir(dirname(connectionFile), { recursive: true, mode: 0o700 });
  await writeFile(connectionFile, JSON.stringify({ iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), value: encrypted.toString("base64") }), { mode: 0o600 });
}

async function restoreConnection() {
  if (runtime.url) return;
  try {
    const stored = JSON.parse(await readFile(connectionFile, "utf8")) as { iv: string; tag: string; value: string };
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(stored.iv, "base64"));
    decipher.setAuthTag(Buffer.from(stored.tag, "base64"));
    const decoded = Buffer.concat([decipher.update(Buffer.from(stored.value, "base64")), decipher.final()]).toString("utf8");
    const connection = JSON.parse(decoded) as { url: string; accessMode: "read_only" | "engineering"; obsidianVaultPath?: string };
    runtime.obsidianVaultPath = connection.obsidianVaultPath;
    await connectNeon(connection.url, connection.accessMode, false);
    if (runtime.obsidianVaultPath) {
      startObsidianSync();
      void syncObsidian();
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") runtime.status = { connected: false, tables: [], error: error instanceof Error ? error.message : "Saved Neon connection could not be restored." };
  }
}

function clientFor(url: string) {
  return new PrismaClient({ datasources: { db: { url } } });
}

export async function connectNeon(url: string, accessMode: "read_only" | "engineering", persist = true): Promise<NeonConnectionStatus> {
  const client = clientFor(url);
  try {
    const identity = await client.$queryRawUnsafe<Array<{ database: string; role: string }>>(
      "SELECT current_database() AS database, current_user AS role",
    );
    const tables = await client.$queryRawUnsafe<NeonTable[]>(`
      SELECT table_schema AS schema, table_name AS name, COUNT(column_name)::int AS columns
      FROM information_schema.columns
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
      GROUP BY table_schema, table_name
      ORDER BY table_schema, table_name
      LIMIT 80
    `);
    const status: NeonConnectionStatus = {
      connected: true,
      accessMode,
      database: identity[0]?.database,
      role: identity[0]?.role,
      tables,
      checkedAt: new Date().toISOString(),
    };
    runtime.url = url;
    runtime.accessMode = accessMode;
    runtime.status = status;
    if (persist) await persistConnection(url, accessMode);
    return status;
  } catch (error) {
    const status: NeonConnectionStatus = {
      connected: false,
      tables: [],
      checkedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message.replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[database URL]") : "Neon could not be reached.",
    };
    runtime.status = status;
    return status;
  } finally {
    await client.$disconnect();
  }
}

export async function neonReadonlyStatus(): Promise<NeonConnectionStatus> {
  await restoreConnection();
  return runtime.status;
}

export async function hasEngineeringDatabaseAccess() {
  await restoreConnection();
  return Boolean(runtime.url && runtime.accessMode === "engineering");
}

export async function readNeonTable(schema: string, table: string, limit = 100): Promise<{ columns: string[]; rows: Record<string, unknown>[]; totalRows: number }> {
  await restoreConnection();
  if (!runtime.url) throw new Error("Connect a database before reading its data.");
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema) || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(table)) throw new Error("Invalid database table.");
  const client = clientFor(runtime.url);
  try {
    const exists = await client.$queryRawUnsafe<Array<{ found: boolean }>>(
      "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2) AS found",
      schema,
      table,
    );
    if (!exists[0]?.found) throw new Error("That table is not available in the connected database.");
    const safeSchema = `"${schema}"`;
    const safeTable = `"${table}"`;
    const total = await client.$queryRawUnsafe<Array<{ count: bigint }>>(`SELECT COUNT(*)::bigint AS count FROM ${safeSchema}.${safeTable}`);
    const rawRows = await client.$queryRawUnsafe<Array<{ data: Record<string, unknown> | string }>>(`SELECT to_jsonb(record) AS data FROM ${safeSchema}.${safeTable} AS record LIMIT ${Math.min(Math.max(limit, 1), 100)}`);
    const rows = rawRows.map(({ data }) => typeof data === "string" ? JSON.parse(data) as Record<string, unknown> : data);
    const columns = rows[0] ? Object.keys(rows[0]) : (await client.$queryRawUnsafe<Array<{ column_name: string }>>(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position",
      schema,
      table,
    )).map((column) => column.column_name);
    return { columns, rows, totalRows: Number(total[0]?.count || 0) };
  } finally {
    await client.$disconnect();
  }
}

export async function executeNeonSql(sql: string): Promise<{ rows: unknown[]; rowCount: number }> {
  await restoreConnection();
  if (!runtime.url) throw new Error("Connect a database before executing SQL.");
  const client = clientFor(runtime.url);
  try {
    if (/^(select|with|show|explain|values)\b/i.test(sql.trim())) {
      const result = await client.$queryRawUnsafe<unknown[]>(sql);
      return { rows: Array.isArray(result) ? result.slice(0, 200) : [], rowCount: Array.isArray(result) ? result.length : 0 };
    }
    const affected = await client.$executeRawUnsafe(sql);
    return { rows: [], rowCount: affected };
  } finally {
    await client.$disconnect();
  }
}

export type ObsidianSyncStatus = { connected: boolean; vaultPath?: string; lastSyncedAt?: string; error?: string };
const obsidianState: ObsidianSyncStatus = { connected: false };

function entityForTable(name: string) {
  const normalized = name.toLowerCase();
  if (/(user|customer|profile|member)/.test(normalized)) return "Users";
  if (/(blueprint|report|reading)/.test(normalized)) return "Blueprints";
  if (/(product|plan|package|catalog)/.test(normalized)) return "Products";
  if (/(referral|referer|affiliate|invite)/.test(normalized)) return "Referrals";
  if (/(order|purchase|payment|transaction|invoice)/.test(normalized)) return "Purchases";
  return "Other Tables";
}

function markdownForDatabase() {
  const tables = runtime.status.tables || [];
  return [
    "---", "generated_by: Spiritual AI Factory", `updated_at: ${new Date().toISOString()}`, "---", "",
    "# Database Overview", "",
    `- Database: ${runtime.status.database || "Unknown"}`,
    `- Role: ${runtime.status.role || "Unknown"}`,
    `- Tables: ${tables.length}`, "",
    "## Business structure", "",
    ...["Users", "Blueprints", "Products", "Referrals", "Purchases", "Other Tables"].map((entity) => `- [[${entity}/${entity}|${entity}]]`), "",
    "## Tables", "",
    ...tables.map((table) => `- [[Tables/${table.schema}.${table.name}|${table.schema}.${table.name}]] — ${table.columns} columns · ${entityForTable(table.name)}`), "",
    "> This vault sync contains database structure only. It does not export raw customer, payment, or order records.", "",
  ].join("\n");
}

function markdownCell(value: unknown) {
  if (value === null || value === undefined) return "—";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return text.replaceAll("|", "\\|").replaceAll("\n", " ").slice(0, 500);
}

function markdownTable(columns: string[], rows: Record<string, unknown>[]) {
  if (!columns.length) return "No columns found.";
  if (!rows.length) return "No visible records.";
  return [
    `| ${columns.map(markdownCell).join(" | ")} |`,
    `| ${columns.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${columns.map((column) => markdownCell(row[column])).join(" | ")} |`),
  ].join("\n");
}

async function syncObsidian() {
  if (!runtime.obsidianVaultPath || !runtime.url) return;
  try {
    await connectNeon(runtime.url, runtime.accessMode || "read_only", false);
    const root = join(runtime.obsidianVaultPath, "Spiritual AI Factory Database");
    const tablesDir = join(root, "Tables");
    await mkdir(tablesDir, { recursive: true });
    const entityFolders = ["Users", "Blueprints", "Products", "Referrals", "Purchases", "Other Tables"];
    await Promise.all(entityFolders.map((entity) => mkdir(join(root, entity), { recursive: true })));
    await writeFile(join(root, "Database Overview.md"), markdownForDatabase(), "utf8");
    const tableData = await Promise.all((runtime.status.tables || []).map(async (table) => ({ table, data: await readNeonTable(table.schema, table.name) })));
    await Promise.all(tableData.map(({ table, data }) => writeFile(join(tablesDir, `${table.schema}.${table.name}.md`), ["---", "generated_by: Spiritual AI Factory", `updated_at: ${new Date().toISOString()}`, "---", "", `# ${table.schema}.${table.name}`, "", `- Schema: ${table.schema}`, `- Columns: ${table.columns}`, `- Records visible: ${data.totalRows}`, `- Business entity: [[${entityForTable(table.name)}/${entityForTable(table.name)}]]`, "", "## Current records", "", markdownTable(data.columns, data.rows), "", `> Showing up to ${data.rows.length} current records. This file may contain private database data; restrict vault access accordingly.`, ""].join("\n"), "utf8")));
    await Promise.all(entityFolders.map(async (entity) => {
      const matching = (runtime.status.tables || []).filter((table) => entityForTable(table.name) === entity);
      const relationship = entity === "Purchases"
        ? "Purchases connect the buyer, product, delivered blueprint/report, payment, and referral attribution where those relationships exist in the database."
        : entity === "Referrals"
          ? "Referrals connect the referrer, referred user, and any resulting purchases."
          : "Linked tables below are inferred from the database schema.";
      const links = matching.length
        ? matching.map((table) => "- [[Tables/" + table.schema + "." + table.name + "|" + table.schema + "." + table.name + "]]" )
        : ["- No matching table was found in the current schema."];
      const content = ["---", "generated_by: Spiritual AI Factory", `updated_at: ${new Date().toISOString()}`, "---", "", `# ${entity}`, "", relationship, "", "## Connected tables", "", ...links, ""].join("\n");
      await writeFile(join(root, entity, `${entity}.md`), content, "utf8");
    }));
    const emptyTables = tableData.filter(({ data }) => data.totalRows === 0).map(({ table }) => `- [[Tables/${table.schema}.${table.name}|${table.schema}.${table.name}]] — empty; review whether it is planned, archival, staging, or removable.`);
    await writeFile(join(root, "Database Review.md"), ["---", "generated_by: Spiritual AI Factory", `updated_at: ${new Date().toISOString()}`, "---", "", "# Database Review", "", "## Tables requiring review", "", ...(emptyTables.length ? emptyTables : ["- No empty tables were found."]), "", "## Important", "", "This report identifies review candidates only. It does not label a table pointless: migration, audit, staging, queue, and future-feature tables can legitimately be empty. Use the Backend Engineer chat to inspect dependencies before deleting any table.", ""].join("\n"), "utf8");
    obsidianState.connected = true; obsidianState.vaultPath = runtime.obsidianVaultPath; obsidianState.lastSyncedAt = new Date().toISOString(); obsidianState.error = undefined;
  } catch (error) { obsidianState.connected = false; obsidianState.error = error instanceof Error ? error.message : "Obsidian sync failed."; }
}

function startObsidianSync() {
  if (runtime.obsidianInterval) clearInterval(runtime.obsidianInterval);
  runtime.obsidianInterval = setInterval(() => void syncObsidian(), 60_000);
  runtime.obsidianInterval.unref?.();
}

export async function connectObsidianVault(vaultPath: string): Promise<ObsidianSyncStatus> {
  await restoreConnection();
  if (!runtime.url) throw new Error("Connect Neon before connecting an Obsidian vault.");
  if (!isAbsolute(vaultPath)) throw new Error("Enter an absolute path to an Obsidian vault on this server.");
  await access(vaultPath);
  runtime.obsidianVaultPath = vaultPath;
  await persistConnection(runtime.url, runtime.accessMode || "read_only");
  startObsidianSync();
  await syncObsidian();
  return obsidianState;
}

export async function obsidianSyncStatus(): Promise<ObsidianSyncStatus> {
  await restoreConnection();
  return obsidianState;
}
