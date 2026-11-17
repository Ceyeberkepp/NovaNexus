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
  local candidate fallback=""
  # Prefer the host default-route source, not the Docker bridge (e.g., 172.17.0.1).
  if command -v ip >/dev/null; then
    candidate=$(ip -4 route get 1.1.1.1 2>/dev/null | sed -n 's/.* src \([0-9.]*\).*/\1/p' | head -n 1)
    if valid_ipv4 "$candidate"; then printf "%s" "$candidate"; return; fi
  fi
  if command -v hostname >/dev/null; then
    for candidate in $(hostname -I 2>/dev/null || true); do
      if valid_ipv4 "$candidate" && [[ "$candidate" != 169.254.* ]]; then
        if [[ "$candidate" != 172.17.* && "$candidate" != 172.18.* && "$candidate" != 172.19.* ]]; then printf "%s" "$candidate"; return; fi
        [[ -n "$fallback" ]] || fallback=$candidate
      fi
    done
  fi
  [[ -z "$fallback" ]] || { printf "%s" "$fallback"; return; }
  return 1
}
trap 'printf "[NovaNexus] Installation stopped at line %s. Existing data was not intentionally deleted.\n" "$LINENO" >&2' ERR

[[ $EUID -eq 0 ]] || fail "Run using sudo."
[[ -f /etc/os-release ]] || fail "Cannot identify operating system."
source /etc/os-release
[[ "$ID" == ubuntu || "$ID" == debian ]] || fail "Only Ubuntu and Debian are supported."
[[ $(uname -m) == x86_64 || $(uname -m) == aarch64 ]] || fail "Requires x86_64 or ARM64."
command -v apt-get >/dev/null || fail "apt-get is required."
if [[ -e "$ROOT_DIR" && ! -f "$ROOT_DIR/.env" ]]; then
  fail "$ROOT_DIR already exists without a saved configuration. Refusing to overwrite unknown data."
fi
RESUME_INSTALL=0
if [[ -f "$ROOT_DIR/.env" ]]; then
  [[ -f "$ROOT_DIR/docker-compose.yml" && -f "$ROOT_DIR/Caddyfile" ]] || fail "Incomplete previous deployment."
  RESUME_INSTALL=1
  log "Previous deployment found: resuming without replacing data."
fi
[[ "$REF" =~ ^[a-zA-Z0-9][a-zA-Z0-9._/-]*$ ]] || fail "Invalid source ref."

NOVANEXUS_DOMAIN=${NOVANEXUS_DOMAIN:-}
NOVANEXUS_TLS_EMAIL=${NOVANEXUS_TLS_EMAIL:-}
if [[ "$RESUME_INSTALL" == 1 ]]; then
  NOVANEXUS_DOMAIN=$(sed -n 's/^NOVANEXUS_DOMAIN=//p' "$ROOT_DIR/.env" | head -n1)
  [[ -n "$NOVANEXUS_DOMAIN" ]] || fail "Existing deployment address missing."
  log "Using existing deployment address: $NOVANEXUS_DOMAIN"
elif [[ -z "$NOVANEXUS_DOMAIN" ]]; then
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
  log "Configuring the official Docker APT repository for $ID ${VERSION_CODENAME:-unknown}"
  [[ -n "${VERSION_CODENAME:-}" ]] || fail "OS release codename is required for Docker packages."
  apt-get -o Acquire::Retries=2 update -qq
  apt-get -y -qq install --no-install-recommends ca-certificates curl
  install -m 0755 -d /etc/apt/keyrings
  curl --fail --silent --show-error --location "https://download.docker.com/linux/$ID/gpg" -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  arch=$(dpkg --print-architecture)
  cat > /etc/apt/sources.list.d/docker.sources <<DOCKER_REPOSITORY
Types: deb
URIs: https://download.docker.com/linux/$ID
Suites: $VERSION_CODENAME
Components: stable
Architectures: $arch
Signed-By: /etc/apt/keyrings/docker.asc
DOCKER_REPOSITORY
  apt-get -o Acquire::Retries=2 update -qq || fail "Docker repository update failed. Check DNS and APT configuration."
  if dpkg-query -W -f='${Status}' docker.io 2>/dev/null | grep -qx 'install ok installed'; then
    log "Existing Debian Docker Engine found; installing only Compose and Buildx plugins."
    apt-get -y -qq install --no-install-recommends docker-compose-plugin docker-buildx-plugin ||
      fail "Docker Compose plugin cannot be added safely to the existing Debian engine."
  else
    apt-get -y -qq install --no-install-recommends docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin ||
      fail "Official Docker packages could not be installed. Check APT repository and package conflicts."
  fi
fi
systemctl enable --now docker
docker info >/dev/null 2>&1 || fail "Docker daemon is not available."
docker compose version >/dev/null 2>&1 || fail "Docker Compose v2 is required."

# Fail early if the DNS record is not provisioned or the HTTPS listener ports are in use.
if [[ "$TLS_MODE" == public ]]; then
  getent ahosts "$NOVANEXUS_DOMAIN" >/dev/null || fail "DNS does not resolve $NOVANEXUS_DOMAIN. Set the DNS record first."
fi
if [[ "$RESUME_INSTALL" == 0 ]] && command -v ss >/dev/null; then
  for port in 80 443; do
    if ss -H -ltn | awk '{print $4}' | grep -Eq "[:.]${port}$"; then
      fail "TCP port $port is already in use; free it before installation."
    fi
  done
fi

