# Dive Inspector - Secure Terraform Deployment

This directory contains a complete, production-ready Terraform configuration for deploying the Dive Inspector application with enterprise-grade security, all within AWS free tier limits.

## 🏗️ Architecture

```
Internet → Cloudflare (WAF/DDoS/SSL) → AWS EC2 → Nginx → Docker Compose
```

## 🛡️ Security Features

### Multi-Layer Protection
- **Cloudflare**: DDoS protection, WAF, SSL termination, rate limiting
- **AWS Security Groups**: Restrict access to Cloudflare IPs only
- **Nginx**: Additional rate limiting, security headers, request filtering
- **Fail2ban**: SSH brute force protection
- **UFW Firewall**: Host-level traffic filtering

### Security Headers
- Strict Transport Security (HSTS)
- Content Security Policy (CSP)
- X-Frame-Options (Clickjacking protection)
- X-Content-Type-Options (MIME sniffing protection)
- X-XSS-Protection

## 💰 Cost Breakdown (FREE!)

| Resource | Free Tier Limit | Usage | Cost |
|----------|----------------|-------|------|
| EC2 t3.micro | 750 hours/month | 24/7 | $0.00 |
| EBS Storage | 30GB | 25GB | $0.00 |
| VPC & Networking | Unlimited | All traffic | $0.00 |
| Data Transfer Out | 1GB/month | Normal usage | $0.00 |
| **Total** | | | **$0.00/month** |

## 🚀 Quick Start

### Prerequisites

1. **AWS Account** with free tier
2. **Cloudflare Account** (free) with your domain
3. **Terraform** installed locally
4. **AWS CLI** configured

### 1. Verify AWS CLI Access

```bash
# Verify AWS credentials are configured
aws sts get-caller-identity

# Ensure you have the required permissions:
# - EC2: Full access
# - IAM: Create roles and policies  
# - SSM: For secure server access (no SSH keys needed)
```

### 2. Get Cloudflare API Token

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens)
2. Create Token → Custom Token
3. Permissions:
   - Zone:Zone Settings:Edit
   - Zone:Zone:Read
   - Zone:DNS:Edit
4. Zone Resources: Include → Specific zone → yourdomain.com

### 3. Configure Variables

```bash
# Copy example configuration
cp terraform.tfvars.example terraform.tfvars

# Edit with your values
nano terraform.tfvars
```

Required values:
```hcl
cloudflare_api_token = "your-token-here"
domain_name = "yourdomain.com"
# Note: No SSH key needed - uses SSM for secure access
```

### 4. Deploy Infrastructure

```bash
# Initialize Terraform
terraform init

# Plan deployment
terraform plan

# Deploy (takes ~5-10 minutes)
terraform apply
```

### 5. Verify Deployment

```bash
# Get outputs
terraform output

# Test application
curl -k https://dive.yourdomain.com/api/health

# Access server via SSM (no SSH keys needed)
aws ssm start-session --target $(terraform output -raw instance_id) --region us-east-1
```

## 📁 File Structure

```
terraform/
├── main.tf                    # Main infrastructure configuration
├── variables.tf               # Variable definitions
├── terraform.tfvars.example  # Example configuration
├── user_data.sh              # Server setup script
├── nginx.conf.tpl            # Nginx configuration template
├── docker-compose.prod.yml   # Production Docker Compose
└── README.md                 # This file
```

## 🔧 Configuration Details

### Security Groups
- **Port 80/443**: Cloudflare IPs only
- **Port 22**: Disabled (uses SSM for secure access)
- **All outbound**: Allowed for updates and Docker

### Nginx Configuration
- Rate limiting: 10 req/s for API, 30 req/s general
- Security headers: HSTS, CSP, XSS protection
- Real IP detection from Cloudflare
- WebSocket support for real-time updates

### Cloudflare Settings
- **SSL Mode**: Strict (end-to-end encryption)
- **Security Level**: Medium
- **Rate Limiting**: 100 requests/minute per IP
- **Caching**: Optimized for static assets
- **Minification**: CSS, JS, HTML

## 🔄 Management Commands

### Update Application
```bash
# Access server via SSM
aws ssm start-session --target $(terraform output -raw instance_id) --region us-east-1

# Update containers
cd /opt/dive-inspector
sudo docker compose pull
sudo docker compose up -d
```

### View Logs
```bash
# Application logs
sudo docker compose logs -f

# System logs
sudo tail -f /var/log/user-data.log

# Nginx logs
sudo tail -f /var/log/nginx/dive-inspector-access.log
```

### Scale Resources (if needed)
```bash
# Edit terraform.tfvars
instance_type = "t3.small"  # Still free tier eligible
root_volume_size = 30       # Maximum free tier

# Apply changes
terraform apply
```

## 🚨 Security Best Practices

### Server Access
```bash
# Secure access via AWS SSM (no SSH keys needed)
aws ssm start-session --target INSTANCE_ID --region us-east-1

# No SSH access required - SSM provides encrypted sessions
# UFW firewall configured with Cloudflare IP allowlisting
```

### SSL/TLS
- Cloudflare provides free SSL certificates
- Automatic HTTP → HTTPS redirects
- HSTS headers enforce HTTPS
- TLS 1.3 enabled for best security

### Monitoring
```bash
# Check system status
sudo /opt/dive-inspector/monitor.sh

# View security logs
sudo fail2ban-client status sshd
```

## 🆘 Troubleshooting

### Application Not Accessible
1. Check security group allows Cloudflare IPs
2. Verify DNS propagation: `dig dive.yourdomain.com`
3. Check containers: `sudo docker compose ps`
4. Review logs: `sudo docker compose logs`

### SSL Certificate Issues
1. Verify Cloudflare proxy is enabled (orange cloud)
2. Check SSL mode is "Strict" in Cloudflare
3. Ensure origin server has valid certificate

### High CPU/Memory Usage
1. Monitor with: `htop`
2. Check Docker stats: `sudo docker stats`
3. Scale to larger instance if needed (still free tier)

## 🔄 Cleanup

To completely remove all resources:

```bash
# Destroy infrastructure
terraform destroy

# Remove local files
rm -rf .terraform*
rm terraform.tfstate*
```

## 📞 Support

- **Issues**: Check CloudWatch logs (if enabled)
- **Security**: Monitor fail2ban logs
- **Performance**: Use CloudWatch metrics (basic free tier)

---

**🎉 Congratulations!** You now have a production-ready, highly secure Docker image analysis tool running on AWS free tier with enterprise-grade security via Cloudflare!
