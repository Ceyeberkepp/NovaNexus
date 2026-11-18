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
SOURCE_UPDATED=0
if [[ -f "$ROOT_DIR/.env" ]]; then
  [[ -f "$ROOT_DIR/docker-compose.yml" && -f "$ROOT_DIR/Caddyfile" ]] || fail "Incomplete previous deployment."
  RESUME_INSTALL=1
  log "Previous deployment found: resuming without replacing data."
fi
[[ "$REF" =~ ^[a-zA-Z0-9][a-zA-Z0-9._/-]*$ ]] || fail "Invalid source ref."

NOVANEXUS_DOMAIN=${NOVANEXUS_DOMAIN:-}
NOVANEXUS_TLS_EMAIL=${NOVANEXUS_TLS_EMAIL:-}
# Optional public access: a domain that points to this host via DNS and router/NAT.
# An HTTP-only tunnel is not sufficient to carry WebRTC media.
NOVANEXUS_PUBLIC_DOMAIN=${NOVANEXUS_PUBLIC_DOMAIN:-}
NOVANEXUS_TUNNEL_DOMAIN=${NOVANEXUS_TUNNEL_DOMAIN:-}
NOVANEXUS_HTTP_PORT=${NOVANEXUS_HTTP_PORT:-}
NOVANEXUS_TUNNEL_PORT=${NOVANEXUS_TUNNEL_PORT:-}
LAN_IP=$(detect_ipv4 || true)
if [[ "$RESUME_INSTALL" == 1 ]]; then
  NOVANEXUS_DOMAIN=$(sed -n 's/^NOVANEXUS_DOMAIN=//p' "$ROOT_DIR/.env" | head -n1)
  if [[ -z "$NOVANEXUS_TLS_EMAIL" ]]; then
    NOVANEXUS_TLS_EMAIL=$(sed -n 's/^TLS_EMAIL=//p' "$ROOT_DIR/.env" | head -n1)
  fi
  [[ -n "$NOVANEXUS_DOMAIN" ]] || fail "Existing deployment address missing."
  log "Using existing deployment address: $NOVANEXUS_DOMAIN"
  if [[ -z "$NOVANEXUS_PUBLIC_DOMAIN" ]]; then
    NOVANEXUS_PUBLIC_DOMAIN=$(sed -n 's/^NOVANEXUS_PUBLIC_DOMAIN=//p' "$ROOT_DIR/.env" | head -n1)
  fi
  if [[ -z "$NOVANEXUS_TUNNEL_DOMAIN" ]]; then
    NOVANEXUS_TUNNEL_DOMAIN=$(sed -n 's/^NOVANEXUS_TUNNEL_DOMAIN=//p' "$ROOT_DIR/.env" | head -n1)
  fi
  if [[ -z "$NOVANEXUS_HTTP_PORT" ]]; then
    NOVANEXUS_HTTP_PORT=$(sed -n 's/^NOVANEXUS_HTTP_PORT=//p' "$ROOT_DIR/.env" | head -n1)
  fi
  if [[ -z "$NOVANEXUS_TUNNEL_PORT" ]]; then
    NOVANEXUS_TUNNEL_PORT=$(sed -n 's/^NOVANEXUS_TUNNEL_PORT=//p' "$ROOT_DIR/.env" | head -n1)
  fi
elif [[ -z "$NOVANEXUS_DOMAIN" ]]; then
  NOVANEXUS_DOMAIN=$(detect_ipv4 || true)
  [[ -z "$NOVANEXUS_DOMAIN" ]] || log "Using detected server IP: $NOVANEXUS_DOMAIN"
fi
if [[ -z "$NOVANEXUS_DOMAIN" ]]; then NOVANEXUS_DOMAIN=$(ask "Server IPv4 address or public DNS name"); fi
if [[ "$RESUME_INSTALL" == 0 && -z "$NOVANEXUS_PUBLIC_DOMAIN" && -r /dev/tty ]]; then
  NOVANEXUS_PUBLIC_DOMAIN=$(ask "Optional public HTTPS hostname for outside access (Enter to keep LAN only)")
