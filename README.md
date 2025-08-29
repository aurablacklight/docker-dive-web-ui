# Docker Dive Web UI

A modern, containerized web interface for analyzing Docker images using the [dive](https://github.com/wagoodman/dive) tool. Features a beautiful glassmorphism design, real-time Docker image analysis, and fully automated CI/CD deployment.

## ✅ Latest Updates

**🔧 Jest Testing Fixed + Simplified Architecture** - Single production environment with Jest support!

## Features

- 🔍 **Docker Image Analysis**: Analyze any Docker image for layer efficiency and waste detection
- 🔍 **Docker Hub Search**: Search and discover Docker images directly from Docker Hub
- 📊 **Real-time Metrics**: Live efficiency scoring, wasted space analysis, and layer breakdown
- 🎨 **Modern UI**: Beautiful glassmorphism design with responsive layout and smooth animations
- 🐳 **Fully Containerized**: Multi-container architecture with Docker Compose
- ⚡ **WebSocket Updates**: Real-time progress tracking during analysis
- 🔬 **Layer-by-Layer**: Detailed breakdown of each Docker layer with file counts and sizes
- 📈 **Efficiency Insights**: Actionable recommendations for image optimization
- 🎯 **Interactive Commands**: Expandable/collapsible Docker layer commands with syntax highlighting
- ☁️ **Kubernetes Ready**: Complete Helm chart for Kubernetes deployment with AWS EKS optimizations
- 🔧 **Enhanced UX**: Intelligent error handling with graceful fallbacks
- 🚀 **CI/CD Automation**: Complete GitHub Actions workflows with automated deployment
- 🏥 **Health Monitoring**: Available (currently disabled while application matures)
- 🔒 **Security Scanning**: Available (currently disabled for GitHub free tier compatibility)

## Architecture

- **Frontend**: React 18 with custom CSS glassmorphism design and interactive layer breakdown (Port 3001)
- **Backend**: Node.js/Express API server with Socket.IO and Docker Hub integration (Port 3000)  
- **Analysis Engine**: Integrated dive binary with Docker CLI access and enhanced error handling
- **Search Engine**: Docker Hub API integration for image discovery and metadata retrieval
- **Deployment**: Multi-container setup with nginx reverse proxy and health monitoring
- **Networking**: Docker Compose with bridge networking and comprehensive health checks
- **Kubernetes**: Production-ready Helm chart with AWS EKS 1.30 compatibility and auto-scaling

## Deployment Options

### 🚀 **Option 1: Local Development (Docker Compose)**

#### Quick Start (Optimized Build)
```bash
# Clone the repository
git clone https://github.com/aurablacklight/docker-dive-web-ui.git
cd docker-dive-web-ui

# Option A: Fast Parallel Build (Recommended)
docker buildx bake

# Option B: Smart Build Script (Auto-detects best method)
./build.sh

# Option C: Standard Docker Compose
docker-compose up -d

# Access the web interface
open http://localhost:3001
```

#### ⚡ **New: Optimized Build System**

This project now features **13x faster Docker builds** with advanced optimization:

- **Docker Bake**: Parallel builds with BuildKit optimization
- **Smart Caching**: Intelligent layer caching for dependencies  
- **No Privilege Prompts**: Automated environment configuration
- **Development Optimized**: Lightning-fast rebuilds when code changes

**Build Performance:**
- **First build**: ~23 seconds (full)
- **Incremental builds**: ~1.5 seconds (with cache)
- **Code-only changes**: ~6 seconds (optimized layers)

**Available Build Commands:**
```bash
# Fastest: Parallel build with advanced caching
docker buildx bake

# Smart: Auto-detects best build method
./build.sh

# Standard: Traditional compose build
docker-compose build

# Development: Quick restart after code changes
docker-compose restart
```

**Setup for Local Development:**
```bash
# One-time setup for optimized builds
./setup-docker-local.sh

# Your environment is now configured for fast builds!
```

### 🚀 **Option 2: Automated CI/CD Deployment (100% FREE!)**

This project includes complete GitHub Actions workflows for fully automated deployment at **zero cost**:

#### **💰 FREE Tier Breakdown:**
- ✅ **GitHub Repository Secrets**: FREE forever (unlimited)
- ✅ **GitHub Actions**: 2,000 minutes/month (FREE for private repos)
- ✅ **Our Usage**: ~400 minutes/month (well within limits!)
- ✅ **Public Repos**: Unlimited GitHub Actions minutes
- ✅ **Total Cost**: $0/month 🎉

#### **CI/CD Features:**
- ✅ **Automated Builds**: Leverages optimized Docker Bake for 13x faster builds
- ✅ **Complete Testing**: 7/7 Jest tests passing with full API coverage
- ✅ **Smart Deployment**: Only deploys on main branch changes
- ✅ **Rollback Protection**: Automatic rollback on deployment failures
- 🔄 **Health Monitoring**: Available (disabled while app matures)
- 🔄 **Security Scanning**: Available (disabled for GitHub free tier optimization)

#### **Active Workflows:**
1. **Main CI/CD** (`.github/workflows/ci-cd.yml`): Build, test, and deploy on main branch
2. **Manual Deploy** (`.github/workflows/manual-deploy.yml`): On-demand deployment

#### **Available Workflows** (currently disabled):
3. **Health Monitor** (`.github/workflows/health-monitor.yml.disabled`): Every 2 hours monitoring
4. **Security Scan** (`.github/workflows/security-scan.yml.disabled`): Monthly vulnerability scanning

#### **Quick Setup:**
```bash
# 1. Configure GitHub Secrets (one-time setup - FREE!)
# See .github/SECRETS-SETUP.md for detailed instructions

# 2. Push to main branch for automatic deployment
git push origin main

# 3. Monitor deployment in GitHub Actions tab
# 4. Your app auto-deploys to production!
```

#### **Manual Deployment Options:**
- Go to GitHub → Actions → "Manual Deploy" → Run workflow
- Force rebuild option for troubleshooting
- Skip tests for emergency deployments

#### **Monitoring & Alerts:**
- **Health Checks**: Every 2 hours with auto-restart
- **Security Scans**: Monthly with issue creation for vulnerabilities  
- **Deployment Status**: Real-time feedback in GitHub Actions
- **Auto-Recovery**: Service restart on health check failures

### ☁️ **Option 3: Production Infrastructure (Terraform + AWS + Cloudflare)**

Deploy a complete production-ready infrastructure with SSL, DDoS protection, and global CDN:

```bash
# Prerequisites
# - AWS CLI configured with appropriate permissions
# - Terraform >= 1.0 installed
# - Cloudflare account with API token

cd terraform

# Configure your deployment
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your domain and settings

# Deploy infrastructure
terraform init
terraform plan
terraform apply

# Your application will be available at:
# https://your-subdomain.your-domain.com
```

**What this creates:**
- ✅ **AWS EC2 instance** (t3.micro - free tier eligible) with **optimized Docker builds**
- ✅ **Complete VPC setup** with subnets, security groups, IAM roles
- ✅ **Cloudflare integration** with DNS, SSL certificates, and DDoS protection
- ✅ **Automated deployment** with optimized Docker builds and reverse proxy
- ✅ **Production security** with HTTPS, origin certificates, and firewall rules
- ✅ **Cost optimized** for AWS free tier usage
- ✅ **13x faster builds** automatically configured on deployment

See [`terraform/README.md`](terraform/README.md) for detailed deployment instructions.

### 🎛️ **Option 3: Kubernetes Production (Helm)**

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

### 🔧 **Optimized Development Workflow**

#### One-Time Setup
```bash
# Configure your environment for fast builds
./setup-docker-local.sh

# Environment variables are now configured:
# - BUILDX_BAKE_ENTITLEMENTS_FS=0 (no privilege prompts)
# - DOCKER_BUILDKIT=1 (enhanced build performance)
# - COMPOSE_DOCKER_CLI_BUILD=1 (better compose integration)
```

#### Fast Development Cycle
```bash
# Make code changes, then rebuild quickly:
docker buildx bake          # ~1.5s with cache
# OR
./build.sh                  # Auto-detects best method

# Start services
docker-compose up -d

# View logs
docker-compose logs -f backend
```

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
# Build and start with optimized builds
docker buildx bake && docker-compose up -d

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Restart specific service after code changes
docker-compose restart backend

# Stop all services
docker-compose down
```

### 📊 **Build Performance Comparison**

| Method | First Build | Incremental | Code Changes Only |
|--------|-------------|-------------|-------------------|
| `docker buildx bake` | 23s | **1.5s** | **6s** |
| `./build.sh` | 25s | **2s** | **7s** |
| `docker-compose build` | 45s | 30s | 25s |

**Recommendation**: Use `docker buildx bake` for development, `./build.sh` for CI/CD.

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

### CI/CD Troubleshooting

#### Common GitHub Actions Issues:

**❌ "No EC2 instance found" error:**
```bash
# Verify your EC2 instance has the correct tag
aws ec2 describe-instances --filters "Name=tag:Name,Values=dive-inspector"

# If missing, add the tag to your instance
aws ec2 create-tags --resources i-1234567890abcdef0 --tags Key=Name,Value=dive-inspector
```

**❌ "AccessDenied" for SSM commands:**
```bash
# Check if your GitHub Actions IAM user has correct permissions
aws iam list-attached-user-policies --user-name github-actions-dive-inspector

# Verify EC2 instance has SSM role attached
aws ec2 describe-instances --instance-ids i-1234567890abcdef0 --query 'Reservations[0].Instances[0].IamInstanceProfile'
```

**❌ Health checks failing after deployment:**
```bash
# SSH to your EC2 instance and check service status
sudo docker-compose ps
sudo docker-compose logs backend

# Restart services if needed
sudo docker-compose restart
```

**❌ Manual deployment workflow not working:**
- Verify AWS credentials are correctly set in GitHub repository secrets
- Check that EC2 instance is running and accessible
- Confirm SSM agent is running: `sudo systemctl status amazon-ssm-agent`

#### Monitoring Deployment Status:
1. **GitHub Actions**: Check the Actions tab for real-time deployment status
2. **Health Endpoint**: Monitor https://your-domain.com/api/health
3. **EC2 Logs**: SSH to instance and check: `sudo journalctl -u docker -f`

### Performance Tips

- **Image analysis**: Larger images (>1GB) may take 2-3 minutes to analyze
- **Search results**: Limit search results to 25-50 for optimal performance  
- **Browser memory**: For very large images, consider refreshing the page after analysis
- **Kubernetes**: Use resource limits in production deployments
- **CI/CD Builds**: Incremental builds complete in ~1.5s with optimized caching

### Viewing Logs

```bash
# Local development logs
docker-compose logs

# Backend only
docker-compose logs backend

# Follow logs
docker-compose logs -f backend

# Production logs (via SSH to EC2)
sudo docker-compose logs --tail=50 backend
sudo journalctl -u docker -f
```

## TODO / Upcoming Features

### 🎯 **Planned Enhancements**

#### Search & UI Improvements
- [ ] **Clear Search Functionality**: Add clear button near search bar to reset search results and input
- [ ] **Search History**: Remember recent searches for quick access

#### Settings & Configuration  
- [ ] **Docker Registry Settings**: UI-based configuration for custom Docker registries
- [ ] **Secure Authentication**: Safe handling of Docker registry credentials (username + access token)
- [ ] **Registry Switching**: Support for multiple Docker registries (Docker Hub, ECR, GCR, etc.)
- [ ] **Persistent Settings**: Save user preferences and configurations

#### Advanced Features
- [ ] **Image Comparison**: Side-by-side comparison of different image versions
- [ ] **Export Reports**: Generate PDF/JSON reports of image analysis
- [ ] **Custom Tags**: User-defined tags and notes for analyzed images
- [ ] **Team Collaboration**: Share analysis results with team members

#### Performance & Monitoring
- [ ] **Analysis History**: Track and review previously analyzed images
- [ ] **Batch Analysis**: Analyze multiple images simultaneously
- [ ] **Performance Metrics**: Detailed timing and resource usage analytics
- [ ] **Notification System**: Email/Slack notifications for completed analyses

### 💡 **Feature Requests Welcome**
Have an idea? [Open an issue](https://github.com/aurablacklight/docker-dive-web-ui/issues) on GitHub!

## 📚 **Documentation**

### Core Documentation
- **[Main README](README.md)** - Project overview and quick start
- **[Backend README](backend/README.md)** - API documentation and backend setup
- **[Terraform README](terraform/README.md)** - Production deployment guide

### Build & Development
- **[Docker Build Optimization](DOCKER-BUILD-OPTIMIZATION.md)** - Comprehensive build optimization guide
- **[Docker BuildKit Integration](DOCKER-BUILDKIT-INTEGRATION.md)** - Terraform integration details
- **[Workspace Cleanup](WORKSPACE-CLEANUP.md)** - Recent cleanup summary

### Deployment Guides
- **[Kubernetes README](helm/docker-dive-web-ui/README.md)** - Helm chart documentation
- **[AWS Deployment](deploy/AWS-DEPLOYMENT.md)** - AWS deployment options
- **[EKS Compatibility](helm/KUBERNETES-1.30-EKS-COMPATIBILITY.md)** - Kubernetes deployment guide

### Quick Reference
- **Fast builds**: `docker buildx bake` (1.5s incremental)
- **Smart builds**: `./build.sh` (auto-detects best method)
- **Setup**: `./setup-docker-local.sh` (one-time configuration)
- **Performance**: 13x faster builds with BuildKit optimization
# CI/CD Test
This line was added to test the CI/CD pipeline.
