//! Configuration for IronClaw Orchestrator

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use config::{Config, File, Environment};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrchestratorConfig {
    pub environment: String,
    pub database_url: String,
    pub redis_url: String,
    pub rabbitmq_url: String,
    pub acp_endpoint: String,
    pub api_port: u16,
    pub task_assignment_interval_ms: u64,
    pub workflow_execution_interval_ms: u64,
    pub metrics_collection_interval_ms: u64,
    pub budget_monitoring_interval_ms: u64,
    pub max_concurrent_workflows: usize,
    pub max_concurrent_tasks_per_employee: usize,
    pub default_task_timeout_seconds: u64,
    pub approval_timeout_hours: u64,
    pub cost_alert_threshold_percent: f64,
    pub performance_window_hours: u64,
}

impl OrchestratorConfig {
    pub fn load() -> Result<Self, crate::error::OrchestratorError> {
        let env = std::env::var("ENVIRONMENT").unwrap_or_else(|_| "development".to_string());

        let mut builder = Config::builder()
            .add_source(File::with_name("config/default").required(false))
            .add_source(File::with_name(&format!("config/{}", env)).required(false))
            .add_source(Environment::with_prefix("IRONCLAW").separator("__"));

        // Allow override via config file path
        if let Ok(config_path) = std::env::var("IRONCLAW_CONFIG_FILE") {
            builder = builder.add_source(File::with_name(&config_path).required(true));
        }

        let config = builder.build()?;
        Ok(config.try_deserialize()?)
    }
}

impl Default for OrchestratorConfig {
    fn default() -> Self {
        Self {
            environment: "development".to_string(),
            database_url: "postgresql://postgres:postgres@localhost:5432/ai_factory".to_string(),
            redis_url: "redis://localhost:6379".to_string(),
            rabbitmq_url: "amqp://guest:guest@localhost:5672".to_string(),
            acp_endpoint: "http://localhost:8080".to_string(),
            api_port: 8081,
            task_assignment_interval_ms: 5000,
            workflow_execution_interval_ms: 1000,
            metrics_collection_interval_ms: 30000,
            budget_monitoring_interval_ms: 60000,
            max_concurrent_workflows: 100,
            max_concurrent_tasks_per_employee: 5,
            default_task_timeout_seconds: 3600,
            approval_timeout_hours: 24,
            cost_alert_threshold_percent: 80.0,
            performance_window_hours: 24,
        }
    }
}