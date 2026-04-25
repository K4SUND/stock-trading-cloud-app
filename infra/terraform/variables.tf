# ═══════════════════════════════════════════════════════════════════════
# variables.tf — Configurable values for your infrastructure
#
# Change these to match your setup:
#   • aws_region      → nearest AWS region to you
#   • cluster_name    → name for your EKS cluster
#   • node_count      → how many EC2 instances (nodes)
#   • node_instance_type → size of each EC2 (bigger = more pods fit)
# ═══════════════════════════════════════════════════════════════════════

variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "ap-south-1"   # Mumbai — change to your nearest region
  # Other options: us-east-1 (N. Virginia), eu-west-1 (Ireland),
  #                ap-southeast-1 (Singapore)
}

variable "cluster_name" {
  description = "Name of the EKS cluster"
  type        = string
  default     = "stock-trading-cluster"
}

variable "node_count" {
  description = "Number of EC2 worker nodes"
  type        = number
  default     = 2   # 2 nodes can run all your services comfortably
                    # For a semester project 2 is enough
                    # Production would be 3+
}

variable "node_instance_type" {
  description = "EC2 instance type for worker nodes"
  type        = string
  default     = "t3.medium"
  # t3.medium  = 2 CPU, 4GB RAM  (~$0.042/hour per node)
  # t3.large   = 2 CPU, 8GB RAM  (~$0.083/hour per node)
  # t3.xlarge  = 4 CPU, 16GB RAM (~$0.166/hour per node)
  # For a semester project: t3.medium is enough
  # REMEMBER: destroy the cluster when not using it to save cost!
}

variable "tags" {
  description = "Tags applied to all AWS resources"
  type        = map(string)
  default = {
    Project     = "stock-trading"
    Environment = "demo"
    ManagedBy   = "terraform"
  }
}