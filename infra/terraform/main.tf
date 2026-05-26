# ════════════════════════════════════════════════════════════════════════════
#  SocietyOS — dev/staging infrastructure  (Marzi AWS account · ap-south-1)
#
#  Part 1 of the stack: COMPUTE + NETWORK.
#  Secrets, DNS and Amplify are defined in secrets.tf / dns.tf / amplify.tf.
# ════════════════════════════════════════════════════════════════════════════

terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
    local = {
      source  = "hashicorp/local"
      version = "~> 2.5"
    }
  }
  # State is stored locally (terraform.tfstate). Zero cost, fine for a single
  # operator. Move to an S3 backend later if the team needs shared state.
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile

  # default_tags → EVERY resource this stack creates is auto-tagged. That keeps
  # all SocietyOS spend filterable in Cost Explorer and clearly separated from
  # the existing Marzi resources.
  default_tags {
    tags = {
      Project     = "societyos"
      Environment = var.environment
      ManagedBy   = "terraform"
      CostCenter  = "societyos-${var.environment}"
    }
  }
}

# ── SSH key pair ────────────────────────────────────────────────────────────
# Terraform generates the key pair and writes the private key locally (gitignored
# via *.pem) so the deploy script can SSH in. No console download needed.
resource "aws_lightsail_key_pair" "backend" {
  name = "societyos-${var.environment}-key"
}

resource "local_file" "ssh_key" {
  content         = aws_lightsail_key_pair.backend.private_key
  filename        = "${path.module}/societyos-${var.environment}.pem"
  file_permission = "0600"
}

# ── Compute: one Lightsail instance (VPS) ───────────────────────────────────
# Runs the backend + Redis + Caddy as Docker containers (docker-compose). A
# single fixed instance — no autoscaling. cloud-init.sh installs Docker on the
# first boot.
resource "aws_lightsail_instance" "backend" {
  name              = "societyos-${var.environment}-backend"
  availability_zone = "${var.aws_region}a"
  blueprint_id      = var.lightsail_blueprint_id # Ubuntu 22.04
  bundle_id         = var.lightsail_bundle_id    # size → RAM / vCPU / price
  key_pair_name     = aws_lightsail_key_pair.backend.name
  user_data         = file("${path.module}/../instance/cloud-init.sh")

  tags = { Component = "backend" }
}

# ── Static IP ───────────────────────────────────────────────────────────────
# A fixed public IP so the DNS A-record and the TLS certificate stay valid
# across instance restarts (an instance's default IP can change on recreate).
resource "aws_lightsail_static_ip" "backend" {
  name = "societyos-${var.environment}-ip"
}

resource "aws_lightsail_static_ip_attachment" "backend" {
  static_ip_name = aws_lightsail_static_ip.backend.name
  instance_name  = aws_lightsail_instance.backend.name

  # If the instance is ever replaced, re-attach the static IP automatically.
  lifecycle {
    replace_triggered_by = [aws_lightsail_instance.backend.id]
  }
}

# ── Instance firewall ───────────────────────────────────────────────────────
# Only 80/443 (web) and 22 (SSH) face the internet. The backend's port 3000 is
# never exposed — Caddy on the box terminates TLS on 443 and proxies → 3000.
resource "aws_lightsail_instance_public_ports" "backend" {
  instance_name = aws_lightsail_instance.backend.name

  port_info {
    protocol  = "tcp"
    from_port = 22
    to_port   = 22
  }
  port_info {
    protocol  = "tcp"
    from_port = 80
    to_port   = 80
  }
  port_info {
    protocol  = "tcp"
    from_port = 443
    to_port   = 443
  }
}

# ── VPC peering: Lightsail ↔ the default VPC ────────────────────────────────
# THIS is what lets the instance reach the PRIVATE marzi-community-db. Lightsail
# VPC peering is an account/region-level toggle with no native Terraform
# resource, so we drive the AWS CLI — idempotently (peer only if not already).
resource "terraform_data" "lightsail_vpc_peering" {
  provisioner "local-exec" {
    command = <<-EOT
      set -e
      PEERED=$(aws lightsail is-vpc-peered --region ${var.aws_region} --profile ${var.aws_profile} --query isPeered --output text)
      if [ "$PEERED" != "True" ]; then
        echo "Enabling Lightsail VPC peering in ${var.aws_region}…"
        aws lightsail peer-vpc --region ${var.aws_region} --profile ${var.aws_profile}
      else
        echo "Lightsail VPC peering already enabled."
      fi
    EOT
  }
}
