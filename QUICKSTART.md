# Quick Start Guide

## 🚀 Getting Started with Dive Inspector

### Prerequisites
- **Docker Desktop for Windows** with WSL2 backend
- **Node.js 18+** and npm
- **WSL2** enabled (recommended for development)

### Option 1: Development Setup (Recommended for Testing)

1. **Install dependencies:**
```bash
# Install root dependencies
npm install

# Install all project dependencies
npm run install:all
```

2. **Install dive tool:**
```bash
# In WSL/Linux
curl -fOL "https://github.com/wagoodman/dive/releases/download/v0.13.1/dive_0.13.1_linux_amd64.tar.gz"
tar -xzf dive_0.13.1_linux_amd64.tar.gz
sudo mv dive /usr/local/bin/
rm dive_0.13.1_linux_amd64.tar.gz

# Verify installation
dive --version
```

3. **Setup environment:**
```bash
cp .env.example .env
mkdir -p logs temp
```

4. **Start development servers:**
```bash
# Option A: Use convenient script
npm run dev

# Option B: Manual start
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend  
cd frontend && npm run dev
```

5. **Access the application:**
- Frontend: http://localhost:3001
- Backend API: http://localhost:3000
- Health Check: http://localhost:3000/api/health

### Option 2: Docker Setup (Production-like)

1. **Build and run with Docker:**
```bash
# Build the Docker image
npm run docker:build

# Start with docker-compose
npm run docker:up

# Access at http://localhost:3000
```

### Option 3: Quick Test (Backend Only)

1. **Start just the backend:**
```bash
cd backend
npm install
npm run dev
```

2. **Test API endpoints:**
```bash
# Health check
curl http://localhost:3000/api/health

# Search Docker Hub
curl "http://localhost:3000/api/search?q=nginx"

# Get popular images
curl http://localhost:3000/api/search/popular

# List local images
curl http://localhost:3000/api/images/local

# Inspect an image (will pull nginx:latest if not present)
curl -X POST http://localhost:3000/api/inspect/nginx:latest
```

## 🧪 Testing the Application

### Test Search Functionality
1. Go to http://localhost:3001 (or :3000 in Docker mode)
2. Use the search bar to search for "nginx", "node", or "ubuntu"
3. Click on popular image suggestions
4. Verify image cards display with metadata

### Test Image Inspection
1. Click "Pull & Inspect" on any image card
2. Wait for the pull and analysis to complete
3. View the layer breakdown and efficiency metrics
4. Explore individual layer details

### Test API Directly
```bash
# Search for images
curl "http://localhost:3000/api/search?q=alpine"

# Inspect an image (this will take a few minutes)
curl -X POST http://localhost:3000/api/inspect/alpine:latest

# Check inspection status
curl http://localhost:3000/api/inspect/alpine:latest/status
```

## 🐛 Troubleshooting

### Common Issues

1. **Docker not accessible:**
   - Ensure Docker Desktop is running
   - Check Docker socket permissions in WSL: `sudo usermod -aG docker $USER`
   - Restart WSL after adding to docker group

2. **Dive not found:**
   - Install dive manually: See installation steps above
   - Check PATH: `echo $PATH | grep /usr/local/bin`

3. **Port conflicts:**
   - Change ports in package.json scripts
   - Kill existing processes: `lsof -ti:3000 | xargs kill -9`

4. **CORS issues in development:**
   - Frontend proxies API calls to backend
   - Check webpack.config.js proxy settings

5. **Permission issues in WSL:**
   - Run with appropriate permissions
   - Check file ownership: `ls -la`

### Logs
- Backend logs: Console output from `npm run dev`
- Docker logs: `docker-compose logs -f`
- Access logs: Check backend/logs/ directory

### Verification Commands
```bash
# Check all services
docker --version
node --version
npm --version
dive --version

# Test Docker socket access
docker ps

# Test dive
dive hello-world
```

## 📡 API Documentation

### Search Endpoints
- `GET /api/search?q=<query>` - Search Docker Hub
- `GET /api/search/popular` - Get popular images
- `GET /api/search/image/<name>` - Get image details

### Inspection Endpoints  
- `POST /api/inspect/<image>` - Analyze image with dive
- `GET /api/inspect/<image>/status` - Get analysis status
- `GET /api/inspect/health` - Check dive/docker availability

### Image Management
- `GET /api/images/local` - List local images
- `POST /api/images/pull` - Pull an image
- `DELETE /api/images/<name>` - Remove local image

## 🎯 Next Steps

1. **Customize the UI:** Modify components in `frontend/src/components/`
2. **Add features:** Extend API routes in `backend/routes/`
3. **Deploy:** Use the Docker setup for production deployment
4. **Monitor:** Add logging and monitoring as needed

For detailed development information, see the main README.md file.
