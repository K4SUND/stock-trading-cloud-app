# production.tfvars — values for the production cluster
# Usage: terraform apply -var-file="production.tfvars"

aws_region         = "ap-south-1"
cluster_name       = "stock-trading-production"
node_count         = 3
node_instance_type = "t3.large"   # larger nodes for production load

tags = {
  Project     = "stock-trading"
  Environment = "production"
  ManagedBy   = "terraform"
}