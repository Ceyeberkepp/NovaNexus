#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
export DEBIAN_FRONTEND=noninteractive
ROOT_DIR=/opt/novanexus
REPO_URL=https://github.com/Ceyeberkepp/NovaNexus.git
REF=${NOVANEXUS_REF:-main}
log(){ printf "[NovaNexus] %s\n" "$*"; }
fail(){ printf "[NovaNexus] ERROR: %s\n" "$*" >&2; exit 1; }
ask(){ local label="$1" answer=""; if [[ -r /dev/tty ]]; then read -r -p "$label: " answer </dev/tty || true; fi; printf "%s" "$answer"; }
valid_domain(){ [[ "$1" =~ ^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$ ]] && [[ "$1" == *.* ]] && [[ "$1" != *..* ]] && [[ "$1" != *.local ]] && [[ "$1" != *.test ]]; }
trap 'printf "[NovaNexus] Installation stopped at line %s. Existing data was not intentionally deleted.\n" "$LINENO" >&2' ERR

[[ $EUID -eq 0 ]] || fail "Run using sudo."
[[ -f /etc/os-release ]] || fail "Cannot identify operating system."
source /etc/os-release
[[ "$ID" == ubuntu || "$ID" == debian ]] || fail "Only Ubuntu and Debian are supported."
[[ $(uname -m) == x86_64 || $(uname -m) == aarch64 ]] || fail "Requires x86_64 or ARM64."
command -v apt-get >/dev/null || fail "apt-get is required."
[[ ! -e "$ROOT_DIR" ]] || fail "$ROOT_DIR exists: refusing to overwrite a previous installation."
[[ "$REF" =~ ^[a-zA-Z0-9][a-zA-Z0-9._/-]*$ ]] || fail "Invalid source ref."

NOVANEXUS_DOMAIN=${NOVANEXUS_DOMAIN:-}
NOVANEXUS_TLS_EMAIL=${NOVANEXUS_TLS_EMAIL:-}
if [[ -z "$NOVANEXUS_DOMAIN" ]]; then NOVANEXUS_DOMAIN=$(ask "Public HTTPS domain (example: nexus.example.com)"); fi
valid_domain "$NOVANEXUS_DOMAIN" || fail "A valid public FQDN is required for trusted HTTPS."
if [[ -z "$NOVANEXUS_TLS_EMAIL" ]]; then NOVANEXUS_TLS_EMAIL=$(ask "Email for TLS certificate registration"); fi
[[ "$NOVANEXUS_TLS_EMAIL" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]] || fail "A valid TLS contact email is required."

log "Installing any missing system dependencies"
needed=()
for package in git curl ca-certificates openssl; do
  if ! dpkg-query -W -f='${Status}' "$package" 2>/dev/null | grep -qx "install ok installed"; then needed+=("$package"); fi
done
if (( ${#needed[@]} )); then
  apt-get -o Acquire::Retries=2 update -qq
  apt-get -y -qq install --no-install-recommends "${needed[@]}"
fi
command -v systemctl >/dev/null || fail "Systemd is required to supervise Docker."
if ! command -v docker >/dev/null || ! docker compose version >/dev/null 2>&1; then
  log "Installing Docker Engine and Docker Compose v2"
  apt-get -o Acquire::Retries=2 update -qq
  if ! apt-get -y -qq install --no-install-recommends docker.io docker-compose-v2; then
    apt-get -y -qq install --no-install-recommends docker.io docker-compose-plugin || fail "Docker Compose v2 could not be installed from OS package sources."
  fi
fi
systemctl enable --now docker
docker info >/dev/null 2>&1 || fail "Docker daemon is not available."
docker compose version >/dev/null 2>&1 || fail "Docker Compose v2 is required."

# Fail early if the DNS record is not provisioned or the HTTPS listener ports are in use.
getent ahosts "$NOVANEXUS_DOMAIN" >/dev/null || fail "DNS does not resolve $NOVANEXUS_DOMAIN. Set the DNS A/AAAA record first."
if command -v ss >/dev/null; then
  for port in 80 443; do
    if ss -H -ltn | awk '{print $4}' | grep -Eq "[:.]${port}$"; then
      fail "TCP port $port is already in use; free it before installation."
    fi
  done
fi

log "Fetching the selected NovaNexus source"
git clone --quiet --depth 1 --branch "$REF" "$REPO_URL" "$ROOT_DIR"
cd "$ROOT_DIR"
[[ -f Dockerfile && -f docker-compose.yml && -f Caddyfile && -f go.mod ]] || fail "The selected source ref does not contain all required services."
DB_PASSWORD=$(openssl rand -hex 24)
SETUP_CODE=$(openssl rand -hex 24)
cat >.env <<EOF
DB_PASSWORD=$DB_PASSWORD
BOOTSTRAP_SETUP_CODE=$SETUP_CODE
NOVANEXUS_DOMAIN=$NOVANEXUS_DOMAIN
TLS_EMAIL=$NOVANEXUS_TLS_EMAIL
EOF
chmod 600 .env
log "Building Go API and React frontend and starting PostgreSQL + HTTPS"
docker compose config --quiet
docker compose build --pull app
docker compose up -d --wait --wait-timeout 240
log "Checking public TLS certificate and application health"
if ! curl --fail --silent --show-error --connect-timeout 8 --max-time 45 "https://$NOVANEXUS_DOMAIN/api/health" | grep -q '"ok"'; then
  docker compose logs --tail=60 https app db >&2 || true
  fail "Public HTTPS verification did not pass. Check DNS, inbound ports 80/443, and certificate logs. Deployment is NOT marked complete."
fi
printf "\nNovaNexus HTTPS check passed: https://%s\n" "$NOVANEXUS_DOMAIN"
printf "Initial username: admin\nTemporary password: admin\nOne-time installation setup code: %s\n" "$SETUP_CODE"
printf "You must change the admin password before the dashboard unlocks.\n"
printf "Root-only deployment settings: %s/.env\n" "$ROOT_DIR"
