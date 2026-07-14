//! Core orchestrator logic - Task assignment, workflow execution, employee management

use crate::config::OrchestratorConfig;
use crate::error::{OrchestratorError, Result};
use sqlx::{PgPool, Row};
use redis::aio::ConnectionManager;
use lapin::{Connection, ConnectionProperties, Channel, options::*, types::FieldTable, BasicProperties};
use std::sync::Arc;
use tokio::sync::{RwLock, mpsc};
use std::collections::HashMap;
use chrono::{DateTime, Utc, Duration};
use uuid::Uuid;
use tracing::{info, warn, error, debug, instrument};
use serde::{Serialize, Deserialize};

// ═══════════════════════════════════════════════════════════════
// DATA MODELS
// ═══════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Employee {
    pub id: String,
    pub org_id: String,
    pub department_id: Option<String>,
    pub persona_id: String,
    pub name: String,
    pub title: String,
    pub slug: String,
    pub system_prompt: String,
    pub personality: String,
    pub model: String,
    pub temperature: f64,
    pub max_tokens: i32,
    pub tools: serde_json::Value,
    pub skills: Vec<String>,
    pub status: EmployeeStatus,
    pub performance_score: f64,
    pub total_tasks_completed: i64,
    pub total_cost: rust_decimal::Decimal,
    pub last_active_at: Option<DateTime<Utc>>,
    pub metadata: serde_json::Value,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "employee_status", rename_all = "snake_case")]
pub enum EmployeeStatus {
    Active,
    Onboarding,
    OnLeave,
    Offboarding,
    Terminated,
    Archived,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Task {
    pub id: String,
    pub org_id: String,
    pub project_id: Option<String>,
    pub department_id: Option<String>,
    pub creator_id: String,
    pub assignee_id: Option<String>,
    pub title: String,
    pub description: Option<String>,
    pub status: TaskStatus,
    pub priority: TaskPriority,
    pub task_type: TaskType,
    pub story_points: Option<i32>,
    pub estimated_hours: Option<rust_decimal::Decimal>,
    pub actual_hours: rust_decimal::Decimal,
    pub due_date: Option<DateTime<Utc>>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub depends_on: Vec<String>,
    pub tags: Vec<String>,
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "task_status", rename_all = "snake_case")]
pub enum TaskStatus {
    Todo,
    Backlog,
    InProgress,
    InReview,
    Blocked,
    NeedsApproval,
    Approved,
    Done,
    Cancelled,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "priority", rename_all = "snake_case")]
pub enum TaskPriority {
    Low,
    Medium,
    High,
    Critical,
    Urgent,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "task_type", rename_all = "snake_case")]
