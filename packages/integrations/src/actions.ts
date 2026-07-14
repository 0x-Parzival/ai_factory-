export type BusinessActionRisk = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type BusinessActionKind =
  | "research.read"
  | "analytics.read"
  | "content.draft"
  | "email.send"
  | "social.publish"
  | "social.message"
  | "voice.call"
  | "contract.accept"
  | "payment.create"
  | "payment.refund"
  | "account.connect"
  | "customer.record.update";

export interface BusinessAction<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  id: string;
  organizationId: string;
  departmentId: string;
  taskId: string;
  kind: BusinessActionKind;
  payload: TPayload;
  idempotencyKey: string;
  requestedBy: string;
  requestedAt: Date;
}

export const OUTREACH_RELATIONSHIP_BASES = ["inbound", "opt_in", "existing_relationship", "approved_ad"] as const;
export type OutreachRelationshipBasis = (typeof OUTREACH_RELATIONSHIP_BASES)[number];

export interface OutreachApprovalContext extends Record<string, unknown> {
  channel: string;
  recipientId: string;
  message: string;
  relationshipBasis: OutreachRelationshipBasis;
  suppressionCheckedAt: string;
  suppressed: boolean;
  platformPolicyConfirmed: boolean;
  aiDisclosure: boolean;
  consentEvidence?: {
    source: string;
    recordedAt: string;
  };
}

function isValidTimestamp(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 && !Number.isNaN(Date.parse(value));
}

export function validateOutreachApprovalContext(payload: Record<string, unknown>): string[] {
  const context = payload.outreach as Partial<OutreachApprovalContext> | undefined;
  const reasons: string[] = [];
  if (!context || typeof context !== "object" || Array.isArray(context)) {
    return ["Outreach approval context is required"];
  }
  if (typeof context.channel !== "string" || !context.channel.trim()) reasons.push("Outreach channel is required");
  if (typeof context.recipientId !== "string" || !context.recipientId.trim()) reasons.push("Stable outreach recipientId is required");
  if (typeof context.message !== "string" || !context.message.trim()) reasons.push("Exact outreach message is required");
  if (typeof context.message === "string" && context.message.length > 10_000) reasons.push("Outreach message exceeds the 10,000 character limit");
  if (!OUTREACH_RELATIONSHIP_BASES.includes(context.relationshipBasis as OutreachRelationshipBasis)) reasons.push("Permitted outreach relationshipBasis is required");
  if (!isValidTimestamp(context.suppressionCheckedAt)) reasons.push("A dated suppression check is required");
  if (context.suppressed !== false) reasons.push("Suppressed or unchecked recipients cannot be contacted");
  if (context.platformPolicyConfirmed !== true) reasons.push("Platform messaging eligibility must be confirmed");
  if (context.aiDisclosure !== true) reasons.push("AI assistant disclosure must be enabled");
  if (context.relationshipBasis === "opt_in") {
    if (!context.consentEvidence?.source?.trim() || !isValidTimestamp(context.consentEvidence.recordedAt)) {
      reasons.push("Opt-in outreach requires a source and dated consent evidence");
    }
  }
  return reasons;
}

export interface ActionDecision {
  allowed: boolean;
  risk: BusinessActionRisk;
  requiresHumanApproval: boolean;
  reasons: string[];
}

const RISK: Record<BusinessActionKind, BusinessActionRisk> = {
  "research.read": "LOW",
  "analytics.read": "LOW",
  "content.draft": "LOW",
  "customer.record.update": "MEDIUM",
  "email.send": "HIGH",
  "social.publish": "HIGH",
  "social.message": "HIGH",
  "voice.call": "HIGH",
  "contract.accept": "CRITICAL",
  "payment.create": "CRITICAL",
  "payment.refund": "CRITICAL",
  "account.connect": "CRITICAL",
};

export function evaluateBusinessAction(action: BusinessAction): ActionDecision {
  const risk = RISK[action.kind];
  const blockingReasons: string[] = [];
  const reviewReasons: string[] = [];
  if (!action.organizationId || !action.departmentId || !action.taskId) blockingReasons.push("Missing ownership context");
  if (!action.idempotencyKey) blockingReasons.push("Missing idempotency key");
  if (action.kind === "email.send" || action.kind === "social.message") {
    blockingReasons.push(...validateOutreachApprovalContext(action.payload));
  }
  const requiresHumanApproval = risk === "HIGH" || risk === "CRITICAL";
  if (requiresHumanApproval) reviewReasons.push(`${action.kind} affects an external person, public channel, contract, or funds`);
  return {
    allowed: blockingReasons.length === 0,
    risk,
    requiresHumanApproval,
    reasons: [...blockingReasons, ...reviewReasons],
  };
}

export interface ActionConnector<TPayload extends Record<string, unknown> = Record<string, unknown>, TResult = unknown> {
  readonly id: string;
  readonly supportedActions: BusinessActionKind[];
  health(): Promise<{ configured: boolean; reachable: boolean; error?: string }>;
  execute(action: BusinessAction<TPayload>, approvalToken?: string): Promise<TResult>;
}

export abstract class ApprovalGatedConnector<TPayload extends Record<string, unknown> = Record<string, unknown>, TResult = unknown>
  implements ActionConnector<TPayload, TResult>
{
  abstract readonly id: string;
  abstract readonly supportedActions: BusinessActionKind[];
  abstract health(): Promise<{ configured: boolean; reachable: boolean; error?: string }>;

  async execute(action: BusinessAction<TPayload>, approvalToken?: string): Promise<TResult> {
    if (!this.supportedActions.includes(action.kind)) throw new Error(`${this.id} does not support ${action.kind}`);
    const decision = evaluateBusinessAction(action);
    if (!decision.allowed) throw new Error(decision.reasons.join("; "));
    if (decision.requiresHumanApproval && !approvalToken) {
      throw new Error(`Human approval is required for ${action.kind}`);
    }
    return this.executeApproved(action);
  }

  protected abstract executeApproved(action: BusinessAction<TPayload>): Promise<TResult>;
}
