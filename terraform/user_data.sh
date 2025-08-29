#!/bin/bash
set -e

# Basic setup logging
exec > >(tee /var/log/user-data.log) 2>&1
echo "Starting Dive Inspector setup at $(date)"

# Update system
apt-get update -y
apt-get upgrade -y

# Install Docker
apt-get install -y ca-certificates curl gnupg lsb-release
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Start Docker
systemctl start docker
systemctl enable docker
usermod -aG docker ubuntu

# Install dive tool
curl -fsSL "https://github.com/wagoodman/dive/releases/download/v0.12.0/dive_0.12.0_linux_amd64.tar.gz" -o dive.tar.gz
tar -xzf dive.tar.gz
mv dive /usr/local/bin/
chmod +x /usr/local/bin/dive
rm dive.tar.gz

# Install Nginx
apt-get install -y nginx

# Create basic nginx config
cat > /etc/nginx/sites-available/dive-inspector << 'EOF'
server {
    listen 80;
    server_name ${domain_name};

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /api/ {
        proxy_pass http://localhost:3000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

# Enable the site
ln -sf /etc/nginx/sites-available/dive-inspector /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t

# Create app directory
mkdir -p /opt/dive-inspector
cd /opt/dive-inspector

# Clone the repository
apt-get install -y git
git clone https://github.com/aurablacklight/docker-dive-web-ui.git .

# Create production environment
cat > .env << 'EOF'
NODE_ENV=production
PORT=3000
FRONTEND_PORT=3001
DOMAIN_NAME=${domain_name}
EOF

# Build and start the application
docker compose up -d

# Start nginx
systemctl start nginx
systemctl enable nginx

# Configure UFW firewall for Cloudflare-only access
ufw --force enable
ufw default deny incoming
ufw default allow outgoing

# Allow SSH from anywhere (for SSM access)
ufw allow ssh

# Allow HTTP/HTTPS only from Cloudflare IP ranges
CLOUDFLARE_IPS=(
    "173.245.48.0/20"
    "103.21.244.0/22"
    "103.22.200.0/22"
    "103.31.4.0/22"
    "141.101.64.0/18"
    "108.162.192.0/18"
    "190.93.240.0/20"
    "188.114.96.0/20"
    "197.234.240.0/22"
    "198.41.128.0/17"
    "162.158.0.0/15"
    "104.16.0.0/13"
    "104.24.0.0/14"
    "172.64.0.0/13"
    "131.0.72.0/22"
)

# Add rules for each Cloudflare IP range
for ip in "$${CLOUDFLARE_IPS[@]}"; do
    ufw allow from $$ip to any port 80
    ufw allow from $$ip to any port 443
done

echo "UFW configured to allow HTTP/HTTPS only from Cloudflare IPs"

echo "Setup completed at $(date)"
echo "Application should be available at: https://${domain_name}"
