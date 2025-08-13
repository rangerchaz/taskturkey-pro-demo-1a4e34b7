#!/bin/bash
# Production deployment script for TaskTurkey Pro

set -e  # Exit on any error

echo "🚀 Starting TaskTurkey Pro deployment..."

# Configuration
DOCKER_IMAGE="taskturkey-pro"
CONTAINER_NAME="taskturkey-app"
BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
HEALTH_CHECK_URL="http://localhost:3000/api/health"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

# Pre-deployment checks
check_prerequisites() {
    log "Checking prerequisites..."
    
    command -v docker >/dev/null 2>&1 || error "Docker is not installed"
    command -v curl >/dev/null 2>&1 || error "curl is not installed"
    
    if [ ! -f ".env" ]; then
        warn ".env file not found. Creating from template..."
        cp .env.example .env
        warn "Please configure .env file before proceeding"
        exit 1
    fi
    
    log "Prerequisites check passed ✅"
}

# Backup current deployment
backup_current() {
    log "Creating backup..."
    mkdir -p "$BACKUP_DIR"
    
    if docker ps | grep -q "$CONTAINER_NAME"; then
        docker logs "$CONTAINER_NAME" > "$BACKUP_DIR/app.log" 2>&1 || true
        log "Logs backed up to $BACKUP_DIR"
    fi
}

# Build new image
build_image() {
    log "Building Docker image..."
    docker build -t "$DOCKER_IMAGE:latest" . || error "Docker build failed"
    log "Docker image built successfully ✅"
}

# Deploy new version
deploy() {
    log "Stopping existing container..."
    docker stop "$CONTAINER_NAME" 2>/dev/null || true
    docker rm "$CONTAINER_NAME" 2>/dev/null || true
    
    log "Starting new container..."
    docker run -d \
        --name "$CONTAINER_NAME" \
        --restart unless-stopped \
        -p 3000:3000 \
        --env-file .env \
        -v "$(pwd)/logs:/app/logs" \
        "$DOCKER_IMAGE:latest" || error "Container start failed"
    
    log "Container started successfully ✅"
}

# Health check
health_check() {
    log "Performing health check..."
    
    local retries=0
    local max_retries=30
    
    while [ $retries -lt $max_retries ]; do
        if curl -f -s "$HEALTH_CHECK_URL" >/dev/null 2>&1; then
            log "Health check passed ✅"
            log "TaskTurkey Pro is running at http://localhost:3000"
            return 0
        fi
        
        retries=$((retries + 1))
        log "Health check attempt $retries/$max_retries..."
        sleep 2
    done
    
    error "Health check failed after $max_retries attempts"
}

# Cleanup old images
cleanup() {
    log "Cleaning up old Docker images..."
    docker image prune -f || warn "Failed to clean up images"
}

# Main deployment flow
main() {
    log "=== TaskTurkey Pro Deployment Started ==="
    
    check_prerequisites
    backup_current
    build_image
    deploy
    health_check
    cleanup
    
    log "=== TaskTurkey Pro Deployment Completed Successfully! 🎉 ==="
    log "Application is available at: http://localhost:3000"
    log "API health check: $HEALTH_CHECK_URL"
}

# Run deployment
main "$@"