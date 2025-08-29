#!/bin/bash
# AWS EC2 Docker Dive Web UI Deployment Script
# Run this on a fresh Amazon Linux 2 EC2 instance

set -e

echo "🚀 Setting up Docker Dive Web UI on AWS EC2..."

# Update system
echo "📦 Updating system packages..."
sudo yum update -y

# Install Docker
echo "🐳 Installing Docker..."
sudo yum install docker -y
sudo service docker start
sudo usermod -a -G docker ec2-user

# Install Docker Compose
echo "🔧 Installing Docker Compose..."
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install Git
echo "📥 Installing Git..."
sudo yum install git -y

# Clone repository
echo "📁 Cloning Docker Dive Web UI repository..."
cd /home/ec2-user
git clone https://github.com/aurablacklight/docker-dive-web-ui.git
cd docker-dive-web-ui

# Start services
echo "🎯 Starting Docker Dive Web UI services..."
docker-compose up -d

# Setup auto-start on boot
echo "🔄 Setting up auto-start on boot..."
sudo systemctl enable docker

# Create systemd service for docker-compose
sudo tee /etc/systemd/system/docker-dive-ui.service > /dev/null <<EOF
[Unit]
Description=Docker Dive Web UI
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/ec2-user/docker-dive-web-ui
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable docker-dive-ui.service

# Get public IP
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🌐 Your Docker Dive Web UI is accessible at:"
echo "   Frontend: http://$PUBLIC_IP:3001"
echo "   Backend API: http://$PUBLIC_IP:3000"
echo ""
echo "🔧 Management commands:"
echo "   View logs: docker-compose logs -f"
echo "   Restart: docker-compose restart"
echo "   Stop: docker-compose down"
echo "   Update: git pull && docker-compose up -d --build"
echo ""
echo "🛡️ Security Note: Configure security groups to allow:"
echo "   - Port 3001 (Frontend) from 0.0.0.0/0"
echo "   - Port 3000 (Backend API) from 0.0.0.0/0"