fi
if [[ -n "$NOVANEXUS_TUNNEL_DOMAIN" ]]; then
  NOVANEXUS_TUNNEL_DOMAIN=${NOVANEXUS_TUNNEL_DOMAIN#https://}
  NOVANEXUS_TUNNEL_DOMAIN=${NOVANEXUS_TUNNEL_DOMAIN%/}
  valid_domain "$NOVANEXUS_TUNNEL_DOMAIN" || fail "Tunnel domain must be a valid hostname without a path."
fi
# A public domain already used as the primary address must not create a duplicate site.
if [[ "$NOVANEXUS_PUBLIC_DOMAIN" == "$NOVANEXUS_DOMAIN" ]]; then NOVANEXUS_PUBLIC_DOMAIN=""; fi
if [[ -n "$NOVANEXUS_PUBLIC_DOMAIN" ]]; then
  NOVANEXUS_PUBLIC_DOMAIN=${NOVANEXUS_PUBLIC_DOMAIN#https://}
  NOVANEXUS_PUBLIC_DOMAIN=${NOVANEXUS_PUBLIC_DOMAIN%/}
  valid_domain "$NOVANEXUS_PUBLIC_DOMAIN" || fail "Provide a valid public DNS hostname, not a private IP or URL path."
fi
if valid_ipv4 "$NOVANEXUS_DOMAIN"; then
  TLS_MODE=internal
  if [[ -z "$NOVANEXUS_TLS_EMAIL" ]]; then NOVANEXUS_TLS_EMAIL=local@novanexus.invalid; fi
  log "IP-only HTTPS: generating local TLS CA. Browsers need its root certificate to trust this server."
elif valid_domain "$NOVANEXUS_DOMAIN"; then
  TLS_MODE=public
  if [[ -z "$NOVANEXUS_TLS_EMAIL" ]]; then NOVANEXUS_TLS_EMAIL=$(ask "Email for public TLS certificate registration"); fi
  [[ "$NOVANEXUS_TLS_EMAIL" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]] || fail "Valid TLS contact email required."
else
  fail "Enter a valid IPv4 address or public DNS name."
fi

if [[ -n "$NOVANEXUS_PUBLIC_DOMAIN" && "$TLS_MODE" == internal ]]; then
  # A trusted public certificate needs an actual registration contact. Keep
  # the local IP certificate issued through Caddy's private CA.
  if [[ ! "$NOVANEXUS_TLS_EMAIL" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ || "$NOVANEXUS_TLS_EMAIL" == *@novanexus.invalid ]]; then
    NOVANEXUS_TLS_EMAIL=$(ask "Email for publicly trusted HTTPS certificate")
  fi
  [[ "$NOVANEXUS_TLS_EMAIL" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ && "$NOVANEXUS_TLS_EMAIL" != *@novanexus.invalid ]] ||
    fail "A valid TLS contact email is required for public-domain HTTPS."
fi

log "Installing any missing system dependencies"
needed=()
for package in git curl ca-certificates openssl iproute2; do
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

# A local tunnel origin is always bound to 127.0.0.1, never public interfaces.
# If another service occupies port 80, use an unoccupied host HTTP port.
# This does not change the LAN HTTPS URL (port 443).
host_port_busy(){
  ss -H -ltn | awk '{print $4}' | grep -Eq "[:.]1$"
}
valid_port(){
  [[ "$1" =~ ^[0-9]{1,5}$ ]] && (( 10#$1 >= 1024 && 10#$1 <= 65535 ))
}
if [[ "$TLS_MODE" == public ]]; then
  getent ahosts "$NOVANEXUS_DOMAIN" >/dev/null || fail "DNS does not resolve $NOVANEXUS_DOMAIN. Set the DNS record first."
fi
if [[ -n "$NOVANEXUS_PUBLIC_DOMAIN" ]]; then
  getent ahosts "$NOVANEXUS_PUBLIC_DOMAIN" >/dev/null ||
    log "WARNING: Public hostname $NOVANEXUS_PUBLIC_DOMAIN does not resolve yet. DNS must be configured before outside access works."
fi
if [[ "$RESUME_INSTALL" == 0 ]]; then
  [[ -n "$NOVANEXUS_HTTP_PORT" ]] || NOVANEXUS_HTTP_PORT=80
  if [[ "$NOVANEXUS_HTTP_PORT" != 80 ]] && ! valid_port "$NOVANEXUS_HTTP_PORT"; then fail "HTTP port must be 80 or 1024–65535.";fi
  if host_port_busy "$NOVANEXUS_HTTP_PORT";then
    [[ "$NOVANEXUS_HTTP_PORT" == 80 ]] || fail "Requested HTTP port $NOVANEXUS_HTTP_PORT is already in use."
    for candidate in 8080 8081 8880 18080;do
      if ! host_port_busy "$candidate";then NOVANEXUS_HTTP_PORT="$candidate";break;fi
    done
    [[ "$NOVANEXUS_HTTP_PORT" != 80 ]] || fail "No free HTTP fallback port was found."
    log "HTTP port 80 is occupied; using port $NOVANEXUS_HTTP_PORT without touching the existing service."
    log "For publicly trusted TLS with port 80 unavailable, Caddy needs external port 443 for TLS-ALPN-01 or an existing TLS proxy."
  fi
  [[ -n "$NOVANEXUS_TUNNEL_PORT" ]] || NOVANEXUS_TUNNEL_PORT=18081
  valid_port "$NOVANEXUS_TUNNEL_PORT" || fail "Tunnel origin port must be 1024–65535."
  if [[ "$NOVANEXUS_TUNNEL_PORT" == "$NOVANEXUS_HTTP_PORT" ]] || host_port_busy "$NOVANEXUS_TUNNEL_PORT";then
    for candidate in 18081 18082 18083 28080 28081;do
      if [[ "$candidate" != "$NOVANEXUS_HTTP_PORT" ]] && ! host_port_busy "$candidate";then NOVANEXUS_TUNNEL_PORT="$candidate";break;fi
    done
    [[ "$NOVANEXUS_TUNNEL_PORT" != "$NOVANEXUS_HTTP_PORT" ]] && ! host_port_busy "$NOVANEXUS_TUNNEL_PORT" ||
      fail "No free tunnel origin port found."
  fi
  if host_port_busy 443;then
    fail "HTTPS port 443 is already occupied. Preserving https://$NOVANEXUS_DOMAIN requires an available HTTPS listener or an existing reverse proxy/tunnel. An HTTP fallback port cannot replace HTTPS."
  fi
else
  [[ -n "$NOVANEXUS_HTTP_PORT" ]] || NOVANEXUS_HTTP_PORT=80
  [[ -n "$NOVANEXUS_TUNNEL_PORT" ]] || NOVANEXUS_TUNNEL_PORT=18081
fi
if [[ "$NOVANEXUS_HTTP_PORT" != 80 ]] && ! valid_port "$NOVANEXUS_HTTP_PORT";then fail "Invalid saved HTTP port.";fi
valid_port "$NOVANEXUS_TUNNEL_PORT" || fail "Invalid saved tunnel port."
log "HTTP port $NOVANEXUS_HTTP_PORT; HTTPS port 443; local-only tunnel origin 127.0.0.1:$NOVANEXUS_TUNNEL_PORT"

log "Fetching the selected NovaNexus source"
if [[ "$RESUME_INSTALL" == 0 ]]; then
  git clone --quiet --depth 1 --branch "$REF" "$REPO_URL" "$ROOT_DIR"
else
  # Only installer-managed Caddyfile modifications may be overwritten during upgrade.
  unmanaged=$(git -C "$ROOT_DIR" diff --name-only HEAD | grep -Ev "^(Caddyfile|additional-sites\.caddy)$" || true)
  [[ -z "$unmanaged" ]] || fail "Local application edits detected. Refusing to overwrite: $unmanaged"
  git -C "$ROOT_DIR" fetch --quiet --depth 1 origin "$REF" || fail "Could not fetch current NovaNexus source."
  if [[ "$(git -C "$ROOT_DIR" rev-parse HEAD)" != "$(git -C "$ROOT_DIR" rev-parse FETCH_HEAD)" ]]; then
    log "Updating previously installed application code while preserving .env and database volumes."
    git -C "$ROOT_DIR" reset --hard FETCH_HEAD >/dev/null
    SOURCE_UPDATED=1
  fi
fi
cd "$ROOT_DIR"
[[ -f Dockerfile && -f docker-compose.yml && -f Caddyfile && -f go.mod ]] || fail "The selected source ref does not contain all required services."
if [[ "$RESUME_INSTALL" == 0 ]]; then
  DB_PASSWORD=$(openssl rand -hex 24)
  ADMIN_PASSWORD=$(openssl rand -hex 20)
  LIVEKIT_SECRET=$(openssl rand -hex 32)
  cat >.env <<EOF
DB_PASSWORD=$DB_PASSWORD
BOOTSTRAP_ADMIN_PASSWORD=$ADMIN_PASSWORD
LIVEKIT_API_KEY=novanexus
LIVEKIT_API_SECRET=$LIVEKIT_SECRET
NOVANEXUS_DOMAIN=$NOVANEXUS_DOMAIN
TLS_EMAIL=$NOVANEXUS_TLS_EMAIL
NOVANEXUS_PUBLIC_DOMAIN=$NOVANEXUS_PUBLIC_DOMAIN
NOVANEXUS_TUNNEL_DOMAIN=$NOVANEXUS_TUNNEL_DOMAIN
NOVANEXUS_HTTP_PORT=$NOVANEXUS_HTTP_PORT
NOVANEXUS_TUNNEL_PORT=$NOVANEXUS_TUNNEL_PORT
EOF
else
  stored_address=$(sed -n 's/^NOVANEXUS_DOMAIN=//p' .env | head -n 1)
  [[ -n "$stored_address" ]] || fail "Existing .env is incomplete."
  NOVANEXUS_DOMAIN=$stored_address
  if valid_ipv4 "$NOVANEXUS_DOMAIN"; then TLS_MODE=internal; else TLS_MODE=public; fi
  ADMIN_PASSWORD=$(sed -n 's/^BOOTSTRAP_ADMIN_PASSWORD=//p' .env | head -n 1)
  if [[ -z "$ADMIN_PASSWORD" ]]; then
    log "Migrating the pending administrator account from legacy setup-code authentication."
    ADMIN_PASSWORD=$(openssl rand -hex 20)
    printf "BOOTSTRAP_ADMIN_PASSWORD=%s\n" "$ADMIN_PASSWORD" >> .env
    SOURCE_UPDATED=1
  fi
  if ! grep -q "^LIVEKIT_API_SECRET=" .env; then
    printf "LIVEKIT_API_KEY=novanexus\nLIVEKIT_API_SECRET=%s\n" "$(openssl rand -hex 32)" >>.env
    SOURCE_UPDATED=1
    log "Added private video meeting service credentials to existing deployment."
  fi
  # The setup code is obsolete; retain credentials and application data.
  sed -i '/^BOOTSTRAP_SETUP_CODE=/d' .env
  log "Reusing previous HTTPS address: $NOVANEXUS_DOMAIN"
fi
# Synchronize the optional hostname on upgrades without touching credentials.
# This supports changing a LAN deployment to dual LAN/internet access in-place.
sed -i '/^NOVANEXUS_PUBLIC_DOMAIN=/d; /^NOVANEXUS_TUNNEL_DOMAIN=/d; /^NOVANEXUS_HTTP_PORT=/d; /^NOVANEXUS_TUNNEL_PORT=/d; /^TLS_EMAIL=/d' .env
printf 'NOVANEXUS_PUBLIC_DOMAIN=%s\nNOVANEXUS_TUNNEL_DOMAIN=%s\nNOVANEXUS_HTTP_PORT=%s\nNOVANEXUS_TUNNEL_PORT=%s\nTLS_EMAIL=%s\n' "$NOVANEXUS_PUBLIC_DOMAIN" "$NOVANEXUS_TUNNEL_DOMAIN" "$NOVANEXUS_HTTP_PORT" "$NOVANEXUS_TUNNEL_PORT" "$NOVANEXUS_TLS_EMAIL" >>.env
chmod 600 .env
LIVEKIT_KEY=$(sed -n "s/^LIVEKIT_API_KEY=//p" .env | head -n1)
LIVEKIT_SECRET=$(sed -n "s/^LIVEKIT_API_SECRET=//p" .env | head -n1)
[[ "$LIVEKIT_KEY" =~ ^[a-zA-Z0-9_-]{3,64}$ && ${#LIVEKIT_SECRET} -ge 32 ]] || fail "Invalid video server credentials."
[[ "$NOVANEXUS_DOMAIN" =~ ^[a-zA-Z0-9.-]+$ ]] || fail "Invalid video host address."
# WebRTC media uses dedicated UDP/TCP ports, NOT the HTTPS reverse proxy.
# When a publicly reachable hostname is configured, LiveKit asks STUN for its
# public candidate. This still requires router/NAT forwarding for 7881 TCP
# and 7882 UDP (or a properly configured TURN service).
PUBLIC_MEDIA=0
if [[ -n "$NOVANEXUS_PUBLIC_DOMAIN" || -n "$NOVANEXUS_TUNNEL_DOMAIN" || "$TLS_MODE" == public ]]; then PUBLIC_MEDIA=1; fi
if [[ "$PUBLIC_MEDIA" == 1 ]]; then
  MEDIA_RTC_CONFIG='  use_external_ip: true
  advertise_internal_ip: true'
  MEDIA_TURN_CONFIG='turn:
  enabled: true
  udp_port: 3478'
else
  MEDIA_RTC_CONFIG="  use_external_ip: false
  node_ip: $NOVANEXUS_DOMAIN"
  MEDIA_TURN_CONFIG=""
fi
cat >livekit.yaml <<LIVEKIT_CONFIGURATION
port: 7880
rtc:
  tcp_port: 7881
  udp_port: 7882
$MEDIA_RTC_CONFIG
room:
  max_participants: 1000
$MEDIA_TURN_CONFIG
keys:
  "$LIVEKIT_KEY": "$LIVEKIT_SECRET"
LIVEKIT_CONFIGURATION
chmod 600 livekit.yaml
# The shared Caddyfile serves the primary address. Generate a second HTTPS
# site when LAN IP + public hostname must coexist. Nothing is exposed on HTTP
# beyond Caddy's redirect and certificate challenge handling.
cat >additional-sites.caddy <<'SITE_HEADER'
# Additional HTTPS site rendered by the NovaNexus installer.
SITE_HEADER
if [[ -n "$NOVANEXUS_PUBLIC_DOMAIN" ]]; then
  cat >>additional-sites.caddy <<PUBLIC_SITE
$NOVANEXUS_PUBLIC_DOMAIN {
    import novanexus_routes
}
PUBLIC_SITE
fi
if [[ "$TLS_MODE" == public && -n "$LAN_IP" && "$LAN_IP" != "$NOVANEXUS_DOMAIN" ]]; then
  cat >>additional-sites.caddy <<LAN_SITE
$LAN_IP {
    tls internal
    import novanexus_routes
}
LAN_SITE
fi
if [[ "$TLS_MODE" == internal ]]; then
  # Upgrade existing Caddyfile in place; a resume does not re-clone repository files.
  if ! grep -Eq '^[[:space:]]+default_sni[[:space:]]+' Caddyfile; then
    sed -i '/^[[:space:]]*admin off[[:space:]]*$/a\    default_sni {$NOVANEXUS_DOMAIN}' Caddyfile
  fi
  if ! grep -Eq '^[[:space:]]+tls internal[[:space:]]*$' Caddyfile; then
    sed -i '/^{$NOVANEXUS_DOMAIN} {/a\    tls internal' Caddyfile
  fi
fi
log "Building Go API and React frontend and starting PostgreSQL, HTTPS and video media service"
docker compose config --quiet
if [[ "$RESUME_INSTALL" == 0 || "$SOURCE_UPDATED" == 1 ]]; then
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
log "Setting up the built-in local AI assistant (small starter model)"
if docker compose exec -T ollama ollama list 2>/dev/null | grep -Fq "qwen2.5:0.5b"; then
  log "Starter AI model is already installed."
elif docker compose exec -T ollama ollama pull qwen2.5:0.5b; then
  log "Local AI assistant model is ready."
else
  log "WARNING: AI model download did not complete. Other NovaNexus services remain available; AI can be retried later."
fi
# Bind-mounted Caddyfile updates do not automatically restart a healthy proxy.
docker compose exec -T https caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null || fail "Invalid HTTPS proxy configuration."
docker compose restart https >/dev/null || fail "Could not restart HTTPS proxy with updated configuration."
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
# A local loopback request verifies that Caddy can present a publicly trusted
# certificate for the optional hostname. This is NOT an outside-network test.
PUBLIC_HTTPS_VERIFIED=false
PUBLIC_HTTPS_HOST="$NOVANEXUS_PUBLIC_DOMAIN"
if [[ -z "$PUBLIC_HTTPS_HOST" && "$TLS_MODE" == public ]]; then PUBLIC_HTTPS_HOST="$NOVANEXUS_DOMAIN"; fi
if [[ -n "$PUBLIC_HTTPS_HOST" ]]; then
  for public_attempt in 1 2 3 4 5 6; do
    if curl --noproxy "*" --resolve "$PUBLIC_HTTPS_HOST:443:127.0.0.1" --fail --silent --show-error --connect-timeout 4 --max-time 9 "https://$PUBLIC_HTTPS_HOST/api/health" 2>/dev/null | grep -q '"status":"ok"'; then
      PUBLIC_HTTPS_VERIFIED=true
      break
    fi
    sleep 3
  done
  if [[ "$PUBLIC_HTTPS_VERIFIED" == true ]]; then
    log "Public hostname TLS certificate and HTTPS reverse proxy passed an on-host check."
  else
    log "WARNING: Public HTTPS name $PUBLIC_HTTPS_HOST is not yet verified. DNS, ACME certificates, or gateway port forwarding may need attention."
  fi
fi
printf "\n==========================================\n"
printf "NovaNexus Web GUI: https://%s/\n" "$NOVANEXUS_DOMAIN"
printf "Tunnel origin (local host only): http://127.0.0.1:%s\n" "$NOVANEXUS_TUNNEL_PORT"
if [[ "$NOVANEXUS_HTTP_PORT" != 80 ]];then
  log "Existing service owns TCP 80. NovaNexus uses host HTTP port $NOVANEXUS_HTTP_PORT; the HTTPS GUI stays on port 443."
fi
if [[ -n "$NOVANEXUS_TUNNEL_DOMAIN" ]];then
  printf "Tunnel public URL (requires your tunnel provider routing): https://%s/\n" "$NOVANEXUS_TUNNEL_DOMAIN"
fi
printf "==========================================\n"
log "The local HTTPS endpoint passed its certificate and API checks. LAN reachability depends on your network/firewall."
if [[ -n "$NOVANEXUS_PUBLIC_DOMAIN" ]]; then
  printf "Public Web GUI (after DNS + router setup): https://%s/\n" "$NOVANEXUS_PUBLIC_DOMAIN"
elif [[ "$TLS_MODE" == public ]]; then
  printf "Public Web GUI (after DNS + router setup): https://%s/\n" "$NOVANEXUS_DOMAIN"
fi
if [[ "$PUBLIC_MEDIA" == 1 ]]; then
  log "Internet media requires reachable TCP 7881, UDP 7882 and TURN UDP 3478; HTTPS on TCP 443 alone does NOT carry WebRTC media."
  log "Forward TCP 80/443, TCP 7881, UDP 7882 and UDP 3478 from the public gateway to this host, unless an existing secure ingress/relay handles those services."
  log "Internet access is NOT confirmed by this local health check. Verify from a device outside the LAN."
fi

if [[ "$TLS_MODE" == internal ]]; then
  printf "Local TLS root certificate: %s\n" "$CA_FILE"
  printf "Trust this CA on browser devices to avoid HTTPS warnings.\n"
fi
printf "Administrator username: admin\nInitial password: %s\n" "$ADMIN_PASSWORD"
printf "The initial password expires after you change it on first login.\n"
printf "You must change the admin password before the dashboard unlocks.\n"
printf "Root-only deployment settings: %s/.env\n" "$ROOT_DIR"
