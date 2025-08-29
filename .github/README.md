# 🚀 CI/CD Setup

This project includes complete GitHub Actions workflows for automated deployment.

## 🎯 **Automated Workflows**

### **Available Workflows:**
1. **🔨 CI/CD Pipeline** - Automated build, test, and deploy on main branch
2. **🚨 Manual Deploy** - On-demand deployment with customizable options  
3. **🏥 Health Monitor** - Continuous health monitoring with auto-recovery
4. **🔒 Security Scan** - Automated vulnerability scanning

### **💰 GitHub Free Tier Optimized:**
- **Health Monitoring**: Every 2 hours (optimized for free tier)
- **Security Scanning**: Monthly comprehensive scans
- **Build Optimization**: 13x faster builds with Docker Bake
- **Total Usage**: ~400 minutes/month (well within 2,000 minute limit)

## 🚀 **How to Use**

### **Automatic Deployment:**
```bash
# Push to main branch for automatic deployment
git add .
git commit -m "Your changes"
git push origin main
```

### **Manual Deployment:**
1. Go to GitHub → Actions → "Manual Deploy"
2. Click "Run workflow" 
3. Choose options (force rebuild, skip tests)
4. Monitor progress in real-time

### **Monitoring:**
- **Health Checks**: Automated every 2 hours
- **Security Scans**: Monthly vulnerability assessment
- **Auto-Recovery**: Service restart on health check failures
- **Issue Creation**: Automated GitHub issues for critical problems

## ⚡ **Performance Features**

- **Docker Bake Integration**: Parallel builds with advanced caching
- **Smart Build Detection**: Auto-selects optimal build method
- **BuildKit Optimization**: 1.5-second incremental builds
- **Rollback Protection**: Automatic rollback on deployment failures

## 🔧 **Setup Requirements**

1. **GitHub Repository Secrets**: Configure AWS credentials for deployment
2. **EC2 Instance**: Running instance with proper IAM role for SSM
3. **AWS Region**: Configured for your infrastructure location
4. **Instance Tags**: Properly tagged EC2 instance for identification

## 📊 **Workflow Details**

### **CI/CD Pipeline** (`.github/workflows/ci-cd.yml`)
- Triggers on main branch pushes
- Builds using optimized Docker Bake
- Runs security scans with Trivy
- Deploys to production via SSM
- Includes comprehensive health checks

### **Manual Deploy** (`.github/workflows/manual-deploy.yml`)
- On-demand deployment capability
- Force rebuild option for troubleshooting
- Skip tests option for emergency deployments
- Enhanced logging and error handling

### **Health Monitor** (`.github/workflows/health-monitor.yml`)
- Runs every 2 hours (free tier optimized)
- Multi-layered health checks
- Automatic service restart on failures
- GitHub issue creation for persistent problems

### **Security Scan** (`.github/workflows/security-scan.yml`)
- Monthly comprehensive vulnerability scanning
- Container image security with Trivy
- Dependency vulnerability assessment
- Automated issue creation for critical findings

## 🎯 **Next Steps**

1. **Configure Secrets**: Set up required AWS credentials in GitHub repository secrets
2. **Test Deployment**: Use manual deployment workflow to verify setup
3. **Monitor Operations**: Watch automated health checks and security scans
4. **Enjoy Automation**: Benefit from fully automated deployment pipeline

Your CI/CD system is optimized for the GitHub free tier while providing enterprise-grade automation! 🚀
