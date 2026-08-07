export type FactoryStatus = "not_configured" | "connected" | "paused" | "active";

export type ProviderBlueprint = {
  id: string;
  name: string;
  connectionLabel: string;
  status: FactoryStatus;
};

export type DepartmentBlueprint = {
  slug: string;
  name: string;
  shortName: string;
  purpose: string;
  powers: string[];
  requiredSystems: string[];
  approvalBoundaries: string[];
  loopBlueprints: string[];
  status: FactoryStatus;
};

// These are supported connection targets, not detected or live integrations.
export const MODEL_PROVIDERS: ProviderBlueprint[] = [
  { id: "codex", name: "ChatGPT via Codex", connectionLabel: "Local ChatGPT sign-in (codex login)", status: "not_configured" },
  { id: "openai", name: "OpenAI API", connectionLabel: "OpenAI API project and key (separate billing)", status: "not_configured" },
  { id: "hermes", name: "Hermes", connectionLabel: "Hermes-compatible endpoint and credentials", status: "not_configured" },
  { id: "anthropic", name: "Anthropic / Claude", connectionLabel: "Anthropic API key", status: "not_configured" },
  { id: "ollama", name: "Ollama", connectionLabel: "Reachable Ollama host and model", status: "not_configured" },
  { id: "openrouter", name: "OpenRouter", connectionLabel: "OpenRouter API key and model routing", status: "not_configured" },
  { id: "groq", name: "Groq", connectionLabel: "Groq API key", status: "not_configured" },
  { id: "nvidia", name: "NVIDIA API", connectionLabel: "NVIDIA API key and model endpoint", status: "not_configured" },
];

