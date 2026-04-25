# staging.tfvars — values for the staging cluster
# Usage: terraform apply -var-file="staging.tfvars"

aws_region         = "ap-south-1"
cluster_name       = "stock-trading-staging"
node_count         = 2
node_instance_type = "t3.medium"

tags = {
  Project     = "stock-trading"
  Environment = "staging"
  ManagedBy   = "terraform"
}