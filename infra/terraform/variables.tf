# ── Input variables — SocietyOS dev/staging stack ───────────────────────────
# Sensible defaults are set here; override in terraform.tfvars if needed.

variable "aws_region" {
  description = "AWS region — Mumbai."
  type        = string
  default     = "ap-south-1"
}

variable "aws_profile" {
  description = "Local AWS CLI profile Terraform authenticates with (the Marzi account)."
  type        = string
  default     = "marzi"
}

variable "environment" {
  description = "Environment name — drives every resource name and the Environment tag."
  type        = string
  default     = "dev"
}

variable "api_domain" {
  description = "Public hostname for the backend API."
  type        = string
  default     = "society-dev.marzitech.in"
}

variable "admin_domain" {
  description = "Public hostname for the admin web app (Amplify)."
  type        = string
  default     = "society-admin-dev.marzitech.in"
}

variable "route53_zone_name" {
  description = "Existing Route 53 hosted zone the subdomains live under."
  type        = string
  default     = "marzitech.in"
}

variable "lightsail_blueprint_id" {
  description = "OS image for the Lightsail instance."
  type        = string
  default     = "ubuntu_22_04"
}

variable "lightsail_bundle_id" {
  description = <<-EOT
    Lightsail instance size (ap-south-1 bundle IDs):
      small_3_1  = 2 GB RAM / 2 vCPU  (~$12/mo) — recommended (backend + Redis + Caddy)
      micro_3_1  = 1 GB RAM / 2 vCPU  (~$7/mo)  — tight, only if cost is critical
  EOT
  type        = string
  default     = "small_3_1"
}

variable "rds_endpoint" {
  description = "Existing marzi-community-db endpoint (the shared instance that hosts the societyos_dev database)."
  type        = string
  default     = "marzi-community-db.cdk0iqyk2cg4.ap-south-1.rds.amazonaws.com"
}

variable "marzi_tenant_name" {
  description = "White-label tenant name on the external Marzi auth backend (dev.marzitech.in)."
  type        = string
  default     = "Marzi"
}

# ── Amplify (admin web) ─────────────────────────────────────────────────────

variable "github_repo_url" {
  description = "GitHub repository Amplify builds the admin web app from."
  type        = string
  default     = "https://github.com/marzilifetech/societyOs"
}

variable "github_access_token" {
  description = "GitHub token for Amplify to connect the repo — set in terraform.tfvars."
  type        = string
  sensitive   = true
}

variable "amplify_branch" {
  description = "Branch Amplify auto-deploys for the admin web app."
  type        = string
  default     = "main"
}

variable "society_id" {
  description = "Seeded society UUID — exposed to the admin web build."
  type        = string
  default     = "a1b2c3d4-e5f6-4789-abcd-ef0123456789"
}
