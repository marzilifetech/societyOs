# ── Existing resources this stack REFERENCES but does not own ───────────────
# Data sources are read-only lookups — `terraform destroy` never touches them.

# The existing Route 53 hosted zone for marzitech.in — we only add records.
data "aws_route53_zone" "main" {
  name         = var.route53_zone_name
  private_zone = false
}

# The S3 uploads bucket (created earlier via CLI). Referenced read-only so a
# `terraform destroy` can never delete it — or the uploads inside it.
data "aws_s3_bucket" "uploads" {
  bucket = "societyos-${var.environment}-uploads"
}
