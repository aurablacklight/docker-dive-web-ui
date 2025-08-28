# Docker Dive Web UI

A modern, containerized web interface for analyzing Docker images using the [dive](https://github.com/wagoodman/dive) tool. Features a beautiful glassmorphism design and real-time Docker image analysis.

## Features

- 🔍 **Docker Image Analysis**: Analyze any Docker image for layer efficiency and waste detection
- 📊 **Real-time Metrics**: Live efficiency scoring, wasted space analysis, and layer breakdown
- 🎨 **Modern UI**: Beautiful glassmorphism design with responsive layout
- 🐳 **Fully Containerized**: Multi-container architecture with Docker Compose
- ⚡ **WebSocket Updates**: Real-time progress tracking during analysis
- 🔬 **Layer-by-Layer**: Detailed breakdown of each Docker layer with file counts and sizes
- 📈 **Efficiency Insights**: Actionable recommendations for image optimization

## Architecture

- **Frontend**: React 18 with custom CSS glassmorphism design (Port 3001)
- **Backend**: Node.js/Express API server with Socket.IO (Port 3000)  
- **Analysis Engine**: Integrated dive binary with Docker CLI access
- **Deployment**: Multi-container setup with nginx reverse proxy
- **Networking**: Docker Compose with bridge networking and health checks

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
2. Enter a Docker image name (e.g., `nginx:alpine`, `node:18`, `ubuntu:latest`)
3. Click "Analyze Image" to start the analysis
4. View real-time results with efficiency metrics and layer breakdown

## API Endpoints

- `POST /api/inspect/:imageName` - Analyze a Docker image with dive
- `GET /api/health` - Health check endpoint
- `GET /api/search?q=<query>` - Search for Docker images
- `GET /api/images/local` - List local Docker images
- `WebSocket /ws/inspect` - Real-time analysis progress updates

### Example API Usage

```bash
# Analyze nginx:alpine image
curl -X POST http://localhost:3000/api/inspect/nginx:alpine

# Health check
curl http://localhost:3000/api/health
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
│   nginx         │    │   + dive binary  │
└─────────────────┘    └──────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │   Docker Engine  │
                       │   (via socket)   │
                       └──────────────────┘
```

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

## Troubleshooting

### Common Issues

1. **Port conflicts**: Ensure ports 3000 and 3001 are available
2. **Docker socket**: Verify Docker Desktop is running and socket is accessible
3. **Container startup**: Check logs with `docker-compose logs`

### Viewing Logs

```bash
# All logs
docker-compose logs

# Backend only
docker-compose logs backend

# Follow logs
docker-compose logs -f backend
```