log "Fetching the selected NovaNexus source"
if [[ "$RESUME_INSTALL" == 0 ]]; then
  git clone --quiet --depth 1 --branch "$REF" "$REPO_URL" "$ROOT_DIR"
fi
cd "$ROOT_DIR"
[[ -f Dockerfile && -f docker-compose.yml && -f Caddyfile && -f go.mod ]] || fail "The selected source ref does not contain all required services."
if [[ "$RESUME_INSTALL" == 0 ]]; then
  DB_PASSWORD=$(openssl rand -hex 24)
  SETUP_CODE=$(openssl rand -hex 24)
  cat >.env <<EOF
DB_PASSWORD=$DB_PASSWORD
BOOTSTRAP_SETUP_CODE=$SETUP_CODE
NOVANEXUS_DOMAIN=$NOVANEXUS_DOMAIN
TLS_EMAIL=$NOVANEXUS_TLS_EMAIL
EOF
else
  stored_address=$(sed -n 's/^NOVANEXUS_DOMAIN=//p' .env | head -n 1)
  SETUP_CODE=$(sed -n 's/^BOOTSTRAP_SETUP_CODE=//p' .env | head -n 1)
  [[ -n "$stored_address" && -n "$SETUP_CODE" ]] || fail "Existing .env is incomplete; refusing credential rotation."
  NOVANEXUS_DOMAIN=$stored_address
  if valid_ipv4 "$NOVANEXUS_DOMAIN"; then TLS_MODE=internal; else TLS_MODE=public; fi
  log "Reusing prior HTTPS address: $NOVANEXUS_DOMAIN"
fi
chmod 600 .env
if [[ "$TLS_MODE" == internal ]]; then
  # Upgrade existing Caddyfile in place; a resume does not re-clone repository files.
  if ! grep -Eq '^[[:space:]]+default_sni[[:space:]]+' Caddyfile; then
    sed -i '/^[[:space:]]*admin off[[:space:]]*$/a\    default_sni {$NOVANEXUS_DOMAIN}' Caddyfile
  fi
  if ! grep -Eq '^[[:space:]]+tls internal[[:space:]]*$' Caddyfile; then
    sed -i '/^{$NOVANEXUS_DOMAIN} {/a\    tls internal' Caddyfile
  fi
fi
log "Building Go API and React frontend and starting PostgreSQL + HTTPS"
docker compose config --quiet
if [[ "$RESUME_INSTALL" == 0 ]]; then
  docker compose build --pull app
else
  # A verification retry should not rebuild an already running application.
  if ! docker compose images -q app 2>/dev/null | grep -q .; then
    log "No existing application image found; building it now."
    docker compose build --pull app
  else
    log "Reusing the existing application image and database."
  fi
fi
docker compose up -d --wait --wait-timeout 240
# Bind-mounted Caddyfile updates do not automatically restart a healthy proxy.
docker compose exec -T https caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null || fail "Invalid HTTPS proxy configuration."
docker compose exec -T https caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile || fail "Could not reload updated HTTPS configuration."
log "Checking HTTPS certificate and application health"
CURL_CA=()
if [[ "$TLS_MODE" == internal ]]; then
  CA_FILE="$ROOT_DIR/novanexus-local-root-ca.crt"
  docker compose exec -T https cat /data/caddy/pki/authorities/local/root.crt > "$CA_FILE" || fail "Cannot export local HTTPS root certificate."
  chmod 644 "$CA_FILE"
  CURL_CA=(--cacert "$CA_FILE")
fi
verified=false
# Verify the local HTTPS listener independently of LAN routing and proxy env vars.
# Preserve the requested IP address for TLS name/SAN verification while routing to loopback.
HEALTH_URL="https://$NOVANEXUS_DOMAIN/api/health"
CURL_OPTIONS=(--noproxy "*" --resolve "$NOVANEXUS_DOMAIN:443:127.0.0.1" --fail --silent --show-error --connect-timeout 4 --max-time 10)
for attempt in $(seq 1 24); do
  if HEALTH_RESPONSE=$(curl "${CURL_OPTIONS[@]}" "${CURL_CA[@]}" "$HEALTH_URL" 2>&1); then
    if [[ "$HEALTH_RESPONSE" == *'"status":"ok"'* ]]; then
      verified=true
      break
    fi
  fi
  if [[ "$attempt" == 1 || "$attempt" == 12 || "$attempt" == 24 ]]; then
    log "HTTPS health check attempt $attempt/24: ${HEALTH_RESPONSE:-no response}"
  fi
  sleep 2
done
if [[ "$verified" != true ]]; then
  docker compose logs --tail=60 https app db >&2 || true
  fail "Local HTTPS health verification failed. Proxy settings, certificate mismatch or application health may be responsible; inspect the error above."
fi
printf "\nNovaNexus local HTTPS check passed: https://%s\n" "$NOVANEXUS_DOMAIN"
log "The local HTTPS endpoint passed its certificate and API checks. LAN reachability depends on your network/firewall."
if [[ "$TLS_MODE" == internal ]]; then
  printf "Local TLS root certificate: %s\n" "$CA_FILE"
  printf "Trust this CA on browser devices to avoid HTTPS warnings.\n"
fi
printf "Initial username: admin\nTemporary password: admin\nOne-time installation setup code: %s\n" "$SETUP_CODE"
printf "You must change the admin password before the dashboard unlocks.\n"
printf "Root-only deployment settings: %s/.env\n" "$ROOT_DIR"
