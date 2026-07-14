#!/bin/bash
# AI Factory Setup Script
# Run this to set up the complete AI Factory platform

set -e

echo "🏭 AI Factory Setup Starting..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check prerequisites
check_prereqs() {
    log_info "Checking prerequisites..."
    
    command -v node >/dev/null 2>&1 || { log_error "Node.js not found. Install Node 22+"; exit 1; }
    command -v npm >/dev/null 2>&1 || { log_error "npm not found"; exit 1; }
    command -v pnpm >/dev/null 2>&1 || { log_warn "pnpm not found, installing..."; npm install -g pnpm; }
    command -v psql >/dev/null 2>&1 || { log_warn "PostgreSQL client not found"; }
    command -v cargo >/dev/null 2>&1 || { log_warn "Rust not found. Orchestrator will need cargo build"; }
    
    log_info "Node: $(node --version)"
    log_info "npm: $(npm --version)"
    log_info "pnpm: $(pnpm --version)"
}

# Setup root workspace
setup_root() {
    log_info "Setting up root workspace..."
    cd /home/parzival/ai-factory
    
    # Install root dependencies (turbo, typescript, etc.)
    pnpm install --ignore-scripts 2>&1 | tail -5
}

# Setup core package (database, types, constants)
setup_core() {
    log_info "Setting up @ai-factory/core..."
    cd /home/parzival/ai-factory/packages/core
    
    # Install dependencies
    pnpm install 2>&1 | tail -5
    
    # Generate Prisma client
    pnpm db:generate
    
    # Build TypeScript
    pnpm build
}

# Setup orchestrator (Rust + TS bridge)
setup_orchestrator() {
    log_info "Setting up @ai-factory/orchestrator..."
    cd /home/parzival/ai-factory/packages/orchestrator
    
    # Install TS dependencies
    pnpm install 2>&1 | tail -5
    
    # Build TS bridge
    pnpm build 2>&1 | tail -5
    
    # Build Rust binary (optional, requires cargo)
    if command -v cargo >/dev/null 2>&1; then
        cd rust
        cargo build --release 2>&1 | tail -5
        log_info "Rust orchestrator built at packages/orchestrator/rust/target/release/ironclaw-orchestrator"
    else
        log_warn "Rust not installed. Skipping orchestrator binary build."
        log_warn "Install Rust: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    fi
}

# Setup dashboard app
setup_dashboard() {
    log_info "Setting up @ai-factory/dashboard..."
    cd /home/parzival/ai-factory/apps/dashboard
    
    # Create local package.json without workspace deps for standalone install
    cat > package.json.local << 'EOF'
{
  "name": "@ai-factory/dashboard",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3001",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "db:generate": "prisma generate",
    "db:push": "prisma db push",
    "db:seed": "tsx prisma/seed.ts"
  },
  "dependencies": {
    "@clerk/nextjs": "^6.0.0",
    "@prisma/client": "^6.0.0",
    "@radix-ui/react-avatar": "^1.1.0",
    "@radix-ui/react-dialog": "^1.1.0",
    "@radix-ui/react-dropdown-menu": "^2.1.0",
    "@radix-ui/react-icons": "^1.3.0",
    "@radix-ui/react-label": "^2.1.0",
    "@radix-ui/react-progress": "^1.1.0",
    "@radix-ui/react-scroll-area": "^1.1.0",
    "@radix-ui/react-select": "^2.1.0",
    "@radix-ui/react-separator": "^1.1.0",
    "@radix-ui/react-slot": "^1.1.0",
    "@radix-ui/react-switch": "^1.1.0",
    "@radix-ui/react-tabs": "^1.1.0",
    "@radix-ui/react-toast": "^1.2.0",
    "@radix-ui/react-tooltip": "^1.1.0",
    "@tanstack/react-query": "^5.59.0",
    "@tanstack/react-table": "^8.16.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "date-fns": "^4.0.0",
    "framer-motion": "^11.0.0",
    "lucide-react": "^0.453.0",
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "recharts": "^2.12.0",
    "socket.io-client": "^4.7.0",
    "tailwind-merge": "^2.5.4",
    "zod": "^3.23.0",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.48.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "autoprefixer": "^10.4.20",
    "eslint": "^9.0.0",
    "eslint-config-next": "^15.0.0",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.14",
    "tailwindcss-animate": "^1.0.7",
    "typescript": "^5.6.0",
    "vitest": "^2.0.0"
  }
}
EOF
    
    # Use local package.json for standalone install
    mv package.json package.json.workspace 2>/dev/null || true
    mv package.json.local package.json
    
    # Install dependencies
    npm install 2>&1 | tail -10
    
    # Copy Prisma schema from core
    mkdir -p prisma
    cp -r /home/parzival/ai-factory/packages/core/prisma/* prisma/
    
    # Generate Prisma client
    npx prisma generate
}

# Setup environment
setup_env() {
    log_info "Setting up environment..."
    cd /home/parzival/ai-factory/apps/dashboard
    
    if [ ! -f .env ]; then
        cat > .env << 'EOF'
# Database (Neon PostgreSQL)
DATABASE_URL="postgresql://user:password@localhost:5432/ai_factory"

# Clerk Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_your_key"
CLERK_SECRET_KEY="sk_test_your_key"

# LLM Providers
GROQ_API_KEY="gsk_your_key"
GEMINI_API_KEY="AIza_your_key"

# App Config
NEXT_PUBLIC_APP_URL="http://localhost:3001"

# ACPX Bridge
ACPX_ENDPOINT="ws://localhost:8080/acp"

# Redis
REDIS_URL="redis://localhost:6379"

# RabbitMQ
RABBITMQ_URL="amqp://guest:guest@localhost:5672"
EOF
        log_warn "Created .env template. Please edit with your actual keys!"
    fi
}

# Database setup
setup_database() {
    log_info "Setting up database..."
    cd /home/parzival/ai-factory/apps/dashboard
    
    if command -v psql >/dev/null 2>&1 && [ -n "$DATABASE_URL" ]; then
        # Push schema
        npx prisma db push
        
        # Seed data
        npx tsx prisma/seed.ts
        log_info "Database schema initialized; no records were seeded"
    else
        log_warn "DATABASE_URL not set or psql not available. Skipping database setup."
        log_warn "Set DATABASE_URL in .env and run: npx prisma db push && npx tsx prisma/seed.ts"
    fi
}

# Build dashboard
build_dashboard() {
    log_info "Building dashboard..."
    cd /home/parzival/ai-factory/apps/dashboard
    npm run build 2>&1 | tail -20
}

# Main
main() {
    check_prereqs
    setup_root
    setup_core
    setup_orchestrator
    setup_dashboard
    setup_env
    setup_database
    build_dashboard
    
    echo ""
    log_info "✅ AI Factory Setup Complete!"
    echo ""
    echo "📋 Next Steps:"
    echo "  1. Edit /home/parzival/ai-factory/apps/dashboard/.env with your API keys"
    echo "  2. Start the dashboard: cd /home/parzival/ai-factory/apps/dashboard && npm run dev"
    echo "  3. Open http://localhost:3001"
    echo ""
    echo "🔧 Optional Services:"
    echo "  - Start IronClaw Orchestrator: cd /home/parzival/ai-factory/packages/orchestrator/rust && cargo run"
    echo "  - Start ACPX Bridge: (runs on port 8080)"
    echo "  - Start WhatsApp Bridge: (connects to WhatsApp Web)"
    echo ""
    echo "📚 Documentation: /home/parzival/.hermes/plans/ai-factory-company.md"
}

main "$@"
