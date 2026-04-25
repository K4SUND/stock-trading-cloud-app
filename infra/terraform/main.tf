# ═══════════════════════════════════════════════════════════════════════
# main.tf — Stock Trading App Infrastructure on AWS
#
# This file creates everything you need on AWS:
#   • VPC (private network for your cluster)
#   • EKS cluster (managed Kubernetes — AWS handles the control plane)
#   • Node group (EC2 instances that run your pods)
#
# HOW TO USE (run these commands ONCE to set up your cluster):
#   1. Install: Terraform, AWS CLI, kubectl
#   2. Configure AWS: aws configure  (enter your access key + secret)
#   3. cd infra/terraform
#   4. terraform init       (downloads AWS provider)
#   5. terraform plan       (preview what will be created)
#   6. terraform apply      (actually create everything — takes ~15 min)
#   7. terraform output     (see outputs including kubeconfig command)
#
# TO GET YOUR KUBECONFIG (after terraform apply):
#   aws eks update-kubeconfig --name stock-trading-cluster --region ap-south-1
#   cat ~/.kube/config | base64   ← copy this into GitHub Secrets
#
# TO DESTROY EVERYTHING (saves AWS cost):
#   terraform destroy
# ═══════════════════════════════════════════════════════════════════════

terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Optional: store terraform state in S3 so your team shares it
  # Uncomment this after creating the S3 bucket manually:
  # backend "s3" {
  #   bucket = "stock-trading-terraform-state"
  #   key    = "eks/terraform.tfstate"
  #   region = "ap-south-1"
  # }
}

provider "aws" {
  region = var.aws_region
}

# ── Data sources ─────────────────────────────────────────────────────────────
# Get list of availability zones in the chosen region
data "aws_availability_zones" "available" {
  state = "available"
}

# ── VPC (Virtual Private Cloud) ───────────────────────────────────────────────
# This is your private network on AWS. Think of it as your own
# isolated section of the internet. All EC2 nodes live inside this.
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "${var.cluster_name}-vpc"
  cidr = "10.0.0.0/16"   # 65,536 private IP addresses available

  # Use 2 availability zones for high availability
  azs             = slice(data.aws_availability_zones.available.names, 0, 2)
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24"]   # EC2 nodes go here (not internet-facing)
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24"] # Load Balancers go here (internet-facing)

  enable_nat_gateway = true   # lets EC2 nodes pull Docker images from internet
  single_nat_gateway = true   # one NAT gateway saves cost (use false for production HA)

  # These tags are REQUIRED for EKS to know which subnets to use for Load Balancers
  public_subnet_tags = {
    "kubernetes.io/role/elb" = "1"
  }
  private_subnet_tags = {
    "kubernetes.io/role/internal-elb" = "1"
  }

  tags = var.tags
}

# ── EKS Cluster ───────────────────────────────────────────────────────────────
# This is the Kubernetes cluster itself.
# AWS manages the control plane (API server, scheduler, etcd).
# You manage the worker nodes (EC2 instances) via the node group below.
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.0"

  cluster_name    = var.cluster_name
  cluster_version = "1.30"

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets   # nodes run in private subnets

  # Allow kubectl commands from anywhere (restrict this in production)
  cluster_endpoint_public_access = true

  # ── Node Group (EC2 instances that run your pods) ─────────────────────
  # These are the ACTUAL EC2 instances Kubernetes uses.
  # EKS manages them — auto-replaces if one crashes.
  eks_managed_node_groups = {
    main = {
      instance_types = [var.node_instance_type]

      min_size     = 1   # minimum nodes (cluster always has at least 1)
      max_size     = 5   # maximum nodes (auto-scaling can add up to 5)
      desired_size = var.node_count  # start with this many

      # Disk size for each EC2 node (stores Docker images + pod data)
      disk_size = 20   # GB

      labels = {
        role = "worker"
      }
    }
  }

  # Allow pods to assume AWS IAM roles (needed for Load Balancer controller)
  enable_irsa = true

  tags = var.tags
}

# ── Output the command to get kubeconfig ─────────────────────────────────────
output "kubeconfig_command" {
  description = "Run this after terraform apply to configure kubectl on your machine"
  value       = "aws eks update-kubeconfig --name ${var.cluster_name} --region ${var.aws_region}"
}

output "cluster_name" {
  value = module.eks.cluster_name
}

output "cluster_endpoint" {
  value = module.eks.cluster_endpoint
}

output "node_group_role_arn" {
  value = module.eks.eks_managed_node_groups["main"].iam_role_arn
}