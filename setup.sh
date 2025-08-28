#!/bin/bash

# Dive Inspector - Development Setup Script
# This script sets up the development environment for the Dive Inspector project

set -e

echo "🐳 Setting up Dive Inspector Development Environment"
echo "=================================================="

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

# Check if we're in WSL
if grep -qi microsoft /proc/version; then
    print_status "Detected WSL environment"
    WSL_ENV=true
else
    WSL_ENV=false
fi

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check Node.js
    if command -v node >/dev/null 2>&1; then
        NODE_VERSION=$(node --version)
        print_success "Node.js found: $NODE_VERSION"
    else
        print_error "Node.js is not installed. Please install Node.js 18+ first."
        exit 1
    fi
    
    # Check npm
    if command -v npm >/dev/null 2>&1; then
        NPM_VERSION=$(npm --version)
        print_success "npm found: $NPM_VERSION"
    else
        print_error "npm is not installed."
        exit 1
    fi
    
    # Check Docker
    if command -v docker >/dev/null 2>&1; then
        DOCKER_VERSION=$(docker --version)
        print_success "Docker found: $DOCKER_VERSION"
        
        # Test Docker access
        if docker ps >/dev/null 2>&1; then
            print_success "Docker daemon is accessible"
        else
            print_warning "Docker daemon is not accessible. Make sure Docker is running."
        fi
    else
        print_error "Docker is not installed. Please install Docker Desktop first."
        exit 1
    fi
    
    # Check for dive
    if command -v dive >/dev/null 2>&1; then
        DIVE_VERSION=$(dive --version 2>/dev/null || echo "version unknown")
        print_success "Dive found: $DIVE_VERSION"
    else
        print_warning "Dive is not installed. Will attempt to install..."
        install_dive
    fi
}

# Install dive tool
install_dive() {
    print_status "Installing dive tool..."
    
    if [ "$WSL_ENV" = true ]; then
        # WSL/Linux installation
        DIVE_VERSION=$(curl -sL "https://api.github.com/repos/wagoodman/dive/releases/latest" | grep '"tag_name":' | sed -E 's/.*"v([^"]+)".*/\1/')
        curl -fOL "https://github.com/wagoodman/dive/releases/download/v${DIVE_VERSION}/dive_${DIVE_VERSION}_linux_amd64.tar.gz"
        tar -xzf "dive_${DIVE_VERSION}_linux_amd64.tar.gz"
        sudo mv dive /usr/local/bin/
        rm "dive_${DIVE_VERSION}_linux_amd64.tar.gz"
        print_success "Dive installed successfully"
    else
        print_warning "Please install dive manually from: https://github.com/wagoodman/dive/releases"
        print_warning "Or use: brew install dive (on macOS)"
    fi
}

# Setup project
setup_project() {
    print_status "Setting up project structure..."
    
    # Create environment file
    if [ ! -f .env ]; then
        cp .env.example .env
        print_success "Created .env file from template"
    else
        print_warning ".env file already exists"
    fi
    
    # Create logs directory
    mkdir -p logs temp
    print_success "Created logs and temp directories"
    
    # Install backend dependencies
    print_status "Installing backend dependencies..."
    cd backend
    npm install
    print_success "Backend dependencies installed"
    cd ..
    
    # Install frontend dependencies
    print_status "Installing frontend dependencies..."
    cd frontend
    npm install
    print_success "Frontend dependencies installed"
    cd ..
}

# Build project
build_project() {
    print_status "Building frontend..."
    cd frontend
    npm run build
    print_success "Frontend built successfully"
    cd ..
}

# Create development scripts
create_dev_scripts() {
    print_status "Creating development scripts..."
    
    # Development start script
    cat > start-dev.sh << 'EOF'
#!/bin/bash
# Start development servers

echo "🚀 Starting Dive Inspector Development Servers"

# Start backend in background
echo "Starting backend server..."
cd backend && npm run dev &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 2

# Start frontend
echo "Starting frontend development server..."
cd frontend && npm run dev &
FRONTEND_PID=$!

echo "Backend running on: http://localhost:3000"
echo "Frontend running on: http://localhost:3001"
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"

# Wait for user input to stop
echo "Press Ctrl+C to stop all servers"
trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT
wait
EOF

    chmod +x start-dev.sh
    
    # Production start script
    cat > start-prod.sh << 'EOF'
#!/bin/bash
# Start production server

echo "🐳 Starting Dive Inspector Production Server"

# Build frontend if needed
if [ ! -d "frontend/dist" ]; then
    echo "Building frontend..."
    cd frontend && npm run build && cd ..
fi

# Start backend
echo "Starting production server..."
cd backend && npm start
EOF

    chmod +x start-prod.sh
    
    # Docker build script
    cat > build-docker.sh << 'EOF'
#!/bin/bash
# Build and run Docker container

echo "🐳 Building Dive Inspector Docker Image"

# Build the image
docker build -f docker/Dockerfile -t dive-inspector:latest .

echo "✅ Build complete!"
echo "To run: docker-compose -f docker/docker-compose.yml up"
EOF

    chmod +x build-docker.sh
    
    print_success "Development scripts created"
}

# Main setup process
main() {
    echo
    print_status "Starting Dive Inspector setup..."
    echo
    
    check_prerequisites
    echo
    
    setup_project
    echo
    
    create_dev_scripts
    echo
    
    print_success "🎉 Setup complete!"
    echo
    print_status "Next steps:"
    echo "  1. Review and update .env file if needed"
    echo "  2. For development: ./start-dev.sh"
    echo "  3. For production: ./start-prod.sh"
    echo "  4. For Docker: ./build-docker.sh && docker-compose -f docker/docker-compose.yml up"
    echo
    print_status "API will be available at: http://localhost:3000"
    print_status "Frontend will be available at: http://localhost:3001 (dev) or http://localhost:3000 (prod)"
    echo
}

# Run main function
main "$@"
