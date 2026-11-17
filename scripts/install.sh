#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
export DEBIAN_FRONTEND=noninteractive
ROOT_DIR=/opt/novanexus
REPO_URL=https://github.com/Ceyeberkepp/NovaNexus.git
REF=$NOVANEXUS_REF
REF=$([ -n "$REF" ] && echo "$REF" || echo main)
fail(){ echo "[NovaNexus] ERROR: $*" >&2; exit 1; }
log(){ echo "[NovaNexus] $*"; }

[[ $EUID -eq 0 ]] || fail "Run as root using sudo."
command -v apt-get >/dev/null || fail "Ubuntu/Debian required."
[[ -f /etc/os-release ]] || fail "Operating system not detected."
source /etc/os-release
[[ "$ID" == ubuntu || "$ID" == debian ]] || fail "Ubuntu/Debian required."
[[ $(uname -m) == x86_64 || $(uname -m) == aarch64 ]] || fail "Architecture must be x86_64 or ARM64."
[[ ! -e "$ROOT_DIR" ]] || fail "$ROOT_DIR already exists. Refusing to overwrite existing deployment."
[[ "$NOVANEXUS_DOMAIN" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9]$ ]] || fail "Set NOVANEXUS_DOMAIN to a fully-qualified DNS name."
[[ "$NOVANEXUS_DOMAIN" == *.* ]] || fail "Public DNS name required for trusted HTTPS."
[[ "$NOVANEXUS_TLS_EMAIL" == *@*.* ]] || fail "Set NOVANEXUS_TLS_EMAIL for certificate issuance."
[[ "$REF" =~ ^[a-zA-Z0-9][a-zA-Z0-9._/-]*$ ]] || fail "Invalid branch or tag."
log "Installing Docker and minimal tools"
apt-get update -qq
apt-get install -y -qq --no-install-recommends git curl openssl ca-certificates docker.io docker-compose-v2 ||
  fail "Docker Compose v2 not available from OS repositories. Install Docker Engine and Compose v2 and retry."
systemctl enable --now docker
docker compose version >/dev/null || fail "Docker Compose v2 required."
if command -v ss >/dev/null; then
  for port in 80 443; do
    if ss -ltn | grep -Eq "[:.]$port[[:space:]]"; then fail "Port $port is in use."; fi
  done
fi
log "Cloning application"
git clone --quiet --depth 1 --branch "$REF" "$REPO_URL" "$ROOT_DIR"
cd "$ROOT_DIR"
[[ -f Dockerfile && -f docker-compose.yml && -f Caddyfile ]] || fail "Missing deployment files in ref $REF."
DB_PASSWORD=$(openssl rand -hex 24)
SETUP_CODE=$(openssl rand -hex 24)
cat > .env <<EOF
DB_PASSWORD=$DB_PASSWORD
BOOTSTRAP_SETUP_CODE=$SETUP_CODE
NOVANEXUS_DOMAIN=$NOVANEXUS_DOMAIN
TLS_EMAIL=$NOVANEXUS_TLS_EMAIL
EOF
chmod 600 .env
log "Building and starting PostgreSQL, Go API and HTTPS proxy"
docker compose build --pull
docker compose up -d --wait --wait-timeout 240
log "Checking trusted HTTPS"
if ! curl --fail --silent --show-error --connect-timeout 5 --max-time 30 "https://$NOVANEXUS_DOMAIN/api/health" | grep -q '"ok"'; then
  fail "HTTPS is not ready. Check DNS, firewall ports 80/443 and docker compose logs --tail=100 https"
fi
cat <<EOF

NovaNexus initial install completed:
  https://$NOVANEXUS_DOMAIN
  Username: admin
  Temporary password: admin
  One-time setup code: $SETUP_CODE

A password change is mandatory before dashboard access.
The setup code is also in root-only /opt/novanexus/.env.
EOF
