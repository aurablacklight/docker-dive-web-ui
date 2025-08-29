# =============================================================================
# VARIABLES
# =============================================================================

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "owner" {
  description = "Owner of the resources"
  type        = string
  default     = "dive-inspector-team"
}

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "dive-inspector"
}

# =============================================================================
# NETWORKING
# =============================================================================

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "Availability zones"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b"]
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "allowed_ssh_cidrs" {
  description = "CIDR blocks allowed for SSH access"
  type        = list(string)
  default     = ["0.0.0.0/0"] # CHANGE THIS to your IP for security
}

# =============================================================================
# EC2 CONFIGURATION
# =============================================================================

variable "instance_type" {
  description = "EC2 instance type (free tier eligible)"
  type        = string
  default     = "t3.micro"
  
  validation {
    condition = contains([
      "t2.micro", "t3.micro", "t4g.micro"
    ], var.instance_type)
    error_message = "Instance type must be free tier eligible."
  }
}

variable "root_volume_size" {
  description = "Size of root EBS volume in GB (free tier: up to 30GB)"
  type        = number
  default     = 25
  
  validation {
    condition     = var.root_volume_size <= 30
    error_message = "Root volume size cannot exceed 30GB for free tier."
  }
}

variable "key_pair_name" {
  description = "Name of the AWS key pair for SSH access"
  type        = string
  # You'll need to create this in AWS console or via AWS CLI
  # aws ec2 create-key-pair --key-name dive-inspector-key --query 'KeyMaterial' --output text > ~/.ssh/dive-inspector-key.pem
}

# =============================================================================
# CLOUDFLARE CONFIGURATION (MINIMAL PERMISSIONS)
# =============================================================================

variable "cloudflare_api_token" {
  description = "Cloudflare API token with Zone:Read and DNS:Edit permissions for the domain"
  type        = string
  sensitive   = true
  default     = "" # Set via TF_VAR_cloudflare_api_token environment variable
}

variable "domain_name" {
  description = "Your domain name managed by Cloudflare (e.g., docker-senpai.dev)"
  type        = string
}

variable "subdomain_name" {
  description = "Subdomain for the application (e.g., 'dive' for dive.docker-senpai.dev)"
  type        = string
  default     = "dive"
}
