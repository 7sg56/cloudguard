#!/usr/bin/env bash

# ==============================================================================
# CloudGuard CSPM — Docker Orchestration & Management Script
# ==============================================================================
# Usage:
#   ./docker-start.sh [start|stop|restart|logs|status|clean|build]
#
# Commands:
#   start     - Build and start all containers in detached mode (default)
#   stop      - Stop all running containers
#   restart   - Restart all containers
#   logs      - View streaming logs across all containers (or specify a service)
#   status    - Check container health and port mappings
#   clean     - Stop containers and remove volumes (database reset)
#   build     - Rebuild container images without cache
# ==============================================================================

set -euo pipefail

# Define paths and colors
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${PROJECT_ROOT}/docker/docker-compose.yml"
ENV_FILE="${PROJECT_ROOT}/.env"
ENV_EXAMPLE="${PROJECT_ROOT}/.env.example"

# ANSI Colors
CLR_RESET="\033[0m"
CLR_BOLD="\033[1m"
CLR_RED="\033[31m"
CLR_GREEN="\033[32m"
CLR_YELLOW="\033[33m"
CLR_BLUE="\033[34m"
CLR_CYAN="\033[36m"

log_info() {
    printf "${CLR_BLUE}[INFO]${CLR_RESET} %s\n" "$1"
}

log_success() {
    printf "${CLR_GREEN}[SUCCESS]${CLR_RESET} %s\n" "$1"
}

log_warning() {
    printf "${CLR_YELLOW}[WARNING]${CLR_RESET} %s\n" "$1"
}

log_error() {
    printf "${CLR_RED}[ERROR]${CLR_RESET} %s\n" "$1" >&2
}

# ------------------------------------------------------------------------------
# Pre-flight Checks
# ------------------------------------------------------------------------------
check_docker() {
    log_info "Verifying Docker environment..."
    if ! command -v docker >/dev/null 2>&1; then
        log_error "Docker is not installed or not available in PATH."
        log_error "Please install Docker Desktop from https://www.docker.com/products/docker-desktop"
        exit 1
    fi

    if ! docker info >/dev/null 2>&1; then
        log_error "Docker daemon is not running."
        log_error "Please start Docker Desktop and run this script again."
        exit 1
    fi

    # Detect docker compose v2 vs docker-compose v1
    if docker compose version >/dev/null 2>&1; then
        DOCKER_COMPOSE="docker compose"
    elif command -v docker-compose >/dev/null 2>&1; then
        DOCKER_COMPOSE="docker-compose"
    else
        log_error "Docker Compose is not installed."
        exit 1
    fi
}

check_env() {
    if [[ ! -f "$ENV_FILE" ]]; then
        if [[ -f "$ENV_EXAMPLE" ]]; then
            log_warning ".env file not found. Creating default .env from .env.example..."
            cp "$ENV_EXAMPLE" "$ENV_FILE"
            log_success "Created .env file. Please review your GROQ_API_KEY and AWS settings in .env."
        else
            log_error "Neither .env nor .env.example was found in ${PROJECT_ROOT}."
            exit 1
        fi
    fi
}

