# AWS EC2 Deployment Guide for Docker Dive Web UI

## Overview
Deploy Docker Dive Web UI to AWS EC2 using free tier resources with full Docker functionality.

## Prerequisites
- AWS Account with free tier credits
- Basic AWS console familiarity
- SSH key pair for EC2 access

## Step-by-Step Deployment

### 1. Launch EC2 Instance

#### Instance Configuration:
- **AMI**: Amazon Linux 2 AMI (HVM) - SSD Volume Type
- **Instance Type**: `t3.micro` (free tier eligible) or `t3.small` (recommended for better performance)
- **Storage**: 8GB GP2 (free tier includes 30GB)
- **Key Pair**: Create or use existing SSH key pair

#### Security Group Settings:
```
Type            Port    Source          Description
SSH             22      Your IP         SSH access
Custom TCP      3001    0.0.0.0/0       Frontend access  
Custom TCP      3000    0.0.0.0/0       Backend API access
```

### 2. Connect and Deploy

#### Option A: Automated Setup
```bash
# SSH into your instance
ssh -i your-key.pem ec2-user@your-ec2-public-ip

# Download and run setup script
curl -o setup.sh https://raw.githubusercontent.com/aurablacklight/docker-dive-web-ui/main/deploy/aws-ec2-setup.sh
chmod +x setup.sh
./setup.sh
```

#### Option B: Manual Setup
```bash
# SSH into instance
ssh -i your-key.pem ec2-user@your-ec2-public-ip

# Update system and install Docker
sudo yum update -y
sudo yum install docker git -y
sudo service docker start
sudo usermod -a -G docker ec2-user

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Log out and back in for group membership
exit
ssh -i your-key.pem ec2-user@your-ec2-public-ip

# Clone and start application
git clone https://github.com/aurablacklight/docker-dive-web-ui.git
cd docker-dive-web-ui
docker-compose up -d
```

### 3. Access Your Application

After deployment completes:
- **Frontend**: `http://YOUR-EC2-PUBLIC-IP:3001`
- **Backend API**: `http://YOUR-EC2-PUBLIC-IP:3000`

## Cost Breakdown (Monthly)

### Free Tier Option:
- **t3.micro**: $0 (750 hours/month free)
- **Storage**: $0 (30GB EBS free)
- **Data Transfer**: $0 (15GB outbound free)
- **Total**: **$0/month** ✨

### Recommended Option:
- **t3.small**: ~$15/month (better performance)
- **Storage**: $0.80 (8GB EBS)
- **Data Transfer**: $0 (within free limits)
- **Total**: **~$16/month**

## Management Commands

```bash
# View application logs
docker-compose logs -f

# Restart services
docker-compose restart

# Stop application
docker-compose down

# Update application
git pull
docker-compose up -d --build

# Monitor system resources
htop
docker stats
```

## Performance Optimization

### For t3.micro (1GB RAM):
```yaml
# Add to docker-compose.yml
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 512M
        reservations:
          memory: 256M
  frontend:
    deploy:
      resources:
        limits:
          memory: 256M
        reservations:
          memory: 128M
```

### For Better Performance:
- Use `t3.small` (2GB RAM) for $15/month
- Add swap space: `sudo dd if=/dev/zero of=/swapfile bs=1M count=1024 && sudo mkswap /swapfile && sudo swapon /swapfile`

## Security Best Practices

1. **Restrict SSH Access**: Only allow your IP in security group
2. **Use HTTPS**: Set up CloudFront + SSL certificate for production
3. **Regular Updates**: `sudo yum update && docker-compose pull && docker-compose up -d`
4. **Monitoring**: Set up CloudWatch alarms for resource usage

## Troubleshooting

### Common Issues:
1. **Port Access**: Verify security group allows ports 3000/3001
2. **Docker Permission**: Ensure `ec2-user` is in docker group
3. **Memory Issues**: Monitor with `free -h` and add swap if needed
4. **Storage Full**: Clean up with `docker system prune -a`

### View Logs:
```bash
# Application logs
docker-compose logs backend
docker-compose logs frontend

# System logs
sudo journalctl -u docker
sudo journalctl -u docker-dive-ui
```

## Alternative AWS Services

### AWS Lightsail (Simpler but Limited):
- $3.50/month for 512MB instance
- Easier management interface
- Limited Docker socket access (would need app modifications)

### AWS ECS Fargate (More Complex):
- ~$10-20/month
- Fully managed containers
- Requires significant architecture changes for Docker socket access

## Scaling Options

### Load Balancer + Multiple Instances:
- Application Load Balancer (ALB)
- Auto Scaling Group
- RDS for shared state (if needed)

### EKS Migration Path:
- Use existing Helm charts in `/helm` directory
- Migrate when ready for production scale
- EKS costs $0.10/hour for control plane (~$73/month)

## Backup Strategy

```bash
# Backup application data
tar -czf backup-$(date +%Y%m%d).tar.gz docker-dive-web-ui/

# Upload to S3 (optional)
aws s3 cp backup-$(date +%Y%m%d).tar.gz s3://your-backup-bucket/
```
