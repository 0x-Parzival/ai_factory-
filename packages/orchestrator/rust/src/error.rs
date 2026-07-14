//! Error types for IronClaw Orchestrator

use thiserror::Error;

#[derive(Error, Debug)]
pub enum OrchestratorError {
    #[error("Configuration error: {0}")]
    Config(#[from] config::ConfigError),

    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Redis error: {0}")]
    Redis(#[from] redis::RedisError),

    #[error("RabbitMQ error: {0}")]
    RabbitMQ(#[from] lapin::Error),

    #[error("HTTP client error: {0}")]
    Http(#[from] reqwest::Error),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("ACP protocol error: {0}")]
    Acp(String),

    #[error("Task assignment failed: {0}")]
    TaskAssignment(String),

    #[error("Workflow execution failed: {0}")]
    WorkflowExecution(String),

    #[error("Employee not found: {0}")]
    EmployeeNotFound(String),

    #[error("Skill not found: {0}")]
    SkillNotFound(String),

    #[error("Budget exceeded: {0}")]
    BudgetExceeded(String),

    #[error("Approval timeout: {0}")]
    ApprovalTimeout(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Internal error: {0}")]
    Internal(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

pub type Result<T> = std::result::Result<T, OrchestratorError>;