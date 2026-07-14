//! IronClaw Orchestrator - High-performance AI agent orchestration
//!
//! This is the core orchestration engine that:
//! - Assigns tasks to the best-suited employees (agents)
//! - Manages workflow execution with approval gates
//! - Handles inter-agent communication via ACP
//! - Tracks performance, costs, and budgets
//! - Provides real-time metrics and monitoring

mod config;
mod error;
mod orchestrator;
mod acp;
mod skills;
mod memory;
mod metrics;
mod budget;
mod workflow;

pub use config::*;
pub use error::*;
pub use orchestrator::*;

use std::sync::Arc;
use tracing::{info, error};
use tokio::signal;

#[tokio::main]
async fn main() -> Result<(), OrchestratorError> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .json()
        .init();

    info!("🦀 Starting IronClaw Orchestrator v{}", env!("CARGO_PKG_VERSION"));

    // Load configuration
    let config = OrchestratorConfig::load()?;
    info!("Configuration loaded: {:?}", config.environment);

    // Initialize database connection
    let db_pool = sqlx::PgPool::connect(&config.database_url).await?;
    info!("Database connected");

    // Initialize Redis
    let redis_client = redis::Client::open(config.redis_url)?;
    let redis_conn = redis_client.get_connection_manager().await?;
    info!("Redis connected");

    // Initialize message broker (RabbitMQ)
    let amqp_conn = lapin::Connection::connect(&config.rabbitmq_url, lapin::ConnectionProperties::default()).await?;
    let amqp_channel = amqp_conn.create_channel().await?;
    info!("RabbitMQ connected");

    // Initialize ACP client
    let acp_client = acp::AcpClient::new(config.acp_endpoint.clone()).await?;
    info!("ACP client connected");

    // Create orchestrator instance
    let orchestrator = Arc::new(Orchestrator::new(
        config.clone(),
        db_pool.clone(),
        redis_conn,
        amqp_channel,
        acp_client,
    ).await?);

    // Start background services
    let orchestrator_clone = orchestrator.clone();
    tokio::spawn(async move {
        orchestrator_clone.start_task_assignment_loop().await;
    });

    let orchestrator_clone = orchestrator.clone();
    tokio::spawn(async move {
        orchestrator_clone.start_workflow_execution_loop().await;
    });

    let orchestrator_clone = orchestrator.clone();
    tokio::spawn(async move {
        orchestrator_clone.start_metrics_collection_loop().await;
    });

    let orchestrator_clone = orchestrator.clone();
    tokio::spawn(async move {
        orchestrator_clone.start_budget_monitoring_loop().await;
    });

    // Start HTTP API server
    let api_server = orchestrator.start_api_server(config.api_port).await?;
    info!("API server started on port {}", config.api_port);

    // Wait for shutdown signal
    match signal::ctrl_c().await {
        Ok(()) => {
            info!("Shutdown signal received, gracefully stopping...");
        }
        Err(err) => {
            error!("Unable to listen for shutdown signal: {}", err);
        }
    }

    // Graceful shutdown
    api_server.shutdown().await;
    orchestrator.shutdown().await;
    amqp_conn.close(200, "Graceful shutdown").await?;
    db_pool.close().await;

    info!("IronClaw Orchestrator stopped");
    Ok(())
}