pub enum TaskType {
    Task,
    Bug,
    Feature,
    Epic,
    Story,
    Spike,
    Chore,
    Review,
    Deployment,
    Meeting,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskAssignment {
    pub task_id: String,
    pub employee_id: String,
    pub confidence: f64,
    pub reasoning: String,
    pub alternatives: Vec<AlternativeEmployee>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlternativeEmployee {
    pub employee_id: String,
    pub name: String,
    pub confidence: f64,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmployeeCapability {
    pub employee_id: String,
    pub name: String,
    pub skills: Vec<SkillMatch>,
    pub workload: f64, // 0.0 - 1.0
    pub availability: Vec<AvailabilityWindow>,
    pub performance_score: f64,
    pub relevant_experience: Vec<String>,
    pub hourly_cost: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillMatch {
    pub skill_id: String,
    pub skill_name: String,
    pub proficiency: i32, // 0-100
    pub relevance: f64, // 0.0 - 1.0
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AvailabilityWindow {
    pub day_of_week: u8, // 0-6
    pub start_hour: u8,
    pub end_hour: u8,
    pub timezone: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowExecution {
    pub id: String,
    pub workflow_id: String,
    pub task_id: Option<String>,
    pub status: WorkflowRunStatus,
    pub current_step: i32,
    pub input: serde_json::Value,
    pub output: Option<serde_json::Value>,
    pub steps: Vec<WorkflowStepExecution>,
    pub started_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum WorkflowRunStatus {
    Pending,
    Running,
    NeedsApproval,
    Approved,
    Rejected,
    Completed,
    Failed,
    Cancelled,
    Paused,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowStepExecution {
    pub step_id: String,
    pub name: String,
    pub status: WorkflowRunStatus,
    pub assignee_id: Option<String>,
    pub input: serde_json::Value,
    pub output: Option<serde_json::Value>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub error: Option<String>,
    pub retries: u32,
}

// ═══════════════════════════════════════════════════════════════
// ORCHESTRATOR CORE
// ═══════════════════════════════════════════════════════════════

pub struct Orchestrator {
    config: OrchestratorConfig,
    db: PgPool,
    redis: ConnectionManager,
    amqp_channel: Channel,
    acp_client: AcpClient,
    task_queue: mpsc::Sender<TaskQueueItem>,
    workflow_queue: mpsc::Sender<WorkflowQueueItem>,
    employee_cache: Arc<RwLock<HashMap<String, EmployeeCapability>>>,
    running_workflows: Arc<RwLock<HashMap<String, WorkflowExecution>>>,
    shutdown_tx: mpsc::Sender<()>,
}

#[derive(Debug)]
pub enum TaskQueueItem {
    AssignTask(String), // task_id
    ReassignTask(String, String), // task_id, reason
    CheckTaskTimeouts,
    UpdateEmployeeMetrics(String),
}

#[derive(Debug)]
pub enum WorkflowQueueItem {
    StartWorkflow(String, Option<String>), // workflow_id, task_id
    ExecuteStep(String), // execution_id
    CheckWorkflowTimeouts,
    RequestApproval(String, String), // execution_id, approval_type
}

struct AcpClient {
    endpoint: String,
    client: reqwest::Client,
}

impl AcpClient {
    fn new(endpoint: String) -> Self {
        Self {
            endpoint,
            client: reqwest::Client::new(),
        }
    }

    async fn send_message(&self, from: &str, to: &str, msg_type: &str, payload: serde_json::Value) -> Result<()> {
        let message = serde_json::json!({
            "id": Uuid::new_v4().to_string(),
            "from": from,
            "to": to,
            "type": msg_type,
            "payload": payload,
            "timestamp": Utc::now().to_rfc3339(),
        });

        let response = self.client
            .post(&format!("{}/messages", self.endpoint))
            .json(&message)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(OrchestratorError::Acp(format!("ACP send failed: {}", response.status())));
        }
        Ok(())
    }

    async fn invoke_skill(&self, employee_id: &str, skill_id: &str, input: serde_json::Value) -> Result<serde_json::Value> {
        let response = self.client
            .post(&format!("{}/employees/{}/skills/{}/invoke", self.endpoint, employee_id, skill_id))
            .json(&input)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(OrchestratorError::Acp(format!("Skill invocation failed: {}", response.status())));
        }

        Ok(response.json().await?)
    }
}

impl Orchestrator {
    pub async fn new(config: OrchestratorConfig) -> Result<Self> {
        // Database pool
        let db = PgPool::connect(&config.database_url).await?;

        // Redis connection
        let redis_client = redis::Client::open(config.redis_url.clone())?;
        let redis = ConnectionManager::new(redis_client).await?;

        // RabbitMQ connection
        let amqp_conn = Connection::connect(&config.rabbitmq_url, ConnectionProperties::default()).await?;
        let amqp_channel = amqp_conn.create_channel().await?;

        // Declare queues
        amqp_channel.queue_declare("task.assignment", QueueDeclareOptions::default(), FieldTable::default()).await?;
        amqp_channel.queue_declare("workflow.execution", QueueDeclareOptions::default(), FieldTable::default()).await?;
        amqp_channel.queue_declare("approval.requests", QueueDeclareOptions::default(), FieldTable::default()).await?;
        amqp_channel.queue_declare("notifications", QueueDeclareOptions::default(), FieldTable::default()).await?;

        // ACP client
        let acp_client = AcpClient::new(config.acp_endpoint.clone());

        // Channels
        let (task_tx, task_rx) = mpsc::channel(1000);
        let (workflow_tx, workflow_rx) = mpsc::channel(1000);
        let (shutdown_tx, shutdown_rx) = mpsc::channel(1);

        let orchestrator = Self {
            config: config.clone(),
            db,
            redis,
            amqp_channel,
            acp_client,
            task_queue: task_tx,
            workflow_queue: workflow_tx,
            employee_cache: Arc::new(RwLock::new(HashMap::new())),
            running_workflows: Arc::new(RwLock::new(HashMap::new())),
            shutdown_tx,
        };

        // Start background workers
        orchestrator.start_task_worker(task_rx);
        orchestrator.start_workflow_worker(workflow_rx);
        orchestrator.start_metrics_collector();
        orchestrator.start_budget_monitor();
        orchestrator.refresh_employee_cache().await?;

        info!("IronClaw Orchestrator initialized");
        Ok(orchestrator)
    }

    async fn start_task_worker(&self, mut rx: mpsc::Receiver<TaskQueueItem>) {
        let db = self.db.clone();
        let acp = self.acp_client.clone();
        let config = self.config.clone();
        let employee_cache = self.employee_cache.clone();
        let task_queue = self.task_queue.clone();

        tokio::spawn(async move {
            while let Some(item) = rx.recv().await {
                match item {
                    TaskQueueItem::AssignTask(task_id) => {
                        if let Err(e) = Self::assign_task(&db, &acp, &employee_cache, &task_id, &config).await {
                            error!("Failed to assign task {}: {}", task_id, e);
                            // Requeue with backoff
                            tokio::time::sleep(tokio::time::Duration::from_secs(30)).await;
                            let _ = task_queue.send(TaskQueueItem::AssignTask(task_id)).await;
                        }
                    }
                    TaskQueueItem::ReassignTask(task_id, reason) => {
                        if let Err(e) = Self::reassign_task(&db, &acp, &employee_cache, &task_id, &reason, &config).await {
                            error!("Failed to reassign task {}: {}", task_id, e);
                        }
                    }
                    TaskQueueItem::CheckTaskTimeouts => {
                        if let Err(e) = Self::check_task_timeouts(&db, &config).await {
                            error!("Task timeout check failed: {}", e);
                        }
                    }
                    TaskQueueItem::UpdateEmployeeMetrics(employee_id) => {
                        if let Err(e) = Self::update_employee_metrics(&db, &employee_id).await {
                            error!("Failed to update metrics for {}: {}", employee_id, e);
                        }
                    }
                }
            }
        });
    }

    async fn start_workflow_worker(&self, mut rx: mpsc::Receiver<WorkflowQueueItem>) {
        let db = self.db.clone();
        let acp = self.acp_client.clone();
        let amqp = self.amqp_channel.clone();
        let running = self.running_workflows.clone();
        let workflow_queue = self.workflow_queue.clone();

        tokio::spawn(async move {
            while let Some(item) = rx.recv().await {
                match item {
                    WorkflowQueueItem::StartWorkflow(workflow_id, task_id) => {
                        if let Err(e) = Self::start_workflow(&db, &acp, &amqp, &running, &workflow_id, task_id).await {
                            error!("Failed to start workflow {}: {}", workflow_id, e);
                        }
                    }
                    WorkflowQueueItem::ExecuteStep(execution_id) => {
                        if let Err(e) = Self::execute_workflow_step(&db, &acp, &amqp, &running, &execution_id).await {
                            error!("Failed to execute workflow step {}: {}", execution_id, e);
                        }
                    }
                    WorkflowQueueItem::CheckWorkflowTimeouts => {
                        if let Err(e) = Self::check_workflow_timeouts(&db, &running).await {
                            error!("Workflow timeout check failed: {}", e);
                        }
                    }
                    WorkflowQueueItem::RequestApproval(execution_id, approval_type) => {
                        if let Err(e) = Self::request_approval(&db, &amqp, &execution_id, &approval_type).await {
                            error!("Failed to request approval for {}: {}", execution_id, e);
                        }
                    }
                }
            }
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // TASK ASSIGNMENT - The Core Intelligence
    // ═══════════════════════════════════════════════════════════════

    #[instrument(skip(db, acp, cache, config))]
    async fn assign_task(
        db: &PgPool,
        acp: &AcpClient,
        cache: &Arc<RwLock<HashMap<String, EmployeeCapability>>>,
        task_id: &str,
        config: &OrchestratorConfig,
    ) -> Result<()> {
        // Fetch task
        let task = sqlx::query_as::<_, Task>(
            "SELECT * FROM tasks WHERE id = $1 AND status IN ('todo', 'backlog')"
        )
        .bind(task_id)
        .fetch_optional(db)
        .await?;

        let Some(task) = task else {
            warn!("Task {} not found or not assignable", task_id);
            return Ok(());
        };

        // Get available employees
        let employees = Self::get_available_employees(db, &task, config).await?;

        if employees.is_empty() {
            warn!("No available employees for task {}", task_id);
            // Put task back in queue for later
            tokio::time::sleep(tokio::time::Duration::from_secs(60)).await;
            return Ok(());
        }

        // Score employees
        let scored = Self::score_employees(&task, &employees).await?;

        // Pick best match
        let best = scored.first().ok_or_else(|| OrchestratorError::TaskAssignment("No suitable employee found".into()))?;

        // Assign task
        let now = Utc::now();
        sqlx::query(
            r#"UPDATE tasks SET assignee_id = $1, status = 'in_progress', started_at = $2, updated_at = $2 WHERE id = $3"#
        )
        .bind(&best.employee_id)
        .bind(now)
        .bind(task_id)
        .execute(db)
        .await?;

        // Notify employee via ACP
        let assignment_msg = serde_json::json!({
            "task_id": task.id,
            "title": task.title,
            "description": task.description,
            "priority": format!("{:?}", task.priority),
            "type": format!("{:?}", task.task_type),
            "due_date": task.due_date,
            "tags": task.tags,
        });

        acp.send_message("orchestrator", &best.employee_id, "TASK_ASSIGNMENT", assignment_msg).await?;

        // Update employee cache
        if let Some(cap) = cache.write().await.get_mut(&best.employee_id) {
            cap.workload = (cap.workload + 0.1).min(1.0);
        }

        // Log activity
        Self::log_activity(db, &task.org_id, "SYSTEM", "orchestrator", "task_assigned", "task", task_id, &format!("Assigned to {}", best.name), &serde_json::json!({"confidence": best.confidence})).await?;

        info!("Task {} assigned to {} (confidence: {:.2})", task_id, best.name, best.confidence);
        Ok(())
    }

    async fn get_available_employees(
        db: &PgPool,
        task: &Task,
        config: &OrchestratorConfig,
    ) -> Result<Vec<EmployeeCapability>> {
        let mut query = sqlx::QueryBuilder::new(
            r#"
            SELECT e.*, p.system_prompt, p.personality
            FROM employees e
            JOIN personas p ON e.persona_id = p.id
            WHERE e.org_id = 
            AND e.status = 'active'
            AND e.employment_type = 'ai_agent'
            "#
        );

        query.push_bind(&task.org_id);

        if let Some(dept_id) = &task.department_id {
            query.push(" AND e.department_id = ");
            query.push_bind(dept_id);
        } else if let Some(project_id) = &task.project_id {
            query.push(" AND e.department_id IN (SELECT department_id FROM projects WHERE id = ");
            query.push_bind(project_id);
            query.push(")");
        }

        // Exclude overloaded employees
        query.push(" AND (SELECT COUNT(*) FROM tasks WHERE assignee_id = e.id AND status IN ('in_progress', 'in_review', 'needs_approval')) < ");
        query.push_bind(config.max_concurrent_tasks_per_employee as i64);

        let employees = query.build_query_as::<Employee>().fetch_all(db).await?;

        // Convert to capabilities
        let mut capabilities = Vec::new();
        for emp in employees {
            let skills = Self::get_employee_skills(db, &emp.id).await?;
            let workload = Self::calculate_workload(db, &emp.id).await?;
            let availability = Self::get_availability(db, &emp.id).await?;
            let hourly_cost = Self::calculate_hourly_cost(&emp);

            capabilities.push(EmployeeCapability {
                employee_id: emp.id,
                name: emp.name,
                skills,
                workload,
                availability,
                performance_score: emp.performance_score,
                relevant_experience: emp.tags,
                hourly_cost,
            });
        }

        Ok(capabilities)
    }

    async fn score_employees(task: &Task, employees: &[EmployeeCapability]) -> Result<Vec<ScoredEmployee>> {
        let mut scored = Vec::new();

        for emp in employees {
            let mut score = 0.0;
            let mut reasons = Vec::new();

            // Skill matching (40% weight)
            let skill_score = Self::calculate_skill_match(&task, &emp.skills);
            score += skill_score * 0.4;
            if skill_score > 0.7 {
                reasons.push(format!("Strong skill match ({:.0}%)", skill_score * 100.0));
            }

            // Workload (20% weight) - prefer less loaded
            let workload_score = 1.0 - emp.workload;
            score += workload_score * 0.2;
            if workload_score > 0.7 {
                reasons.push("Low current workload".into());
            }

            // Performance (20% weight)
            score += emp.performance_score * 0.2;
            if emp.performance_score > 0.8 {
                reasons.push("High performance score".into());
            }

            // Cost efficiency (10% weight)
            let cost_score = if emp.hourly_cost > 0.0 { 1.0 / (1.0 + emp.hourly_cost) } else { 0.5 };
            score += cost_score * 0.1;

            // Availability (10% weight)
            let avail_score = Self::calculate_availability_score(&emp.availability);
            score += avail_score * 0.1;

            scored.push(ScoredEmployee {
                employee_id: emp.employee_id.clone(),
                name: emp.name.clone(),
                confidence: score.min(1.0),
                reasoning: reasons.join("; "),
                hourly_cost: emp.hourly_cost,
            });
        }

        scored.sort_by(|a, b| b.confidence.partial_cmp(&a.confidence).unwrap());
        Ok(scored)
    }

    fn calculate_skill_match(task: &Task, skills: &[SkillMatch]) -> f64 {
        if skills.is_empty() {
            return 0.3; // Base score for generalists
        }

        let task_tags = &task.tags;
        let mut total_relevance = 0.0;
        let mut matched = 0;

        for skill in skills {
            for tag in task_tags {
                if skill.skill_name.to_lowercase().contains(&tag.to_lowercase())
                    || tag.to_lowercase().contains(&skill.skill_name.to_lowercase())
                {
                    total_relevance += skill.relevance * (skill.proficiency as f64 / 100.0);
                    matched += 1;
                }
            }
        }

        if matched == 0 {
            0.3
        } else {
            (total_relevance / matched as f64).min(1.0)
        }
    }

    fn calculate_availability_score(availability: &[AvailabilityWindow]) -> f64 {
        if availability.is_empty() {
            return 0.5;
        }

        let now = Utc::now();
        let current_day = now.weekday().num_days_from_monday() as u8;
        let current_hour = now.hour() as u8;

        for window in availability {
            if window.day_of_week == current_day
                && current_hour >= window.start_hour
                && current_hour < window.end_hour
            {
                return 1.0;
            }
        }

        0.5
    }

    async fn calculate_workload(db: &PgPool, employee_id: &str) -> Result<f64> {
        let count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM tasks WHERE assignee_id = $1 AND status IN ('in_progress', 'in_review', 'needs_approval')"
        )
        .bind(employee_id)
        .fetch_one(db)
        .await?;

        Ok((count as f64 / 5.0).min(1.0)) // Normalize to 5 max concurrent
    }

    async fn get_employee_skills(db: &PgPool, employee_id: &str) -> Result<Vec<SkillMatch>> {
        let rows = sqlx::query(
            r#"
            SELECT s.id as skill_id, s.name as skill_name, es.proficiency, 1.0 as relevance
            FROM employee_skills es
            JOIN skills s ON es.skill_id = s.id
            WHERE es.employee_id = $1 AND es.is_active = true
            "#
        )
        .bind(employee_id)
        .fetch_all(db)
        .await?;

        Ok(rows.into_iter().map(|r| SkillMatch {
            skill_id: r.get("skill_id"),
            skill_name: r.get("skill_name"),
            proficiency: r.get("proficiency"),
            relevance: r.get("relevance"),
        }).collect())
    }

    async fn get_availability(db: &PgPool, employee_id: &str) -> Result<Vec<AvailabilityWindow>> {
        let rows = sqlx::query(
            "SELECT day_of_week, start_time, end_time, timezone FROM work_schedules WHERE employee_id = $1 AND is_active = true"
        )
        .bind(employee_id)
        .fetch_all(db)
        .await?;

        Ok(rows.into_iter().map(|r| AvailabilityWindow {
            day_of_week: r.get("day_of_week"),
            start_hour: r.get::<String, _>("start_time").split(':').next().unwrap().parse().unwrap_or(9),
            end_hour: r.get::<String, _>("end_time").split(':').next().unwrap().parse().unwrap_or(17),
            timezone: r.get("timezone"),
        }).collect())
    }

    fn calculate_hourly_cost(emp: &Employee) -> f64 {
        if let Some(hourly) = emp.hourly_rate {
            hourly.to_string().parse().unwrap_or(10.0)
        } else if let Some(salary) = emp.salary {
            (salary.to_string().parse::<f64>().unwrap_or(100000.0) / 2080.0) // Annual / hours per year
        } else {
            10.0 // Default
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // WORKFLOW EXECUTION (LobsterAI Integration)
    // ═══════════════════════════════════════════════════════════════

    async fn start_workflow(
        db: &PgPool,
        acp: &AcpClient,
        amqp: &Channel,
        running: &Arc<RwLock<HashMap<String, WorkflowExecution>>>,
        workflow_id: &str,
        task_id: Option<String>,
    ) -> Result<()> {
        // Fetch workflow definition
        let workflow = sqlx::query(
            "SELECT * FROM workflows WHERE id = $1 AND status = 'active'"
        )
        .bind(workflow_id)
        .fetch_optional(db)
        .await?;

        let Some(workflow) = workflow else {
            return Err(OrchestratorError::WorkflowExecution("Workflow not found or not active".into()));
        };

        let definition: serde_json::Value = workflow.get("definition");
        let steps = definition["steps"].as_array().ok_or_else(|| OrchestratorError::WorkflowExecution("Invalid workflow definition".into()))?;

        // Create execution record
        let execution_id = Uuid::new_v4().to_string();
        let execution = WorkflowExecution {
            id: execution_id.clone(),
            workflow_id: workflow_id.to_string(),
            task_id,
            status: WorkflowRunStatus::Running,
            current_step: 0,
            input: serde_json::json!({}),
            output: None,
            steps: Vec::new(),
            started_at: Utc::now(),
            completed_at: None,
            error: None,
        };

        // Initialize step executions
        for (i, step) in steps.iter().enumerate() {
            execution.steps.push(WorkflowStepExecution {
                step_id: step["id"].as_str().unwrap_or(&format!("step_{}", i)).to_string(),
                name: step["name"].as_str().unwrap_or("Unnamed Step").to_string(),
                status: if i == 0 { WorkflowRunStatus::Running } else { WorkflowRunStatus::Pending },
                assignee_id: step["assignee"].as_str().map(|s| s.to_string()),
                input: serde_json::json!({}),
                output: None,
                started_at: if i == 0 { Some(Utc::now()) } else { None },
                completed_at: None,
                error: None,
                retries: 0,
            });
        }

        // Store in running workflows
        running.write().await.insert(execution_id.clone(), execution.clone());

        // Persist to database
        sqlx::query(
            r#"INSERT INTO workflow_runs (id, workflow_id, task_id, status, current_step, input, steps, started_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)"#
        )
        .bind(&execution_id)
        .bind(workflow_id)
        .bind(&execution.task_id)
        .bind(format!("{:?}", execution.status))
        .bind(0)
        .bind(&execution.input)
        .bind(serde_json::to_value(&execution.steps)?)
        .bind(execution.started_at)
        .execute(db)
        .await?;

        // Execute first step
        Self::execute_workflow_step(db, acp, amqp, running, &execution_id).await?;

        Ok(())
    }

    async fn execute_workflow_step(
        db: &PgPool,
        acp: &AcpClient,
        amqp: &Channel,
        running: &Arc<RwLock<HashMap<String, WorkflowExecution>>>,
        execution_id: &str,
    ) -> Result<()> {
        let mut execution = {
            let guard = running.read().await;
            guard.get(execution_id).cloned()
        }.ok_or_else(|| OrchestratorError::WorkflowExecution("Execution not found".into()))?;

        if execution.current_step >= execution.steps.len() {
            // Workflow complete
            Self::complete_workflow(db, amqp, running, &execution_id).await?;
            return Ok(());
        }

        let step = &mut execution.steps[execution.current_step];

        // Check if step needs approval
        if step.status == WorkflowRunStatus::NeedsApproval {
            // Wait for approval (handled separately)
            return Ok(());
        }

        // Execute step based on type
        match step.status {
            WorkflowRunStatus::Pending => {
                step.status = WorkflowRunStatus::Running;
                step.started_at = Some(Utc::now());

                // If step has assignee, send task via ACP
                if let Some(assignee_id) = &step.assignee_id {
                    let task_msg = serde_json::json!({
                        "workflow_execution_id": execution_id,
                        "step_id": step.step_id,
                        "name": step.name,
                        "input": step.input,
                        "config": step.config, // from workflow definition
                    });

                    acp.send_message("orchestrator", assignee_id, "WORKFLOW_STEP", task_msg).await?;
                } else {
                    // Automated step - execute immediately
                    let result = Self::execute_automated_step(db, acp, &execution, step).await?;
                    step.output = Some(result);
                    step.status = WorkflowRunStatus::Completed;
                    step.completed_at = Some(Utc::now());

                    // Move to next step
                    execution.current_step += 1;
                    if execution.current_step < execution.steps.len() {
                        execution.steps[execution.current_step].status = WorkflowRunStatus::Running;
                    }
                }

                // Update in memory and DB
                running.write().await.insert(execution_id.to_string(), execution.clone());
                Self::persist_workflow_execution(db, &execution).await?;
            }
            _ => {}
        }

        Ok(())
    }

    async fn execute_automated_step(
        db: &PgPool,
        acp: &AcpClient,
        execution: &WorkflowExecution,
        step: &WorkflowStepExecution,
    ) -> Result<serde_json::Value> {
        // This would invoke skills, call APIs, run scripts, etc.
        // For now, return mock success
        Ok(serde_json::json!({
            "status": "completed",
            "result": "Step executed successfully",
            "timestamp": Utc::now().to_rfc3339(),
        }))
    }

    async fn complete_workflow(
        db: &PgPool,
        amqp: &Channel,
        running: &Arc<RwLock<HashMap<String, WorkflowExecution>>>,
        execution_id: &str,
    ) -> Result<()> {
        let mut execution = running.write().await.remove(execution_id)
            .ok_or_else(|| OrchestratorError::WorkflowExecution("Execution not found".into()))?;

        execution.status = WorkflowRunStatus::Completed;
        execution.completed_at = Some(Utc::now());

        // Compile final output
        let final_output = execution.steps.iter()
            .filter_map(|s| s.output.clone())
            .collect::<Vec<_>>();
        execution.output = Some(serde_json::json!({ "steps": final_output }));

        // Persist
        sqlx::query(
            r#"UPDATE workflow_runs SET status = $1, current_step = $2, output = $3, completed_at = $4, steps = $5 WHERE id = $6"#
        )
        .bind(format!("{:?}", execution.status))
        .bind(execution.current_step as i32)
        .bind(&execution.output)
        .bind(execution.completed_at)
        .bind(serde_json::to_value(&execution.steps)?)
        .bind(execution_id)
        .execute(db)
        .await?;

        // Notify via AMQP
        let msg = serde_json::to_vec(&serde_json::json!({
            "event": "workflow_completed",
            "execution_id": execution_id,
            "workflow_id": execution.workflow_id,
            "output": execution.output,
        }))?;

        amqp.basic_publish(
            "", "workflow.events",
            BasicPublishOptions::default(),
            &msg,
            BasicProperties::default().with_content_type("application/json".into()),
        ).await?;

        info!("Workflow execution {} completed", execution_id);
        Ok(())
    }

    async fn persist_workflow_execution(db: &PgPool, execution: &WorkflowExecution) -> Result<()> {
        sqlx::query(
            r#"UPDATE workflow_runs SET status = $1, current_step = $2, steps = $3, updated_at = $4 WHERE id = $5"#
        )
        .bind(format!("{:?}", execution.status))
        .bind(execution.current_step as i32)
        .bind(serde_json::to_value(&execution.steps)?)
        .bind(Utc::now())
        .bind(&execution.id)
        .execute(db)
        .await?;

        Ok(())
    }

    // ═══════════════════════════════════════════════════════════════
    // BACKGROUND WORKERS
    // ═══════════════════════════════════════════════════════════════

    async fn start_metrics_collector(&self) {
        let db = self.db.clone();
        let cache = self.employee_cache.clone();
        let interval = self.config.metrics_collection_interval_ms;

        tokio::spawn(async move {
            let mut ticker = tokio::time::interval(tokio::time::Duration::from_millis(interval));
            loop {
                ticker.tick().await;
                if let Err(e) = Self::collect_metrics(&db, &cache).await {
                    error!("Metrics collection failed: {}", e);
                }
            }
        });
    }

    async fn start_budget_monitor(&self) {
        let db = self.db.clone();
        let amqp = self.amqp_channel.clone();
        let interval = self.config.budget_monitoring_interval_ms;
        let threshold = self.config.cost_alert_threshold_percent;

        tokio::spawn(async move {
            let mut ticker = tokio::time::interval(tokio::time::Duration::from_millis(interval));
            loop {
                ticker.tick().await;
                if let Err(e) = Self::check_budgets(&db, &amqp, threshold).await {
                    error!("Budget check failed: {}", e);
                }
            }
        });
    }

    async fn collect_metrics(db: &PgPool, cache: &Arc<RwLock<HashMap<String, EmployeeCapability>>>) -> Result<()> {
        // Update employee performance scores
        let employees = sqlx::query_as::<_, Employee>(
            "SELECT * FROM employees WHERE status = 'active'"
        ).fetch_all(db).await?;

        for emp in employees {
            // Calculate performance based on completed tasks, quality, speed
            let completed_tasks = sqlx::query_scalar::<_, i64>(
                "SELECT COUNT(*) FROM tasks WHERE assignee_id = $1 AND status = 'done' AND completed_at > NOW() - INTERVAL '30 days'"
            )
            .bind(&emp.id)
            .fetch_one(db)
            .await?;

            let avg_rating = sqlx::query_scalar::<_, Option<f64>>(
                "SELECT AVG(rating) FROM task_reviews WHERE task_id IN (SELECT id FROM tasks WHERE assignee_id = $1)"
            )
            .bind(&emp.id)
            .fetch_one(db)
            .await?;

            let new_score = ((completed_tasks as f64 / 10.0).min(1.0) * 0.5) + (avg_rating.unwrap_or(0.0) / 5.0 * 0.5);

            sqlx::query("UPDATE employees SET performance_score = $1, total_tasks_completed = $2 WHERE id = $3")
                .bind(new_score)
                .bind(completed_tasks)
                .bind(&emp.id)
                .execute(db)
                .await?;

            // Update cache
            if let Some(cap) = cache.write().await.get_mut(&emp.id) {
                cap.performance_score = new_score;
            }
        }

        Ok(())
    }

    async fn check_budgets(db: &PgPool, amqp: &Channel, threshold_percent: f64) -> Result<()> {
        let budgets = sqlx::query(
            "SELECT b.*, o.name as org_name FROM budgets b JOIN organizations o ON b.org_id = o.id"
        ).fetch_all(db).await?;

        for budget in budgets {
            let spent: rust_decimal::Decimal = budget.get("total_spent");
            let allocated: rust_decimal::Decimal = budget.get("total_allocated");
            let percent = (spent / allocated * rust_decimal::Decimal::from(100)).to_string().parse::<f64>().unwrap_or(0.0);

            if percent >= threshold_percent {
                // Send alert
                let alert = serde_json::json!({
                    "type": "budget_alert",
                    "org_id": budget.get::<String, _>("org_id"),
                    "org_name": budget.get::<String, _>("org_name"),
                    "spent": spent.to_string(),
                    "allocated": allocated.to_string(),
                    "percent": percent,
                    "threshold": threshold_percent,
                });

                let msg = serde_json::to_vec(&alert)?;
                amqp.basic_publish("", "budget.alerts", BasicPublishOptions::default(), &msg, BasicProperties::default()).await?;
            }
        }

        Ok(())
    }

    async fn check_task_timeouts(db: &PgPool, config: &OrchestratorConfig) -> Result<()> {
        let timeout = Duration::seconds(config.default_task_timeout_seconds as i64);
        let cutoff = Utc::now() - timeout;

        let timed_out = sqlx::query(
            "SELECT id FROM tasks WHERE status IN ('in_progress', 'in_review') AND started_at < $1"
        )
        .bind(cutoff)
        .fetch_all(db)
        .await?;

        for task in timed_out {
            let task_id: String = task.get("id");
            // Reassign or escalate
            sqlx::query("UPDATE tasks SET status = 'blocked', metadata = jsonb_set(metadata, '{timeout}', 'true') WHERE id = $1")
                .bind(&task_id)
                .execute(db)
                .await?;

            warn!("Task {} timed out", task_id);
        }

        Ok(())
    }

    async fn check_workflow_timeouts(db: &PgPool, running: &Arc<RwLock<HashMap<String, WorkflowExecution>>>) -> Result<()> {
        let mut to_remove = Vec::new();

        {
            let guard = running.read().await;
            for (id, exec) in guard.iter() {
                if exec.status == WorkflowRunStatus::Running {
                    let elapsed = Utc::now() - exec.started_at;
                    if elapsed > Duration::hours(24) {
                        to_remove.push(id.clone());
                    }
                }
            }
        }

        for id in to_remove {
            running.write().await.remove(&id);
            sqlx::query("UPDATE workflow_runs SET status = 'failed', error = 'timeout', completed_at = $1 WHERE id = $2")
                .bind(Utc::now())
                .bind(&id)
                .execute(db)
                .await?;

            warn!("Workflow execution {} timed out", id);
        }

        Ok(())
    }

    async fn request_approval(db: &PgPool, amqp: &Channel, execution_id: &str, approval_type: &str) -> Result<()> {
        let approval_id = Uuid::new_v4().to_string();

        sqlx::query(
            r#"INSERT INTO approvals (id, workflow_run_id, title, description, type, status, requested_by, expires_at) VALUES ($1, $2, $3, $4, $5, 'pending', 'orchestrator', $6)"#
        )
        .bind(&approval_id)
        .bind(execution_id)
        .bind(format!("Approval needed for workflow step"))
        .bind(format!("Workflow execution {} requires {} approval", execution_id, approval_type))
        .bind(approval_type)
        .bind(Utc::now() + Duration::hours(24))
        .execute(db)
        .await?;

        // Notify via AMQP
        let msg = serde_json::to_vec(&serde_json::json!({
            "approval_id": approval_id,
            "execution_id": execution_id,
            "type": approval_type,
        }))?;

        amqp.basic_publish("", "approval.requests", BasicPublishOptions::default(), &msg, BasicProperties::default()).await?;

        Ok(())
    }

    async fn reassign_task(
        db: &PgPool,
        acp: &AcpClient,
        cache: &Arc<RwLock<HashMap<String, EmployeeCapability>>>,
        task_id: &str,
        reason: &str,
        config: &OrchestratorConfig,
    ) -> Result<()> {
        // Get current assignee
        let task = sqlx::query_as::<_, Task>("SELECT * FROM tasks WHERE id = $1")
            .bind(task_id)
            .fetch_optional(db)
            .await?;

        let Some(task) = task else { return Ok(()) };

        if let Some(old_assignee) = task.assignee_id {
            // Notify old assignee
            acp.send_message("orchestrator", &old_assignee, "TASK_REASSIGNED", serde_json::json!({
                "task_id": task_id,
                "reason": reason,
            })).await?;

            // Reduce workload
            if let Some(cap) = cache.write().await.get_mut(&old_assignee) {
                cap.workload = (cap.workload - 0.1).max(0.0);
            }
        }

        // Re-assign
        Self::assign_task(db, acp, cache, task_id, config).await
    }

    async fn update_employee_metrics(db: &PgPool, employee_id: &str) -> Result<()> {
        let now = Utc::now();
        sqlx::query("UPDATE employees SET last_active_at = $1 WHERE id = $2")
            .bind(now)
            .bind(employee_id)
            .execute(db)
            .await?;
        Ok(())
    }

    async fn refresh_employee_cache(&self) -> Result<()> {
        let employees = Self::get_all_active_employees(&self.db).await?;
        let mut cache = self.employee_cache.write().await;
        cache.clear();

        for emp in employees {
            let skills = Self::get_employee_skills(&self.db, &emp.id).await?;
            let workload = Self::calculate_workload(&self.db, &emp.id).await?;
            let availability = Self::get_availability(&self.db, &emp.id).await?;
            let hourly_cost = Self::calculate_hourly_cost(&emp);

            cache.insert(emp.id.clone(), EmployeeCapability {
                employee_id: emp.id,
                name: emp.name,
                skills,
                workload,
                availability,
                performance_score: emp.performance_score,
                relevant_experience: emp.tags,
                hourly_cost,
            });
        }

        info!("Refreshed employee cache with {} employees", cache.len());
        Ok(())
    }

    async fn get_all_active_employees(db: &PgPool) -> Result<Vec<Employee>> {
        Ok(sqlx::query_as::<_, Employee>(
            "SELECT * FROM employees WHERE status = 'active' AND employment_type = 'ai_agent'"
        ).fetch_all(db).await?)
    }

    async fn log_activity(
        db: &PgPool,
        org_id: &str,
        actor_type: &str,
        actor_id: &str,
        action: &str,
        target_type: &str,
        target_id: &str,
        description: &str,
        metadata: &serde_json::Value,
    ) -> Result<()> {
        sqlx::query(
            r#"INSERT INTO activities (org_id, actor_type, actor_id, action, target_type, target_id, description, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)"#
        )
        .bind(org_id)
        .bind(actor_type)
        .bind(actor_id)
        .bind(action)
        .bind(target_type)
        .bind(target_id)
        .bind(description)
        .bind(metadata)
        .execute(db)
        .await?;
        Ok(())
    }

    pub async fn shutdown(&self) -> Result<()> {
        let _ = self.shutdown_tx.send(()).await;
        info!("Orchestrator shutdown initiated");
        Ok(())
    }
}

#[derive(Debug, Clone)]
struct ScoredEmployee {
    employee_id: String,
    name: String,
    confidence: f64,
    reasoning: String,
    hourly_cost: f64,
}