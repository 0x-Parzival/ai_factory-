export const APP_CONFIG = {
  name: "Spiritual AI Factory",
  tagline: "A governed autonomous company for Spiritual AI",
  version: "1.0.0",
  description: "A shared control plane for AI departments, agents and operations",
} as const;

export const PAGINATION = { defaultLimit: 20, maxLimit: 100, defaultPage: 1 } as const;

export const EMPLOYEE_DEFAULTS = {
  /** The model is resolved from an organization's configured provider. */
  model: "",
  temperature: 0.7,
  maxTokens: 4096,
  status: "ACTIVE" as const,
  employmentType: "AI_AGENT" as const,
} as const;

export const WORKFLOW_DEFAULTS = {
  version: "1.0.0",
  status: "DRAFT" as const,
  trigger: "MANUAL" as const,
} as const;

export const BUDGET_DEFAULTS = { currency: "USD", period: "MONTHLY" as const } as const;
export const NOTIFICATION_DEFAULTS = { priority: "NORMAL" as const, channels: ["IN_APP"] as const } as const;
export const WHATSAPP_DEFAULTS = {
  groupName: "Spiritual AI Factory",
  groupDescription: "Owner and authorized AI departments",
} as const;
export const PIXEL_OFFICE_DEFAULTS = { width: 50, height: 30, floors: 3 } as const;
export const JARVIS_DEFAULTS = {
  wakeWord: "jarvis",
  language: "en-US",
  voiceId: "default",
  speakResponses: true,
  confirmActions: true,
} as const;

export { SPIRITUAL_AI_DEPARTMENTS as DEPARTMENTS } from "../company/catalog";
export type { DepartmentDefinition as DepartmentConfig } from "../company/types";

/** Compatibility mapping for existing persona categories into the real company structure. */
export const PERSONA_TO_DEPARTMENT_MAP: Record<string, string> = {
  ENGINEERING: "product-management",
  DESIGN: "product-management",
  MARKETING: "marketing",
  SALES: "sales",
  PRODUCT: "product-management",
  STRATEGY: "ceo",
  SUPPORT: "customer-care",
  TESTING: "product-management",
  DATA: "data-science-analytics",
  INFRASTRUCTURE: "product-management",
  GAME_DEVELOPMENT: "product-management",
  ACADEMIC: "product-management",
  SPECIALIZED: "product-management",
  OPERATIONS: "ceo",
  FINANCE: "finance",
  HR: "ceo",
  LEGAL: "legal",
  SECURITY: "legal",
  RESEARCH: "market-research",
};

/** Provider metadata contains no stale model names or prices. */
export { AI_PROVIDERS as MODEL_PROVIDERS } from "../company/catalog";
export type { AIProviderId as ModelProvider } from "../company/types";

export interface ModelTokenRates {
  inputPerMillion: number;
  outputPerMillion: number;
}

/** Calculate cost from rates captured with the actual provider response or billing configuration. */
export function calculateCost(
  provider: import("../company/types").AIProviderId,
  model: string,
  inputTokens: number,
  outputTokens: number,
  rates: ModelTokenRates,
): number {
  void provider;
  void model;
  return (inputTokens / 1_000_000) * rates.inputPerMillion
    + (outputTokens / 1_000_000) * rates.outputPerMillion;
}

export const SKILL_CATEGORIES = {
  DEVELOPMENT: { name: "Development", color: "#3b82f6", icon: "code" },
  DESIGN: { name: "Design", color: "#ec4899", icon: "palette" },
  MARKETING: { name: "Marketing", color: "#10b981", icon: "megaphone" },
  SALES: { name: "Sales", color: "#f59e0b", icon: "handshake" },
  DATA_ANALYSIS: { name: "Data Analysis", color: "#8b5cf6", icon: "bar-chart" },
  AUTOMATION: { name: "Automation", color: "#06b6d4", icon: "zap" },
  COMMUNICATION: { name: "Communication", color: "#f97316", icon: "message-square" },
  RESEARCH: { name: "Research", color: "#64748b", icon: "search" },
  SECURITY: { name: "Security", color: "#ef4444", icon: "shield" },
  INFRASTRUCTURE: { name: "Infrastructure", color: "#14b8a6", icon: "server" },
  AI_ML: { name: "AI/ML", color: "#d946ef", icon: "brain" },
  WRITING: { name: "Writing", color: "#eab308", icon: "pen-tool" },
  TRANSLATION: { name: "Translation", color: "#84cc16", icon: "globe" },
  FINANCE: { name: "Finance", color: "#22c55e", icon: "dollar-sign" },
  HR: { name: "HR", color: "#f43f5e", icon: "users" },
  LEGAL: { name: "Legal", color: "#6366f1", icon: "gavel" },
  CUSTOMER_SUPPORT: { name: "Customer Support", color: "#f97316", icon: "headphones" },
  PROJECT_MANAGEMENT: { name: "Project Management", color: "#0ea5e9", icon: "clipboard" },
} as const;

export const STATUS_COLORS = {
  ACTIVE: "bg-green-500",
  ONBOARDING: "bg-blue-500",
  ON_LEAVE: "bg-yellow-500",
  OFFBOARDING: "bg-orange-500",
  TERMINATED: "bg-red-500",
  ARCHIVED: "bg-gray-500",
  TODO: "bg-gray-500",
  BACKLOG: "bg-slate-500",
  IN_PROGRESS: "bg-blue-500",
  IN_REVIEW: "bg-purple-500",
  BLOCKED: "bg-red-500",
  NEEDS_APPROVAL: "bg-amber-500",
  APPROVED: "bg-green-500",
  DONE: "bg-emerald-500",
  CANCELLED: "bg-gray-500",
  DRAFT: "bg-gray-500",
  RUNNING: "bg-blue-500",
  COMPLETED: "bg-green-500",
  FAILED: "bg-red-500",
  PAUSED: "bg-yellow-500",
  PENDING: "bg-amber-500",
  REJECTED: "bg-red-500",
  EXPIRED: "bg-gray-500",
  ESCALATED: "bg-orange-500",
  IDLE: "bg-gray-500",
  WALKING: "bg-blue-500",
  WORKING: "bg-green-500",
  TYPING: "bg-purple-500",
  THINKING: "bg-yellow-500",
  MEETING: "bg-indigo-500",
  BREAK: "bg-orange-500",
  OFFLINE: "bg-gray-400",
  ERROR: "bg-red-500",
  CELEBRATING: "bg-pink-500",
} as const;

export const PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^\+?[1-9]\d{1,14}$/,
  slug: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  url: /^https?:\/\//,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  cuid: /^c[a-z0-9]{24}$/,
  hexColor: /^#[0-9a-f]{6}$/i,
  time24: /^([01]\d|2[0-3]):([0-5]\d)$/,
} as const;

export const FEATURE_FLAGS = {
  enableMarketplace: true,
  enablePixelAgents: true,
  enableVoiceControl: true,
  enableWhatsApp: true,
  enableWorkflows: true,
  enableApprovals: true,
  enableBudgetTracking: true,
  enablePerformanceReviews: true,
  enableGoals: true,
  enableIntegrations: true,
  enableWebhooks: true,
  enableMultiOrg: true,
  enableLocalLLM: true,
  enablePhysicalAgents: false,
} as const;
