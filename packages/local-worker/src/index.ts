import { writeFile } from "node:fs/promises";
import {
  AutonomousCompanyRuntime,
  InMemoryOrchestratorStore,
  type ActionKind,
  type DepartmentAgentAdapter,
  type DepartmentId,
  type DepartmentLoopProducer,
  type NewDepartmentTask,
} from "../../orchestrator/src/autonomy/index.ts";
import {
  ModelGateway,
  providerConfigFromEnv,
} from "../../integrations/src/index.ts";

const ORGANIZATION_ID = process.env.FACTORY_ORGANIZATION_ID || "local-spiritual-ai-factory";
const STATUS_FILE = process.env.FACTORY_STATUS_FILE || "/tmp/spiritual-ai-factory-worker-status.json";
const LOOP_INTERVAL_MS = Number(process.env.FACTORY_LOOP_INTERVAL_MS || 30 * 60_000);
const MODEL = process.env.OLLAMA_MODEL || "qwen2.5:0.5b";

type DepartmentConfig = {
  id: DepartmentId;
  name: string;
  capability: string;
  action: ActionKind;
  objective: string;
  system: string;
};

const departments: DepartmentConfig[] = [
  {
    id: "ceo",
    name: "CEO Orchestrator",
    capability: "company.operating_review",
    action: "analysis",
    objective: "Review factory readiness, sustainable revenue opportunities, dependencies, and risks; produce a prioritized internal operating brief.",
    system: "You are the CEO orchestrator for a spiritual AI company. Optimize sustainable, lawful revenue and customer value. Delegate clearly, respect budgets and safety gates, and never fabricate live business data.",
  },
  {
    id: "sales",
    name: "Sales",
    capability: "sales.pipeline_planning",
    action: "research",
    objective: "Create an internal prospect-research and qualification plan using only supplied facts. Do not contact anyone or invent leads.",
    system: "You are the Sales department. Work on consent-aware qualification, value discovery, CRM hygiene, and helpful follow-up. Never scrape prohibited sources, invent contacts, or perform outreach without approval.",
  },
  {
    id: "customer_care",
    name: "Customer Care",
    capability: "support.readiness_review",
    action: "analysis",
    objective: "Review the customer-care operating model and propose knowledge-base, escalation, privacy, and service-level readiness tasks.",
    system: "You are Customer Care. Be accurate, empathetic, privacy-preserving, and safety-aware. Escalate crisis, legal, refund, security, and unresolved cases to qualified humans.",
  },
  {
    id: "marketing",
    name: "Marketing & Growth",
    capability: "marketing.research_plan",
    action: "research",
    objective: "Produce a research plan for truthful spiritual AI content, channel fit, audience needs, and measurable conversion experiments. Do not claim access to live trends.",
    system: "You are Marketing and Growth. Create truthful, channel-native, rights-cleared content plans. Do not fabricate testimonials, results, engagement, or current market evidence.",
  },
  {
    id: "product",
    name: "Product Management",
    capability: "product.discovery_review",
    action: "analysis",
    objective: "Turn the current company brief into a product-discovery backlog for digital products, diagrams, audiobooks, and AI personas with acceptance and safety criteria.",
    system: "You are Product Management. Convert validated needs into scoped digital products with provenance, accessibility, QA, rights review, and safe spiritual guidance boundaries.",
  },
  {
    id: "legal",
    name: "Legal & Compliance",
    capability: "legal.research_plan",
    action: "research",
    objective: "Prepare an internal jurisdiction and compliance research checklist for privacy, outreach, platform rules, claims, consumer protection, intellectual property, and AI disclosure.",
    system: "You are a legal research department, not legal counsel. Identify issues and sources for qualified review. Never give final jurisdiction-specific advice, sign, file, or represent the company.",
  },
  {
    id: "finance",
    name: "Finance",
    capability: "finance.readiness_review",
    action: "analysis",
    objective: "Prepare a finance-readiness checklist for Razorpay reconciliation, cost attribution, budgets, forecasts, refunds, settlements, tax review, and anomaly controls.",
    system: "You are Finance. Maintain accurate, auditable records and conservative forecasts. Never move money, issue refunds, change accounts, or file taxes without required approval.",
  },
  {
    id: "data_analytics",
    name: "Data Science & Analytics",
    capability: "analytics.measurement_plan",
    action: "analysis",
    objective: "Design a privacy-preserving measurement plan for Microsoft Clarity, web analytics, funnels, UX friction, conversion, experiment design, and data quality.",
    system: "You are Data Science and Analytics. Separate observation from causal inference, protect personal data, reject dark patterns, and make evidence requirements explicit.",
  },
  {
    id: "seo_geo_aeo",
    name: "SEO, GEO & AEO",
    capability: "search.optimization_review",
    action: "analysis",
    objective: "Prepare an internal SEO, generative-engine optimization, and answer-engine optimization plan covering Search Console query and page analysis, search intent, content gaps, answer usefulness, entity coverage, structured-data drafts, and post-change measurement. Do not invent traffic or rankings.",
    system: "You are the SEO, GEO and AEO department. Improve useful discoverability using verified evidence. Distinguish classic search, generative retrieval and direct-answer needs. Never invent rankings, traffic, citations or backlinks; never use manipulative search tactics; draft changes for approval rather than publishing.",
  },
];

const gateway = new ModelGateway([
  { ...providerConfigFromEnv("ollama"), enabled: true, defaultModel: MODEL },
]);

