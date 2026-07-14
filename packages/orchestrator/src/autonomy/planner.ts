import type { ActionKind, DepartmentId, MoneyAndTokenBudget, NewDepartmentTask } from './types';

export interface RevenueOpportunity {
  id: string;
  departmentId: DepartmentId;
  title: string;
  objective: string;
  capability: string;
  action: ActionKind;
  input?: Readonly<Record<string, unknown>>;
  expectedRevenueUsd: number;
  expectedCostUsd: number;
  timeToValueDays: number;
  confidence: number;
  customerValue: number;
  strategicFit: number;
  legalRisk: number;
  reputationalRisk: number;
  recurringRevenue: boolean;
  evidence: readonly string[];
  budget?: MoneyAndTokenBudget;
}

export interface CompanyPlanningContext {
  organizationId: string;
  cashRunwayDays: number;
  customerSatisfaction: number;
  opportunities: readonly RevenueOpportunity[];
  generatedAt: Date;
}

export interface PrioritizedOpportunity extends RevenueOpportunity {
  score: number;
  rationale: readonly string[];
}

export interface CeoPlannerPolicy {
  minimumEvidence: number;
  maximumLegalRisk: number;
  maximumReputationalRisk: number;
  minimumCustomerValue: number;
  maximumTasksPerCycle: number;
  defaultTaskBudget: MoneyAndTokenBudget;
}

const DEFAULT_POLICY: CeoPlannerPolicy = {
  minimumEvidence: 1,
  maximumLegalRisk: 0.6,
  maximumReputationalRisk: 0.5,
  minimumCustomerValue: 0.35,
  maximumTasksPerCycle: 5,
  defaultTaskBudget: { maxCostUsd: 10, maxTokens: 100_000 },
};

/** Deterministic, inspectable prioritizer. It optimizes durable customer value
 * and risk-adjusted margin, rather than raw outreach volume or short-term sales. */
export class SustainableRevenuePlanner {
  constructor(private readonly policy: CeoPlannerPolicy = DEFAULT_POLICY) {}

  prioritize(context: CompanyPlanningContext): PrioritizedOpportunity[] {
    return context.opportunities
      .filter(item => item.evidence.length >= this.policy.minimumEvidence)
      .filter(item => item.legalRisk <= this.policy.maximumLegalRisk)
      .filter(item => item.reputationalRisk <= this.policy.maximumReputationalRisk)
      .filter(item => item.customerValue >= this.policy.minimumCustomerValue)
      .filter(item => item.expectedCostUsd >= 0 && item.expectedRevenueUsd >= 0 && item.confidence >= 0 && item.confidence <= 1)
      .map(item => {
        const margin = Math.max(0, item.expectedRevenueUsd - item.expectedCostUsd);
        const marginSignal = Math.log1p(margin) / 10;
        const urgency = context.cashRunwayDays < 90 ? 1 / Math.max(1, item.timeToValueDays) : 0;
        const retentionWeight = context.customerSatisfaction < 0.7 ? item.customerValue * 0.25 : 0;
        const score =
          item.confidence * 0.2 +
          item.customerValue * 0.25 +
          item.strategicFit * 0.15 +
          marginSignal * 0.2 +
          (item.recurringRevenue ? 0.1 : 0) +
          urgency * 0.1 +
          retentionWeight -
          item.legalRisk * 0.15 -
          item.reputationalRisk * 0.15;
        const rationale = [
          `risk-adjusted margin $${Math.round(margin * item.confidence)}`,
          `customer value ${item.customerValue.toFixed(2)}`,
          item.recurringRevenue ? 'supports recurring revenue' : 'one-time revenue potential',
          `${item.evidence.length} evidence source(s)`,
        ];
        return { ...item, score, rationale };
      })
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
      .slice(0, this.policy.maximumTasksPerCycle);
  }

  createTasks(context: CompanyPlanningContext): NewDepartmentTask[] {
    return this.prioritize(context).map(item => ({
      organizationId: context.organizationId,
      departmentId: item.departmentId,
      title: item.title,
      objective: item.objective,
      capability: item.capability,
      action: item.action,
      input: {
        ...item.input,
        planning: {
          expectedRevenueUsd: item.expectedRevenueUsd,
          expectedCostUsd: item.expectedCostUsd,
          evidence: item.evidence,
          rationale: item.rationale,
          score: item.score,
        },
      },
      priority: Math.max(0, Math.min(100, Math.round(item.score * 50))),
      idempotencyKey: `ceo:${item.id}:${context.generatedAt.toISOString().slice(0, 10)}`,
      maxAttempts: 3,
      notBefore: context.generatedAt,
      budget: item.budget ?? this.policy.defaultTaskBudget,
      tags: ['ceo-planned', item.recurringRevenue ? 'recurring-revenue' : 'revenue'],
    }));
  }
}
