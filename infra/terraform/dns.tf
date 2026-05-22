# ── DNS — API hostname → the Lightsail static IP ────────────────────────────
# A new record in the existing marzitech.in zone. Nothing existing is changed.
#
# The admin-web hostname (society-admin-dev.marzitech.in) is NOT managed here —
# AWS Amplify creates its own DNS records when the custom domain is added in
# the Amplify console. See infra/README.md.

resource "aws_route53_record" "api" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = var.api_domain
  type    = "A"
  ttl     = 300
  records = [aws_lightsail_static_ip.backend.ip_address]
}
