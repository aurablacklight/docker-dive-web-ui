# Docker Dive Web UI

A modern, containerized web interface for analyzing Docker images using the [dive](https://github.com/wagoodman/dive) tool. Features a beautiful glassmorphism design and real-time Docker image analysis.

## Features

- 🔍 **Docker Image Analysis**: Analyze any Docker image for layer efficiency and waste detection
- � **Docker Hub Search**: Search and discover Docker images directly from Docker Hub
- �📊 **Real-time Metrics**: Live efficiency scoring, wasted space analysis, and layer breakdown
- 🎨 **Modern UI**: Beautiful glassmorphism design with responsive layout and smooth animations
- 🐳 **Fully Containerized**: Multi-container architecture with Docker Compose
- ⚡ **WebSocket Updates**: Real-time progress tracking during analysis
- 🔬 **Layer-by-Layer**: Detailed breakdown of each Docker layer with file counts and sizes
- 📈 **Efficiency Insights**: Actionable recommendations for image optimization
- 🎯 **Interactive Commands**: Expandable/collapsible Docker layer commands with syntax highlighting
- ☁️ **Kubernetes Ready**: Complete Helm chart for Kubernetes deployment with AWS EKS optimizations
- 🔧 **Enhanced UX**: Intelligent error handling with graceful fallbacks

## Architecture

- **Frontend**: React 18 with custom CSS glassmorphism design and interactive layer breakdown (Port 3001)
- **Backend**: Node.js/Express API server with Socket.IO and Docker Hub integration (Port 3000)  
- **Analysis Engine**: Integrated dive binary with Docker CLI access and enhanced error handling
- **Search Engine**: Docker Hub API integration for image discovery and metadata retrieval
- **Deployment**: Multi-container setup with nginx reverse proxy and health monitoring
- **Networking**: Docker Compose with bridge networking and comprehensive health checks
- **Kubernetes**: Production-ready Helm chart with AWS EKS 1.30 compatibility and auto-scaling

## Quick Start

### Prerequisites
- Docker and Docker Compose
- Git

### Installation & Usage

```bash
# Clone the repository
git clone https://github.com/aurablacklight/docker-dive-web-ui.git
cd docker-dive-web-ui

# Start the application
docker-compose up -d

# Access the web interface
open http://localhost:3001
```

The application will be available at:
- **Web UI**: http://localhost:3001 (React frontend)
- **API**: http://localhost:3000 (Backend API)

### Analyzing Images

1. Open http://localhost:3001 in your browser
2. **Search for images**: Use the search functionality to discover Docker images from Docker Hub
3. **Browse results**: View image details including stars, downloads, and descriptions
4. **Select and analyze**: Click on any image to start detailed layer analysis
5. **Explore layers**: Use the expandable layer commands to view detailed Docker build steps
6. **Optimize**: Review efficiency metrics and waste analysis for optimization opportunities

### Key UI Features

- **Expandable Commands**: Click arrow buttons to expand/collapse individual layer commands
- **Global Controls**: Use "Expand All" / "Collapse All" buttons to control all layers at once
- **Syntax Highlighting**: Monospace formatted commands with proper line breaks
- **Interactive Search**: Real-time Docker Hub search with image metadata
- **Progress Tracking**: Real-time WebSocket updates during image analysis

## API Endpoints

### Core Analysis
- `POST /api/inspect/:imageName` - Analyze a Docker image with dive
- `GET /api/health` - Health check endpoint
- `DELETE /api/inspect/:imageName` - Clean up analysis artifacts

### Docker Hub Integration  
- `GET /api/search?q=<query>&limit=<number>` - Search Docker Hub for images
- `GET /api/search/repository/:owner/:repo` - Get detailed repository information
- `GET /api/images/local` - List local Docker images

### Real-time Updates
- `WebSocket /ws/inspect` - Real-time analysis progress updates

### Example API Usage

```bash
# Search for nginx images
curl "http://localhost:3000/api/search?q=nginx&limit=10"

# Get repository details
curl http://localhost:3000/api/search/repository/library/nginx

# Analyze nginx:alpine image  
curl -X POST http://localhost:3000/api/inspect/nginx:alpine

# Health check
curl http://localhost:3000/api/health

# Clean up analysis artifacts
curl -X DELETE http://localhost:3000/api/inspect/nginx:alpine
```

## Development

### Local Development (without containers)

```bash
# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Start backend (port 3000)
cd backend && npm run dev

# Start frontend (port 3001) 
cd frontend && npm start
```

### Container Development

```bash
# Build and start with logs
docker-compose up --build

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Restart specific service
docker-compose restart backend

# Stop all services
docker-compose down
```

## Configuration

Key environment variables in `docker-compose.yml`:

- `NODE_ENV=production` - Production mode for optimized builds
- `PORT=3000` - Backend server port
- Docker socket mount: `/var/run/docker.sock:/var/run/docker.sock` - Required for dive to access Docker

## Container Architecture

```
┌─────────────────┐    ┌──────────────────┐
│   Frontend      │    │     Backend      │
│   (React)       │    │   (Node.js)      │
│   Port: 3001    │───▶│   Port: 3000     │
│   nginx +       │    │   + dive binary  │
│   Enhanced UI   │    │   + Docker Hub   │
└─────────────────┘    └──────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │   Docker Engine  │
                       │   (via socket)   │
                       └──────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │  Kubernetes      │
                       │  (Helm Chart)    │ 
                       │  AWS EKS Ready   │
                       └──────────────────┘
```

## Kubernetes Deployment

This project includes a comprehensive Helm chart for production Kubernetes deployment:

### Features
- **AWS EKS 1.30 Compatible**: Tested and optimized for latest Kubernetes
- **Auto-scaling**: Horizontal Pod Autoscaler (HPA) configuration
- **High Availability**: Pod Disruption Budgets and anti-affinity rules  
- **Storage**: EBS CSI driver integration with persistent volumes
- **Networking**: ALB Ingress Controller support with SSL termination
- **Security**: IRSA (IAM Roles for Service Accounts) integration
- **Monitoring**: Health checks and readiness probes

### Quick Helm Deployment

```bash
# Install to Kubernetes cluster
helm install docker-dive-ui ./helm/docker-dive-chart

# Upgrade deployment
helm upgrade docker-dive-ui ./helm/docker-dive-chart

# Check status
kubectl get pods,svc,ingress -l app.kubernetes.io/name=docker-dive-chart
```

See `helm/KUBERNETES-1.30-EKS-COMPATIBILITY.md` for detailed deployment instructions.

## Environment Requirements

- **Docker Desktop** with WSL2 (Windows) or Docker Engine (Linux/macOS)
- **Docker Compose** v2.0+
- **Docker socket access** - Required for dive to analyze images
- **Node.js 18+** (for local development only)

## Security Features

- Container isolation with minimal privileges
- Docker socket access restricted to backend container only  
- Input validation and sanitization on all endpoints
- Rate limiting on analysis endpoints
- CORS properly configured for frontend/backend communication
- Enhanced error handling with graceful degradation
- Kubernetes RBAC integration for cluster deployments
- AWS IRSA support for secure cloud resource access

## Troubleshooting

### Common Issues

1. **Port conflicts**: Ensure ports 3000 and 3001 are available
2. **Docker socket**: Verify Docker Desktop is running and socket is accessible
3. **Container startup**: Check logs with `docker-compose logs`
4. **Search timeouts**: Docker Hub API may occasionally be slow - the UI handles this gracefully
5. **Layer expansion**: If layer commands don't expand, check browser console for JavaScript errors

### Performance Tips

- **Image analysis**: Larger images (>1GB) may take 2-3 minutes to analyze
- **Search results**: Limit search results to 25-50 for optimal performance  
- **Browser memory**: For very large images, consider refreshing the page after analysis
- **Kubernetes**: Use resource limits in production deployments

### Viewing Logs

```bash
# All logs
docker-compose logs

# Backend only
docker-compose logs backend

# Follow logs
docker-compose logs -f backend
```