function adapterFor(department: DepartmentConfig): DepartmentAgentAdapter {
  return {
    departmentId: department.id,
    provider: "ollama",
    capabilities: [department.capability],
    allowedActions: [department.action],
    async execute({ task, signal }) {
      if (signal.aborted) throw new Error("Task aborted");
      const response = await gateway.complete({
        provider: "ollama",
        model: MODEL,
        maxTokens: Math.min(task.budget.maxTokens, 700),
        temperature: 0.2,
        timeoutMs: 120_000,
        messages: [
          { role: "system", content: department.system },
          {
            role: "user",
            content: [
              `Objective: ${task.objective}`,
              "Known live state: the shared dashboard and local Ollama are running; cloud providers, business channels, telemetry, Razorpay, Clarity, and Telegram are not configured.",
              "Return a concise internal brief with: observations, prioritized next tasks, dependencies, risks, evidence needed, and stop conditions.",
            ].join("\n\n"),
          },
        ],
      });
      return {
        output: { brief: response.text, model: response.model, provider: response.provider },
        costUsd: 0,
        tokens: response.usage.totalTokens || 0,
        externalReferenceIds: [],
      };
    },
  };
}

function loopFor(department: DepartmentConfig): DepartmentLoopProducer {
  return {
    departmentId: department.id,
    async propose({ organizationId, now }): Promise<readonly NewDepartmentTask[]> {
      const window = Math.floor(now.getTime() / LOOP_INTERVAL_MS);
      return [{
        organizationId,
        departmentId: department.id,
        title: `${department.name} internal operating review`,
        objective: department.objective,
        capability: department.capability,
        action: department.action,
        input: { liveDataSources: ["local-ollama"], externalActionsAllowed: false },
        priority: department.id === "ceo" ? 100 : 60,
        idempotencyKey: `${department.id}:operating-review:${window}`,
        maxAttempts: 3,
        notBefore: now,
        budget: { maxCostUsd: 0, maxTokens: 2_500 },
        tags: ["internal-only", "local-ollama", "operating-review"],
      }];
    },
  };
}

const store = new InMemoryOrchestratorStore();
const runtime = new AutonomousCompanyRuntime({
  organizationId: ORGANIZATION_ID,
  store,
  adapters: departments.map(adapterFor),
  budgets: {
    organizationDaily: { maxCostUsd: 0, maxTokens: 1_000_000 },
    departmentDaily: { maxCostUsd: 0, maxTokens: 125_000 },
    defaultTask: { maxCostUsd: 0, maxTokens: 2_500 },
  },
  pollIntervalMs: 500,
  executionTimeoutMs: 120_000,
});

departments.forEach((department, index) => {
  runtime.registerLoop(loopFor(department), {
    intervalMs: LOOP_INTERVAL_MS,
    initialDelayMs: index * 750,
    jitterRatio: 0.05,
  });
});

let shuttingDown = false;

async function writeStatus(state: "running" | "stopping" | "stopped", error?: string) {
  const [tasks, approvals, audit] = await Promise.all([
    runtime.listTasks({ limit: 500 }),
    runtime.listApprovals({ limit: 500 }),
    runtime.listAudit({ limit: 500 }),
  ]);
  const status = {
    organizationId: ORGANIZATION_ID,
    state,
    workerPid: process.pid,
    provider: "ollama",
    model: MODEL,
    deployedAgents: departments.length,
    activeLoops: departments.length,
    queuedTasks: tasks.filter((task) => ["queued", "leased", "running", "retry_scheduled"].includes(task.status)).length,
    completedTasks: tasks.filter((task) => task.status === "succeeded").length,
    failedTasks: tasks.filter((task) => ["failed", "dead_letter"].includes(task.status)).length,
    pendingApprovals: approvals.filter((approval) => approval.status === "pending").length,
    lastEventAt: audit[0]?.occurredAt.toISOString(),
    updatedAt: new Date().toISOString(),
    externalActionsEnabled: false,
    agents: departments.map((department) => {
      const departmentTasks = tasks.filter((task) => task.departmentId === department.id);
      const latestTask = departmentTasks[0];
      const status = !latestTask
        ? "idle"
        : ["leased", "running"].includes(latestTask.status)
          ? "running"
          : ["queued", "retry_scheduled", "awaiting_approval"].includes(latestTask.status)
            ? "queued"
            : ["failed", "dead_letter"].includes(latestTask.status)
              ? "failed"
              : latestTask.status === "succeeded"
                ? "succeeded"
                : "idle";
      return {
        departmentId: String(department.id),
        departmentName: department.name,
        status,
        ...(["running", "queued"].includes(status) && latestTask ? { currentTask: latestTask.title } : {}),
        ...(latestTask ? { lastTask: latestTask.title, lastRunAt: latestTask.updatedAt.toISOString() } : {}),
        completedTasks: departmentTasks.filter((task) => task.status === "succeeded").length,
        failedTasks: departmentTasks.filter((task) => ["failed", "dead_letter"].includes(task.status)).length,
        provider: "ollama",
        model: MODEL,
      };
    }),
    recentEvents: audit.slice(0, 50).map((event) => ({
      id: event.id,
      type: event.type,
      actor: event.actor,
      departmentId: event.departmentId ? String(event.departmentId) : undefined,
      taskId: event.taskId,
      occurredAt: event.occurredAt.toISOString(),
    })),
    error,
  };
  await writeFile(STATUS_FILE, JSON.stringify(status, null, 2), { mode: 0o600 });
}

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  await writeStatus("stopping");
  await runtime.stop(signal, "system");
  await writeStatus("stopped");
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("uncaughtException", async (error) => {
  await writeStatus("stopped", error.message).catch(() => undefined);
  process.exit(1);
});
process.on("unhandledRejection", async (error) => {
  const message = error instanceof Error ? error.message : String(error);
  await writeStatus("stopped", message).catch(() => undefined);
  process.exit(1);
});

await writeStatus("running");
await runtime.start();
setInterval(() => void writeStatus("running"), 2_000).unref();