# ------------------------------------------------------------------------------
# Core Actions
# ------------------------------------------------------------------------------
cmd_start() {
    check_docker
    check_env

    printf "\n"
    printf "${CLR_CYAN}${CLR_BOLD}======================================================${CLR_RESET}\n"
    printf "${CLR_CYAN}${CLR_BOLD}  Starting CloudGuard CSPM Infrastructure (Docker)    ${CLR_RESET}\n"
    printf "${CLR_CYAN}${CLR_BOLD}======================================================${CLR_RESET}\n"
    printf "\n"

    # Stop any orphan standalone containers that might conflict on host ports
    if docker ps -q -f "name=cspm-redis" | grep -q .; then
        log_info "Stopping conflicting standalone redis container..."
        docker stop cspm-redis >/dev/null 2>&1 || true
        docker rm cspm-redis >/dev/null 2>&1 || true
    fi

    log_info "Building and launching containers via Docker Compose..."
    $DOCKER_COMPOSE -f "$COMPOSE_FILE" up -d --build

    log_info "Waiting for backing services to become healthy..."
    sleep 3

    printf "\n"
    log_success "All CloudGuard services are up and running."
    printf "\n"
    printf "${CLR_BOLD}Service Endpoints:${CLR_RESET}\n"
    printf "  - Web Console (Frontend):  ${CLR_GREEN}http://localhost:3000${CLR_RESET}\n"
    printf "  - REST API (FastAPI):      ${CLR_GREEN}http://localhost:8000${CLR_RESET}\n"
    printf "  - Interactive API Docs:    ${CLR_GREEN}http://localhost:8000/docs${CLR_RESET}\n"
    printf "  - PostgreSQL Database:     ${CLR_CYAN}localhost:5432 (db: cspm, user: cspm)${CLR_RESET}\n"
    printf "  - Redis Cache:             ${CLR_CYAN}localhost:6379${CLR_RESET}\n"
    printf "\n"
    printf "${CLR_BOLD}Useful Commands:${CLR_RESET}\n"
    printf "  - View live logs:          ${CLR_YELLOW}./docker-start.sh logs${CLR_RESET}\n"
    printf "  - View API logs:           ${CLR_YELLOW}./docker-start.sh logs api${CLR_RESET}\n"
    printf "  - Stop all services:       ${CLR_YELLOW}./docker-start.sh stop${CLR_RESET}\n"
    printf "  - Service status:          ${CLR_YELLOW}./docker-start.sh status${CLR_RESET}\n"
    printf "\n"
}

cmd_stop() {
    check_docker
    log_info "Stopping all CloudGuard containers..."
    $DOCKER_COMPOSE -f "$COMPOSE_FILE" down
    log_success "All containers stopped successfully."
}

cmd_restart() {
    check_docker
    log_info "Restarting CloudGuard containers..."
    $DOCKER_COMPOSE -f "$COMPOSE_FILE" restart
    log_success "All containers restarted."
}

cmd_logs() {
    check_docker
    local service="${1:-}"
    if [[ -n "$service" ]]; then
        log_info "Streaming logs for service '${service}'..."
        $DOCKER_COMPOSE -f "$COMPOSE_FILE" logs -f "$service"
    else
        log_info "Streaming logs for all services (Ctrl+C to exit)..."
        $DOCKER_COMPOSE -f "$COMPOSE_FILE" logs -f
    fi
}

cmd_status() {
    check_docker
    printf "\n${CLR_BOLD}Container Status:${CLR_RESET}\n"
    $DOCKER_COMPOSE -f "$COMPOSE_FILE" ps
}

cmd_clean() {
    check_docker
    log_warning "This will remove all CloudGuard containers and delete persistent database volumes."
    read -rp "Are you sure you want to proceed? (y/N): " confirm
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
        $DOCKER_COMPOSE -f "$COMPOSE_FILE" down -v --remove-orphans
        log_success "Containers and database volumes removed."
    else
        log_info "Clean cancelled."
    fi
}

cmd_build() {
    check_docker
    check_env
    log_info "Rebuilding container images without cache..."
    $DOCKER_COMPOSE -f "$COMPOSE_FILE" build --no-cache
    log_success "Images rebuilt successfully."
}

# ------------------------------------------------------------------------------
# Dispatcher
# ------------------------------------------------------------------------------
ACTION="${1:-start}"

case "$ACTION" in
    start|up)
        cmd_start
        ;;
    stop|down)
        cmd_stop
        ;;
    restart)
        cmd_restart
        ;;
    logs)
        cmd_logs "${2:-}"
        ;;
    status|ps)
        cmd_status
        ;;
    clean)
        cmd_clean
        ;;
    build)
        cmd_build
        ;;
    help|--help|-h)
        printf "Usage: %s [start|stop|restart|logs|status|clean|build]\n" "$0"
        ;;
    *)
        log_error "Unknown command: ${ACTION}"
        printf "Usage: %s [start|stop|restart|logs|status|clean|build]\n" "$0"
        exit 1
        ;;
esac
