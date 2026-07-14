import { DEPARTMENT_BY_ID } from "./catalog";
import type {
  ActionPolicy,
  ApprovalMode,
  DepartmentId,
  ExternalAction,
  PolicyDecision,
  RiskLevel,
} from "./types";

/** Company-wide minimum controls. A department may be more restrictive. */
export const ACTION_POLICIES: Readonly<Record<ExternalAction, ActionPolicy>> = {
  "internal-read": policy("internal-read", "low", "autonomous"),
  "internal-write": policy("internal-write", "low", "policy-check", ["Actor has organization and department scope"]),
  "public-content-draft": policy("public-content-draft", "low", "autonomous"),
  "public-content-publish": policy("public-content-publish", "medium", "human-approval", ["Brand, claims, rights and platform checks pass"]),
  "prospect-enrichment": policy("prospect-enrichment", "medium", "policy-check", ["Source permits business use", "Purpose and provenance are recorded", "Suppression list is checked"]),
  "commercial-email-send": policy("commercial-email-send", "high", "human-approval", ["Sender identity is disclosed", "Applicable consent or lawful basis is recorded", "Unsubscribe mechanism is active", "Suppression list is checked"]),
  "social-direct-message-send": policy("social-direct-message-send", "high", "human-approval", ["Platform automation rules permit the action", "Recipient has not opted out", "Automation is disclosed when required"]),
  "outbound-call-place": policy("outbound-call-place", "high", "human-approval", ["Do-not-call and quiet-hours checks pass", "AI identity and recording disclosure are configured", "Jurisdiction is supported"]),
  "customer-message-send": policy("customer-message-send", "medium", "policy-check", ["Response is within the approved knowledge base", "Safety and privacy checks pass"]),
  "ad-spend-change": policy("ad-spend-change", "high", "human-approval", ["Change is inside the approved campaign and budget envelope"]),
  "contract-or-terms-change": policy("contract-or-terms-change", "critical", "qualified-professional", ["Versioned legal review is attached", "Authorized signatory approves"]),
  "legal-advice-publish": policy("legal-advice-publish", "critical", "qualified-professional", ["Jurisdiction and licensed reviewer are recorded"]),
  "personal-data-export": policy("personal-data-export", "critical", "dual-control", ["Documented purpose and lawful basis", "Least-data and secure-destination checks pass"]),
  "refund-create": policy("refund-create", "high", "human-approval", ["Amount is within connector and owner limits", "Order and reason are recorded"]),
  "payout-create": policy("payout-create", "critical", "dual-control", ["Beneficiary is verified", "Connector limits and available balance pass"]),
  "bank-or-payment-settings-change": policy("bank-or-payment-settings-change", "critical", "dual-control", ["Owner is one approver", "Out-of-band verification passes"]),
  "tax-or-regulatory-filing": policy("tax-or-regulatory-filing", "critical", "qualified-professional", ["Qualified reviewer and authorized signatory approve"]),
  "product-release": policy("product-release", "high", "human-approval", ["Quality, safety, rights and legal gates pass"]),
  "credential-or-permission-change": policy("credential-or-permission-change", "critical", "dual-control", ["Least privilege review passes", "Owner or security administrator approves"]),
  "external-account-create": policy("external-account-create", "critical", "dual-control", ["Owner completes identity, terms, CAPTCHA and verification steps", "Platform automation policy permits the intended use", "Least-privilege scopes and recovery ownership are recorded"]),
  "external-mailbox-read": policy("external-mailbox-read", "medium", "policy-check", ["Mailbox is company-owned", "Untrusted message content is isolated from instructions", "Spam, blocked and unauthenticated mail are excluded"]),
  "cloud-computer-create": policy("cloud-computer-create", "critical", "human-approval", ["Workspace, size, cost and purpose are approved", "Machine has no unreviewed company secrets"]),
  "cloud-computer-view": policy("cloud-computer-view", "high", "human-approval", ["Owner approves the specific computer and task", "Screenshot may contain sensitive information"]),
  "cloud-computer-control": policy("cloud-computer-control", "critical", "human-approval", ["Exact operation and target computer are approved", "External side effects remain separately approval-gated"]),
  "sandbox-code-execute": policy("sandbox-code-execute", "high", "human-approval", ["Command, timeout and purpose are approved", "No company secrets are injected", "Sandbox is destroyed after the job"]),
  "agent-loop-start": policy("agent-loop-start", "medium", "policy-check", ["Budget, time, rate and action limits are configured", "Loop has a kill switch and idempotency key"]),
  "agent-loop-pause": policy("agent-loop-pause", "low", "autonomous"),
};

function policy(
  action: ExternalAction,
  risk: RiskLevel,
  approval: ApprovalMode,
  conditions: readonly string[] = [],
): ActionPolicy {
  return { action, risk, approval, conditions, auditRequired: true };
}

/**
 * Pure authorization decision used before a task is queued or a connector is
 * called. Runtime approval state is intentionally evaluated by the caller.
 */
export function evaluateDepartmentAction(
  departmentId: DepartmentId,
  action: ExternalAction,
): PolicyDecision {
  const department = DEPARTMENT_BY_ID[departmentId];
  const actionPolicy = ACTION_POLICIES[action];
  const isAutonomous = department.autonomousActions.includes(action as never);
  const needsDepartmentApproval = department.approvalRequiredActions.includes(action as never);

  if (!isAutonomous && !needsDepartmentApproval) {
    return {
      allowed: false,
      action,
      risk: actionPolicy.risk,
      approval: actionPolicy.approval,
      reasons: [`${department.name} has no grant for ${action}`],
    };
  }

  const approval = needsDepartmentApproval && actionPolicy.approval === "autonomous"
    ? "human-approval"
    : actionPolicy.approval;

  return {
    allowed: true,
    action,
    risk: actionPolicy.risk,
    approval,
    reasons: actionPolicy.conditions,
  };
}

export interface AgentLoopGuardrails {
  maxIterations: number;
  maxRuntimeSeconds: number;
  maxConsecutiveFailures: number;
  maxSpendMinor: number;
  currency: string;
  requireIdempotencyKey: true;
  stopOnPolicyDenial: true;
  heartbeatSeconds: number;
}

export const DEFAULT_AGENT_LOOP_GUARDRAILS: Readonly<AgentLoopGuardrails> = {
  maxIterations: 100,
  maxRuntimeSeconds: 3_600,
  maxConsecutiveFailures: 3,
  maxSpendMinor: 0,
  currency: "USD",
  requireIdempotencyKey: true,
  stopOnPolicyDenial: true,
  heartbeatSeconds: 30,
};
