#!/bin/bash

# SpellTable Deployment Script
# This script helps deploy the SpellTable application using Docker Compose

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    print_success "Docker is running"
}

# Check if Docker Compose is available
check_docker_compose() {
    if ! command -v docker-compose > /dev/null 2>&1 && ! docker compose version > /dev/null 2>&1; then
        print_error "Docker Compose is not available. Please install Docker Compose and try again."
        exit 1
    fi
    print_success "Docker Compose is available"
}

# Function to deploy the application
deploy() {
    local compose_file=${1:-"docker-compose.yml"}
    
    print_status "Starting deployment with $compose_file..."
    
    # Check if compose file exists
    if [ ! -f "$compose_file" ]; then
        print_error "Compose file $compose_file not found!"
        exit 1
    fi
    
    # Stop existing containers if running
    print_status "Stopping existing containers..."
    docker compose -f "$compose_file" down --remove-orphans 2>/dev/null || true
    
    # Build and start services with timeout
    print_status "Building and starting services..."
    print_warning "This may take several minutes. If it hangs, press Ctrl+C and try again."
    
    # Set a timeout for the build process (30 minutes)
    timeout 1800 docker compose -f "$compose_file" up -d --build || {
        print_error "Build process timed out or failed. Trying to clean up..."
        docker compose -f "$compose_file" down --remove-orphans 2>/dev/null || true
        print_error "Please check the logs and try again."
        exit 1
    }
    
    # Wait for services to be healthy
    print_status "Waiting for services to be ready..."
    sleep 10
    
    # Check service status
    print_status "Checking service status..."
    docker compose -f "$compose_file" ps
    
    print_success "Deployment completed!"
    print_status "Services are now running internally and ready for Apache proxy configuration"
    print_status "Frontend is available internally at: http://localhost:3000"
    print_status "Backend is available internally at: http://localhost:8010"
    print_status ""
    print_status "IMPORTANT: Make sure your Apache proxy is configured to:"
    print_status "  - Proxy /api/ to http://localhost:8010/"
    print_status "  - Proxy / to http://localhost:3000/"
    print_status ""
    print_status "Your application will be accessible at your domain (e.g., https://spelltable.paulhoeller.at)"
}

# Function to show logs
show_logs() {
    local compose_file=${1:-"docker-compose.yml"}
    print_status "Showing logs (press Ctrl+C to exit)..."
    docker compose -f "$compose_file" logs -f
}

# Function to stop the application
stop() {
    local compose_file=${1:-"docker-compose.yml"}
    print_status "Stopping application..."
    docker compose -f "$compose_file" down
    print_success "Application stopped"
}

# Function to restart the application
restart() {
    local compose_file=${1:-"docker-compose.yml"}
    print_status "Restarting application..."
    docker compose -f "$compose_file" restart
    print_success "Application restarted"
}

# Function to show status
status() {
    local compose_file=${1:-"docker-compose.yml"}
    print_status "Application status:"
    docker compose -f "$compose_file" ps
}

# Function to troubleshoot build issues
troubleshoot() {
    local compose_file=${1:-"docker-compose.yml"}
    print_status "Troubleshooting build issues..."
    
    print_status "Cleaning up Docker resources..."
    docker system prune -f
    
    print_status "Checking available disk space..."
    df -h
    
    print_status "Checking Docker daemon status..."
    docker info
    
    print_status "Showing recent Docker logs..."
    docker compose -f "$compose_file" logs --tail=50
    
    print_warning "If the build is still hanging, try:"
    print_warning "1. Restart Docker daemon: sudo systemctl restart docker"
    print_warning "2. Increase Docker memory limit in Docker Desktop settings"
    print_warning "3. Try building with: docker compose build --no-cache --progress=plain"
}

# Function to show help
show_help() {
    echo "SpellTable Deployment Script"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  deploy [file]    Deploy the application (default: docker-compose.yml)"
    echo "  stop [file]      Stop the application"
    echo "  restart [file]   Restart the application"
    echo "  logs [file]      Show application logs"
    echo "  status [file]    Show application status"
    echo "  troubleshoot [file]  Troubleshoot build issues"
    echo "  help             Show this help message"
    echo ""
    echo "Options:"
    echo "  file             Docker Compose file (default: docker-compose.yml)"
    echo ""
    echo "Examples:"
    echo "  $0 deploy                    # Deploy using docker-compose.yml"
    echo "  $0 deploy docker-compose.prod.yml  # Deploy using production config"
    echo "  $0 logs                      # Show logs"
    echo "  $0 stop                      # Stop application"
    echo "  $0 troubleshoot              # Troubleshoot build issues"
    echo ""
    echo "Note: This deployment assumes Apache proxy configuration for external access."
    echo "Services run internally and are proxied by Apache to your domain."
}

# Main script logic
main() {
    # Check prerequisites
    check_docker
    check_docker_compose
    
    case "${1:-deploy}" in
        "deploy")
            deploy "$2"
            ;;
        "stop")
            stop "$2"
            ;;
        "restart")
            restart "$2"
            ;;
        "logs")
            show_logs "$2"
            ;;
        "status")
            status "$2"
            ;;
        "troubleshoot")
            troubleshoot "$2"
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            print_error "Unknown command: $1"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
