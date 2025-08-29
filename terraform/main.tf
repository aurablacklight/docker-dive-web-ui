# =============================================================================
# DOCKER DIVE WEB UI - SECURE FREE TIER DEPLOYMENT
# Complete Terraform setup with Cloudflare security
# =============================================================================

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
  }
}

# =============================================================================
# PROVIDERS
# =============================================================================

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Project     = "dive-inspector"
      Environment = var.environment
      ManagedBy   = "terraform"
      Owner       = var.owner
    }
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

# =============================================================================
# DATA SOURCES  
# =============================================================================

# Get latest Ubuntu AMI
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }

  filter {
    name   = "state"
    values = ["available"]
  }
  
  filter {
    name   = "state"
    values = ["available"]
  }
  
  filter {
    name   = "architecture"
    values = ["x86_64"]
  }
}

# Local values
locals {
  cloudflare_zone_id = "63f7d675a0e478f56835067cfb41b25e"
  subdomain = "${var.subdomain_name}.${var.domain_name}"
}

# =============================================================================
# VPC AND NETWORKING
# =============================================================================

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "${var.project_name}-vpc"
  cidr = var.vpc_cidr

  azs             = var.availability_zones
  public_subnets  = var.public_subnet_cidrs

  create_igw           = true
  enable_dns_hostnames = true
  enable_dns_support   = true

  # Cost optimization - disable NAT gateway (not needed for this setup)
  enable_nat_gateway = false
  enable_vpn_gateway = false

  tags = {
    Name = "${var.project_name}-vpc"
  }
}

# =============================================================================
# SECURITY GROUPS
# =============================================================================

resource "aws_security_group" "dive_inspector" {
  name_prefix = "${var.project_name}-"
  description = "Security group for Dive Inspector application"
  vpc_id      = module.vpc.vpc_id

  # HTTP access from anywhere (Cloudflare will proxy)
  ingress {
    description = "HTTP from anywhere"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTPS access from anywhere (Cloudflare will proxy)
  ingress {
    description = "HTTPS from anywhere"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # SSH access removed - using SSM for secure access
  # ingress {
  #   description = "SSH access"
  #   from_port   = 22
  #   to_port     = 22
  #   protocol    = "tcp"
  #   cidr_blocks = var.allowed_ssh_cidrs
  # }

  # Outbound internet access
  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-sg"
  }
}

# =============================================================================
# IAM ROLE FOR EC2 (for future CloudWatch/SSM access)
# =============================================================================

resource "aws_iam_role" "ec2_role" {
  name = "${var.project_name}-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ssm_managed_instance_core" {
  role       = aws_iam_role.ec2_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "ec2_profile" {
  name = "${var.project_name}-ec2-profile"
  role = aws_iam_role.ec2_role.name
}

# =============================================================================
# EC2 INSTANCE
# =============================================================================

module "ec2_instance" {
  source  = "terraform-aws-modules/ec2-instance/aws"
  version = "~> 5.0"

  name = "${var.project_name}-server"

  # Free tier eligible instance
  instance_type = var.instance_type
  ami           = data.aws_ami.ubuntu.id

  # Networking
  vpc_security_group_ids      = [aws_security_group.dive_inspector.id]
  subnet_id                   = module.vpc.public_subnets[0]
  associate_public_ip_address = true

  # Storage (within free tier limits)
  root_block_device = [
    {
      volume_type = "gp3"
      volume_size = var.root_volume_size
      encrypted   = true
    }
  ]

  # IAM
  iam_instance_profile = aws_iam_instance_profile.ec2_profile.name

  # No SSH key needed - using SSM for access
  # key_name = var.key_pair_name

  # User data script (simplified)
  user_data = base64encode(templatefile("${path.module}/user_data.sh", {
    domain_name = local.subdomain
  }))

  # Volume tags
  volume_tags = {
    Name = "${var.project_name}-root-volume"
  }

  tags = {
    Name = "${var.project_name}-server"
  }
}

# =============================================================================
# CLOUDFLARE CONFIGURATION
# =============================================================================

# =============================================================================
# CLOUDFLARE CONFIGURATION (MINIMAL - DNS ONLY)
# =============================================================================

# DNS A record pointing to EC2 instance
resource "cloudflare_dns_record" "main" {
  zone_id = local.cloudflare_zone_id
  name    = var.subdomain_name
  content = module.ec2_instance.public_ip
  type    = "A"
  ttl     = 1     # Must be 1 when proxied = true (Cloudflare manages TTL)
  proxied = true  # Enable Cloudflare proxy for security and performance
  comment = "Dive Inspector application - managed by Terraform"
}

# =============================================================================
# OUTPUTS
# =============================================================================

# Debug outputs for troubleshooting
output "cloudflare_zone_debug" {
  description = "Debug information about the Cloudflare zone"
  value = {
    zone_id = local.cloudflare_zone_id
    domain_name = var.domain_name
    subdomain = local.subdomain
  }
}

output "instance_public_ip" {
  description = "Public IP address of the EC2 instance"
  value       = module.ec2_instance.public_ip
}

output "instance_public_dns" {
  description = "Public DNS name of the EC2 instance"
  value       = module.ec2_instance.public_dns
}

output "application_url" {
  description = "URL to access the application"
  value       = "https://${local.subdomain}"
}

output "ssh_connection" {
  description = "SSM connection command (more secure than SSH)"
  value       = "aws ssm start-session --target ${module.ec2_instance.id} --region ${var.aws_region}"
}

output "cloudflare_record_id" {
  description = "Cloudflare DNS record ID"
  value       = cloudflare_dns_record.main.id
}
