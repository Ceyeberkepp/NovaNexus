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
valid_ipv4(){
  local address="$1" octet
  local -a parts
  [[ "$address" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || return 1
  IFS=. read -r -a parts <<< "$address"
  [[ ${#parts[@]} -eq 4 ]] || return 1
  for octet in "${parts[@]}"; do
    [[ "$octet" =~ ^(0|[1-9][0-9]{0,2})$ ]] || return 1
    (( 10#$octet <= 255 )) || return 1
  done
  [[ "$address" != 0.0.0.0 && "$address" != 255.255.255.255 && "${parts[0]}" != 127 ]]
}
detect_ipv4(){
  local candidate
  if command -v hostname >/dev/null; then
    for candidate in $(hostname -I 2>/dev/null || true); do
      if valid_ipv4 "$candidate" && [[ "$candidate" != 169.254.* ]]; then printf "%s" "$candidate"; return; fi
    done
  fi
  if command -v ip >/dev/null; then
    candidate=$(ip -4 route get 1.1.1.1 2>/dev/null | sed -n 's/.* src \([0-9.]*\).*/\1/p' | head -n1)
    if valid_ipv4 "$candidate"; then printf "%s" "$candidate"; return; fi
  fi
  return 1
}
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
if [[ -z "$NOVANEXUS_DOMAIN" ]]; then
  NOVANEXUS_DOMAIN=$(detect_ipv4 || true)
  [[ -z "$NOVANEXUS_DOMAIN" ]] || log "Using detected server IP: $NOVANEXUS_DOMAIN"
fi
if [[ -z "$NOVANEXUS_DOMAIN" ]]; then NOVANEXUS_DOMAIN=$(ask "Server IPv4 address or public DNS name"); fi
if valid_ipv4 "$NOVANEXUS_DOMAIN"; then
  TLS_MODE=internal
  NOVANEXUS_TLS_EMAIL=local@novanexus.invalid
  log "IP-only HTTPS: generating local TLS CA. Browsers need its root certificate to trust this server."
elif valid_domain "$NOVANEXUS_DOMAIN"; then
  TLS_MODE=public
  if [[ -z "$NOVANEXUS_TLS_EMAIL" ]]; then NOVANEXUS_TLS_EMAIL=$(ask "Email for public TLS certificate registration"); fi
  [[ "$NOVANEXUS_TLS_EMAIL" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]] || fail "Valid TLS contact email required."
else
  fail "Enter a valid IPv4 address or public DNS name."
fi

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
if [[ "$TLS_MODE" == public ]]; then
  getent ahosts "$NOVANEXUS_DOMAIN" >/dev/null || fail "DNS does not resolve $NOVANEXUS_DOMAIN. Set the DNS record first."
fi
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
if [[ "$TLS_MODE" == internal ]]; then
  sed -i '/^{$NOVANEXUS_DOMAIN} {/a\    tls internal' Caddyfile
fi
log "Building Go API and React frontend and starting PostgreSQL + HTTPS"
docker compose config --quiet
docker compose build --pull app
docker compose up -d --wait --wait-timeout 240
log "Checking HTTPS certificate and application health"
CURL_CA=()
if [[ "$TLS_MODE" == internal ]]; then
  CA_FILE="$ROOT_DIR/novanexus-local-root-ca.crt"
  docker compose exec -T https cat /data/caddy/pki/authorities/local/root.crt > "$CA_FILE" || fail "Cannot export local HTTPS root certificate."
  chmod 644 "$CA_FILE"
  CURL_CA=(--cacert "$CA_FILE")
fi
verified=false
for attempt in $(seq 1 15); do
  if curl --fail --silent --connect-timeout 4 --max-time 8 "${CURL_CA[@]}" "https://$NOVANEXUS_DOMAIN/api/health" 2>/dev/null | grep -q '"ok"'; then
    verified=true; break
  fi
  sleep 2
done
if [[ "$verified" != true ]]; then
  docker compose logs --tail=60 https app db >&2 || true
  fail "HTTPS health verification failed; NOT marking installation complete."
fi
printf "\nNovaNexus HTTPS check passed: https://%s\n" "$NOVANEXUS_DOMAIN"
if [[ "$TLS_MODE" == internal ]]; then
  printf "Local TLS root certificate: %s\n" "$CA_FILE"
  printf "Trust this CA on browser devices to avoid HTTPS warnings.\n"
fi
printf "Initial username: admin\nTemporary password: admin\nOne-time installation setup code: %s\n" "$SETUP_CODE"
printf "You must change the admin password before the dashboard unlocks.\n"
printf "Root-only deployment settings: %s/.env\n" "$ROOT_DIR"
