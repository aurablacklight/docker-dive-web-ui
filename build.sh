#!/bin/bash

# Build optimization script
set -e

echo "🚀 Docker Build Optimization Script"

# Enable BuildKit and disable entitlement checks
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1
export BUILDX_BAKE_ENTITLEMENTS_FS=0

# Source Docker environment if it exists
if [ -f ".env.docker" ]; then
    source .env.docker
fi

# Function for fast parallel build using Docker Bake
build_with_bake() {
    echo "📦 Building with Docker Bake (parallel + cache)..."
    docker buildx bake --pull
    
    # Move cache to avoid conflicts
    if [ -d "./.buildx-cache-new" ]; then
        rm -rf ./.buildx-cache
        mv ./.buildx-cache-new ./.buildx-cache
    fi
}

# Function for optimized compose build
build_with_compose() {
    echo "📦 Building with optimized Docker Compose..."
    docker compose -f docker-compose.optimized.yml build --parallel --pull
}

# Function for development build (faster rebuilds)
build_dev() {
    echo "📦 Development build (cache optimized)..."
    docker compose build --parallel
}

# Function for production build (clean)
build_prod() {
    echo "📦 Production build (clean + optimized)..."
    docker compose -f docker-compose.optimized.yml build --no-cache --parallel --pull
}

# Check if docker buildx is available
if command -v docker buildx &> /dev/null && [ -f "docker-bake.hcl" ]; then
    echo "✅ Docker Buildx available - using Bake"
    build_with_bake
elif [ -f "docker-compose.optimized.yml" ]; then
    echo "✅ Using optimized Docker Compose"
    build_with_compose
else
    echo "⚠️  Using standard Docker Compose"
    build_dev
fi

echo "✅ Build complete!"

# Optional: Start services
read -p "Start services? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ -f "docker-compose.optimized.yml" ]; then
        docker compose -f docker-compose.optimized.yml up -d
    else
        docker compose up -d
    fi
    echo "🎉 Services started!"
fi
