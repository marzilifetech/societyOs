# ── Outputs — printed after `terraform apply`, used by the deploy step ───────

output "instance_name" {
  description = "Lightsail instance name (for SSH / deploy)."
  value       = aws_lightsail_instance.backend.name
}

output "instance_public_ip" {
  description = "Static public IP of the backend instance."
  value       = aws_lightsail_static_ip.backend.ip_address
}

output "api_url" {
  description = "Public API URL once DNS + TLS are live."
  value       = "https://${var.api_domain}"
}

output "admin_url" {
  description = "Public admin-web URL once Amplify is live."
  value       = "https://${var.admin_domain}"
}

output "config_secret_name" {
  description = "Secrets Manager secret holding the backend runtime config."
  value       = aws_secretsmanager_secret.societyos_dev.name
}