// Department blueprints describe intended authority. They do not represent deployed agents.
export const DEPARTMENTS: DepartmentBlueprint[] = [
  {
    slug: "cyber-security",
    name: "Cyber Security & Site Reliability",
    shortName: "Security",
    purpose: "Continuously observe the approved public site, AI-provider reachability, and security-response headers; create evidence-backed alerts and route any remediation that changes production systems for human approval.",
    powers: [
      "Perform read-only HTTPS availability and security-header checks on the configured site",
      "Check configured model-provider and trusted-host connector reachability",
      "Record observable incidents and produce a constrained remediation brief",
      "Monitor credential configuration presence without exposing secret values",
      "Request a human-approved escalation when a health or security check fails",
    ],
    requiredSystems: ["Approved site health-check URL", "Provider health endpoints", "Audit log", "Owner alert channel", "Trusted Codex or Hermes host"],
    approvalBoundaries: ["Changing DNS, WAF, firewall, hosting, code, secrets, or production configuration", "Running scans beyond the explicitly approved site", "Accessing customer data, logs containing sensitive data, or private infrastructure", "Automatic remediation or external notifications"],
    loopBlueprints: ["HTTPS and response-header watch", "Provider and quota-signal watch", "Incident triage and owner escalation", "Daily security posture brief"],
    status: "not_configured",
  },
  {
    slug: "ceo-orchestrator",
    name: "CEO Orchestrator",
    shortName: "CEO",
    purpose: "Grow spiritualai.store into a profitable, trusted personalized-transformation company by finding the right people, converting verified demand into revenue, delegating work, and escalating consequential decisions to the owner.",
    powers: [
      "Create and prioritize cross-department objectives",
      "Assign work within approved budgets and policies",
      "Pause loops or departments when health, safety, or spend limits are breached",
      "Request owner decisions through Telegram after the notification channel is connected",
      "Compile revenue, risk, customer, and delivery signals into an operating brief",
      "Continuously identify the highest-evidence path to qualified demand, conversion, retention, and sustainable margin",
    ],
    requiredSystems: ["Task orchestration", "Policy engine", "Audit log", "Telegram", "Finance and analytics read access"],
    approvalBoundaries: ["Creating or connecting third-party accounts", "Changing company policy", "Unbudgeted spending", "Legal commitments", "High-impact external actions", "Credentials and access grants"],
    loopBlueprints: ["Company operating review", "Revenue opportunity review", "Department health review", "Owner escalation review"],
    status: "not_configured",
  },
  {
    slug: "sales",
    name: "Sales",
    shortName: "Sales",
    purpose: "Discover and qualify suitable prospects, conduct consent-aware outreach, manage follow-up, and hand qualified opportunities to a human closer.",
    powers: [
      "Research public business and professional prospect information",
      "Draft recipient-specific email and social outreach for owner approval",
      "Reply to inbound website, Instagram, Messenger, WhatsApp, Telegram, Discord, and email conversations through connected official APIs",
      "Send approved follow-up only when an inbound, opt-in, existing-relationship, or approved-ad basis is recorded",
      "Place calls through a connected, compliant voice provider",
      "Qualify needs, answer approved product questions, and update CRM records",
      "Schedule meetings and route sensitive or high-value conversations to a human",
    ],
    requiredSystems: ["CRM", "SpiritualAI.store web chat", "Email", "Meta social inboxes", "WhatsApp Business", "Telegram and community bots", "Voice provider", "Compliant contact enrichment", "Calendar", "Consent and suppression ledger"],
    approvalBoundaries: ["Every first outbound recipient and message", "Changed campaign payloads", "Pricing exceptions", "Contract promises", "Restricted or do-not-contact recipients"],
    loopBlueprints: ["Inbound conversation triage", "Prospect discovery", "Lead qualification", "Approval-scoped follow-up queue", "Pipeline hygiene"],
    status: "not_configured",
  },
  {
    slug: "mail",
    name: "Mail & Customer Lifecycle",
    shortName: "Mail",
    purpose: "Turn verified product, order, trial, and subscription signals into timely, personalized transactional email while keeping a complete sent and received mail history.",
    powers: [
      "Read approved customer, product, report, order, trial, and subscription data to identify lifecycle events",
      "Prepare personalized product-recommendation and lifecycle messages from verified customer data",
      "Send transactional mail through the configured provider and record delivery outcomes",
      "Record inbound mail through the authenticated provider webhook and route replies to Customer Care",
      "Suppress duplicate lifecycle messages and retain an auditable mail timeline",
    ],
    requiredSystems: ["Neon PostgreSQL customer and product data", "Transactional email provider", "Verified sender domain", "Inbound mail webhook", "Suppression and consent ledger"],
    approvalBoundaries: ["Marketing or non-transactional mail without a documented lawful basis and opt-out", "Changing sender identity, templates, or automated lifecycle rules", "Sending to suppressed, bounced, or unsubscribed recipients", "Using sensitive personal or spiritual data beyond the customer’s requested product service"],
    loopBlueprints: ["Report-to-recommendation follow-up", "Trial ready and expiry notices", "Purchase production and delivery notices", "Subscription completion review request", "Inbound reply capture and Customer Care routing"],
    status: "not_configured",
  },
  {
    slug: "customer-care",
    name: "Customer Care",
    shortName: "Care",
    purpose: "Resolve product and account questions across connected channels while preserving safe human escalation paths.",
    powers: [
      "Triage incoming conversations and identify intent",
      "Answer from approved knowledge sources",
      "Perform authorized account and order support actions",
      "Track resolution state and service-level deadlines",
      "Escalate crisis, refund, privacy, legal, or unresolved cases",
    ],
    requiredSystems: ["Help desk", "Knowledge base", "Email and chat", "Order system", "Identity verification"],
    approvalBoundaries: ["Refunds above policy", "Account deletion", "Mental-health crisis", "Legal threats", "Requests involving sensitive data"],
    loopBlueprints: ["Inbox triage", "SLA monitor", "Unresolved-case follow-up", "Knowledge-gap review"],
    status: "not_configured",
  },
  {
    slug: "marketing",
    name: "Marketing & Growth",
    shortName: "Marketing",
    purpose: "Research demand, plan campaigns, create channel-native content, publish approved work, and learn from real performance data.",
    powers: [
      "Research market, audience, competitor, and platform trends",
      "Create campaign briefs, content calendars, copy, images, audio, and video scripts",
      "Publish and schedule through connected social accounts",
      "Run approved experiments and attribute results",
      "Adapt future content from real engagement and conversion signals",
    ],
    requiredSystems: ["Social platforms", "CMS", "Email marketing", "Creative generation", "Analytics", "Brand library"],
    approvalBoundaries: ["Paid media launches", "New claims or offers", "Sensitive spiritual guidance", "Brand or policy changes"],
    loopBlueprints: ["Trend research", "Content production", "Publishing queue", "Performance learning"],
    status: "not_configured",
  },
  {
    slug: "influencer-partnerships",
    name: "Influencer Partnerships",
    shortName: "Influencers",
    purpose: "Represent spiritualai.store to aligned spiritual, psychology, self-knowledge, astrology, and transformation creators; manage approval-scoped partnership conversations; and reconcile referral ownership, sales, commissions, and payouts from verified records.",
    powers: [
      "Research public creator profiles and audience fit across approved social platforms",
      "Score creators against Spiritual AI’s audience, brand, safety, and partnership criteria",
      "Draft partnership invitations, follow-ups, briefs, and referral collateral for owner approval",
      "Explain the approved Spiritual AI referral setup, audience discount, commission, attribution, dashboard, and payout process accurately",
      "Manage creator relationship state, agreed deliverables, referral codes, and attribution notes",
      "Read approved referral, order, and payment records to calculate sales, revenue, and commission due",
      "Produce partner performance, referral integrity, and payout-reconciliation briefs from verified data",
    ],
    requiredSystems: ["Official social platform APIs", "Creator CRM", "SpiritualAI referral database (read-only)", "Order and payment ledger (read-only)", "LLM provider", "Approval and audit log", "Consent and suppression ledger"],
    approvalBoundaries: ["Every first outreach recipient and exact message", "Any public post, creator-facing offer, discount, commission rate, or deliverable change", "Connecting social accounts, changing API scopes, or accessing private creator data", "Creating, changing, deactivating, or assigning referral codes", "Commission payouts, payment changes, exports containing buyer or creator personal data"],
    loopBlueprints: ["Creator niche and fit research", "Partnership pipeline review", "Approval-scoped outreach drafting", "Referral attribution and earnings reconciliation", "Creator performance and integrity review"],
    status: "not_configured",
  },
  {
    slug: "product-management",
    name: "Product Management & Studio",
    shortName: "Product",
    purpose: "Turn validated orders and opportunities into scoped, reviewed, and deliverable digital spiritual products.",
    powers: [
      "Research customer needs and define product requirements",
      "Plan and generate digital products, diagrams, courses, audiobooks, and AI persona bots",
      "Coordinate content, design, engineering, QA, and delivery tasks",
      "Validate acceptance criteria, provenance, accessibility, and packaging",
      "Maintain roadmap, versions, and release notes",
    ],
    requiredSystems: ["Order system", "Project tracker", "Asset storage", "Generation tools", "QA pipeline", "Delivery platform"],
    approvalBoundaries: ["Product scope changes", "Unsupported health claims", "Public release", "Third-party copyrighted material"],
    loopBlueprints: ["Order intake", "Product research", "Production pipeline", "QA and release review"],
    status: "not_configured",
  },
  {
    slug: "backend-engineering",
    name: "Backend Engineering & Data Operations",
    shortName: "Backend",
    purpose: "Maintain the trusted server-side foundation for spiritualai.store: safely inspect Neon PostgreSQL data, diagnose data and application issues, and deliver reviewed backend improvements.",
    powers: [
      "Read approved Neon PostgreSQL schemas and data through a least-privilege, read-only database role",
      "Profile data quality, freshness, integrity, and operational anomalies without exposing unnecessary personal data",
      "Create aggregate extracts and evidence-backed technical analyses for approved internal consumers",
      "Trace application data flows, propose migrations, indexes, jobs, APIs, and reliability improvements",
      "Draft tested implementation plans and pull-request-ready changes for owner review",
      "Maintain data dictionaries, query provenance, retention notes, and audit-friendly run records",
    ],
    requiredSystems: ["Neon PostgreSQL (read-only role)", "SpiritualAI.store backend repository", "Schema migration history", "Application logs and error monitoring", "Secure secrets manager", "Audit log"],
    approvalBoundaries: ["Any database write, migration, schema change, or index creation", "Access to customer PII, payment data, credentials, or production logs containing sensitive data", "Exporting raw records or sharing data outside the factory", "Deploying backend code, changing infrastructure, or rotating secrets", "Changing retention, deletion, backup, or access-control policies"],
    loopBlueprints: ["Neon connection and schema-health check", "Data quality and freshness review", "Read-only operational analysis", "Backend reliability and performance review", "Migration and remediation proposal review"],
    status: "not_configured",
  },
  {
    slug: "legal-compliance",
    name: "Legal & Compliance",
    shortName: "Legal",
    purpose: "Research applicable obligations, review planned actions, maintain evidence, and route legal judgments to qualified counsel.",
    powers: [
      "Monitor configured jurisdictions and policy sources",
      "Review claims, outreach, privacy, intellectual property, and commercial workflows",
      "Maintain compliance checklists and evidence trails",
      "Flag suspected conflicts or regulatory changes",
      "Prepare research briefs for qualified legal review",
    ],
    requiredSystems: ["Jurisdiction register", "Policy library", "Contract store", "Audit log", "Legal research sources"],
    approvalBoundaries: ["Final legal advice", "Regulatory filings", "Contract execution", "Responses to authorities or litigation"],
    loopBlueprints: ["Regulatory watch", "Campaign compliance review", "Product claims review", "Evidence audit"],
    status: "not_configured",
  },
  {
    slug: "finance",
    name: "Finance",
    shortName: "Finance",
    purpose: "Reconcile revenue and costs, forecast cash, enforce budgets, and prepare accurate financial operations for human approval.",
    powers: [
      "Read and reconcile connected Razorpay payments, refunds, fees, and settlements",
      "Track model, channel, vendor, and department costs",
      "Prepare forecasts, invoices, management reports, and anomaly alerts",
      "Enforce configured spend limits and pause over-budget work",
      "Draft refund and payout actions for authorized approval",
    ],
    requiredSystems: ["Razorpay", "Accounting ledger", "Bank feed", "Billing", "Tax configuration", "Budget policy"],
    approvalBoundaries: ["Moving money", "Issuing material refunds", "Tax filings", "Changing bank or payout details", "Budget increases"],
    loopBlueprints: ["Payment reconciliation", "Cost and budget watch", "Cash forecast", "Exception review"],
    status: "not_configured",
  },
  {
    slug: "data-analytics",
    name: "Data Science & Analytics",
    shortName: "Analytics",
    purpose: "Unify trustworthy product and commercial signals, diagnose experience friction, and recommend measurable improvements.",
    powers: [
      "Connect approved analytics, warehouse, CRM, payment, and product sources",
      "Analyze Microsoft Clarity sessions and funnels with privacy controls",
      "Define metrics, experiments, cohorts, and conversion diagnostics",
      "Detect data quality issues and meaningful anomalies",
      "Publish evidence-backed UX and conversion recommendations",
    ],
    requiredSystems: ["Microsoft Clarity", "Web analytics", "Data warehouse", "CRM", "Razorpay", "Experiment platform"],
    approvalBoundaries: ["New user tracking", "Sensitive-data use", "Production experiment rollout", "Metric definition changes"],
    loopBlueprints: ["Data quality watch", "Funnel diagnosis", "Behavior review", "Experiment learning"],
    status: "not_configured",
  },
  {
    slug: "seo-geo-aeo",
    name: "SEO, GEO & AEO",
    shortName: "Search",
    purpose: "Grow qualified discovery across classic search, generative engines, and answer engines by learning from verified Search Console performance.",
    powers: [
      "Read Google Search Console query, page, device, country, and search-appearance performance",
      "Find evidence-backed topic, intent, click-through, content-gap, and internal-link opportunities",
      "Create SEO content briefs, metadata, answer-first passages, entity coverage, and structured-data drafts",
      "Optimize content for search engines, generative-engine retrieval, citations, and direct-answer usefulness",
      "Compare approved changes with later real impressions, clicks, position, and conversion evidence",
    ],
    requiredSystems: ["Google Search Console read-only OAuth", "Web analytics", "CMS draft access", "Content inventory", "Conversion measurement"],
    approvalBoundaries: ["Publishing or changing production content", "Structured-data deployment", "Indexing controls", "Claims and spiritual guidance", "Credentials and Search Console permissions"],
    loopBlueprints: ["Query and page opportunity review", "Content and answer-gap research", "SEO/GEO/AEO brief production", "Post-change performance learning"],
    status: "not_configured",
  },
  {
    slug: "market-research",
    name: "Market Research",
    shortName: "Research",
    purpose: "Answer one research question with evidence from public conversations, professional and social platforms, the open web, and research literature.",
    powers: [
      "Search approved public-web sources including Reddit, LinkedIn, X, news, and research indexes",
      "Separate direct evidence, source claims, and model inference",
      "Compare conflicting viewpoints and identify confidence and blind spots",
      "Produce an actionable market brief with citations and next research steps",
    ],
    requiredSystems: ["Hermes model endpoint", "Firecrawl public-web connector", "Approved source and privacy policy"],
    approvalBoundaries: ["Private accounts or personal data", "Paywalled or restricted material", "Publishing findings or contacting research participants", "Credential and connector scope changes"],
    loopBlueprints: ["Question scoping", "Multi-source evidence collection", "Insight synthesis", "Contradiction and confidence review"],
    status: "not_configured",
  },
];

export const FACTORY_LIVE_STATE = {
  deployedAgents: 0,
  activeDepartments: 0,
  activeLoops: 0,
  queuedTasks: 0,
  pendingApprovals: 0,
  connectedProviders: 0,
  recordedSpend: 0,
  monthlyBudget: null as number | null,
  orchestratorStatus: "not_configured" as FactoryStatus,
  telegramStatus: "not_configured" as FactoryStatus,
};

export function getDepartment(slug: string) {
  return DEPARTMENTS.find((department) => department.slug === slug);
}
