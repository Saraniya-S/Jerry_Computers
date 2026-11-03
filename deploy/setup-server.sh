#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu 24.04 VPS (Hostinger KVM). Run as root:
#   bash setup-server.sh yourdomain.com
# Installs Docker, Node.js 24, Caddy and a firewall, creates the `jerry` user that runs the site,
# and installs the service, web server config and nightly backup. It does not clone the code or
# write secrets: DEPLOY.md walks through those next.
set -euo pipefail
DOMAIN="${1:?Usage: bash setup-server.sh yourdomain.com}"
APP=/home/jerry/app

echo "==> System updates"
apt-get update -y && apt-get upgrade -y
apt-get install -y ca-certificates curl gnupg git ufw debian-keyring debian-archive-keyring apt-transport-https

echo "==> Swap (builds need memory headroom on small plans)"
if ! swapon --show | grep -q swapfile; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> Docker"
if ! command -v docker >/dev/null; then curl -fsSL https://get.docker.com | sh; fi

echo "==> Node.js 24"
if ! node -v 2>/dev/null | grep -q '^v24'; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
fi

echo "==> Caddy (HTTPS)"
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y && apt-get install -y caddy
fi

echo "==> Firewall: SSH, HTTP, HTTPS only"
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable

echo "==> The jerry user"
id jerry >/dev/null 2>&1 || adduser --disabled-password --gecos "" jerry
usermod -aG docker jerry
# Lets update.sh restart the site without a password, and nothing else.
echo 'jerry ALL=(root) NOPASSWD: /usr/bin/systemctl restart jerry-computers' > /etc/sudoers.d/jerry-computers
chmod 440 /etc/sudoers.d/jerry-computers

if [ -d "$APP/deploy" ]; then
  echo "==> Service, web server and backups"
  cp "$APP/deploy/jerry-computers.service" /etc/systemd/system/
  systemctl daemon-reload && systemctl enable jerry-computers
  sed "s/example\.com/$DOMAIN/g" "$APP/deploy/Caddyfile" > /etc/caddy/Caddyfile
  systemctl reload caddy || systemctl restart caddy
  (crontab -u jerry -l 2>/dev/null | grep -v backup.sh; echo "30 2 * * * $APP/deploy/backup.sh >> /home/jerry/backup.log 2>&1") | crontab -u jerry -
  echo "Setup complete. Continue with DEPLOY.md step 6."
else
  echo "Base setup done. Clone the code into $APP as the jerry user (DEPLOY.md step 4), then run this script again."
fi
