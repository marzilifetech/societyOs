#!/bin/bash
# ════════════════════════════════════════════════════════════════════════════
#  Lightsail instance bootstrap — runs ONCE on first boot (cloud-init user_data)
#
#  Installs Docker + the Compose plugin and enables automatic OS security
#  updates. The application itself (docker-compose.yml, Caddyfile, .env) is
#  delivered in the separate deploy step — see infra/README.md.
# ════════════════════════════════════════════════════════════════════════════
# POSIX-sh safe — Lightsail runs the launch script with /bin/sh, which has no
# `pipefail`. `set -eux` works under both sh and bash.
set -eux

export DEBIAN_FRONTEND=noninteractive

# ── Base packages ───────────────────────────────────────────────────────────
apt-get update
apt-get install -y ca-certificates curl gnupg git unattended-upgrades

# ── Docker Engine + Compose plugin (official Docker apt repo) ───────────────
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  > /etc/apt/sources.list.d/docker.list

apt-get update
apt-get install -y \
  docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin

systemctl enable --now docker

# Let the default 'ubuntu' user run docker without sudo.
usermod -aG docker ubuntu || true

# ── Automatic security patching ─────────────────────────────────────────────
# Keeps the OS patched with zero manual effort — this is what makes a VPS
# acceptably "auto-managed" for dev/staging.
dpkg-reconfigure -f noninteractive unattended-upgrades

# ── Application directory ───────────────────────────────────────────────────
mkdir -p /opt/societyos
chown ubuntu:ubuntu /opt/societyos

echo "cloud-init complete — Docker ready, /opt/societyos created."
