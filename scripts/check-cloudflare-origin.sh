#!/usr/bin/env bash
# Diagnose the exact HTTPS origin configured for a Cloudflare Tunnel route.
# Reads only non-secret deployment addresses; never sources or prints .env credentials.
set -Eeuo pipefail
ROOT_DIR="${NOVANEXUS_ROOT_DIR:-/opt/novanexus}"
ENV_FILE="$ROOT_DIR/.env"
if [[ ! -r "$ENV_FILE" ]]; then echo "[NovaNexus] Missing readable $ENV_FILE (run as root on the appliance)." >&2;exit 2;fi
get_env(){ sed -n "s/^${1}=//p" "$ENV_FILE" | tail -n1; }
DOMAIN="$(get_env NOVANEXUS_DOMAIN)"
BIND_IP="$(get_env NOVANEXUS_BIND_IP)"
PORT="$(get_env NOVANEXUS_TUNNEL_PORT)"
PORT="${PORT:-18081}"
CA="$ROOT_DIR/novanexus-local-root-ca.crt"
if [[ ! "$PORT" =~ ^[0-9]{4,5}$ || "$PORT" -gt 65535 || ! "$BIND_IP" =~ ^[0-9]{1,3}([.][0-9]{1,3}){3}$ || -z "$DOMAIN" ]];then
 echo "[NovaNexus] Invalid saved origin address. Re-run the current installer." >&2;exit 2
fi
printf '[NovaNexus] Expected Cloudflare Tunnel Service URL: https://%s:%s\n' "$BIND_IP" "$PORT"
printf '[NovaNexus] Primary LAN application URL: https://%s/\n' "$DOMAIN"
printf '[NovaNexus] Tunnel origin uses HTTPS, not HTTP and not 127.0.0.1.\n'
if [[ ! -s "$CA" ]];then
 echo "[NovaNexus] Local CA certificate absent. Re-run the installer before configuring Cloudflare." >&2;exit 1
fi
if ! command -v curl >/dev/null;then echo "[NovaNexus] curl is required." >&2;exit 2;fi
set +e
RESPONSE="$(curl --noproxy '*' --silent --show-error --fail --connect-timeout 3 --max-time 10 --cacert "$CA" --resolve "$DOMAIN:$PORT:$BIND_IP" "https://$DOMAIN:$PORT/api/health" 2>&1)"
CODE=$?
set -e
if [[ $CODE -ne 0 || "$RESPONSE" != *'"status":"ok"'* ]];then
 printf '[NovaNexus] ERROR: Secure LAN origin health check failed: %s\n' "$RESPONSE" >&2
 echo "[NovaNexus] Check container binding, listen port, Caddy TLS certificate and host firewall. Cloudflare will show 502 until this URL responds." >&2
 if command -v docker >/dev/null && [[ -f "$ROOT_DIR/docker-compose.yml" ]];then
  ( cd "$ROOT_DIR" && docker compose ps https && docker compose port https 8443 ) >&2 || true
 fi
 exit 1
fi
echo "[NovaNexus] PASS: HTTPS origin responds with a trusted local certificate and a healthy API."
echo "[NovaNexus] Cloudflare Zero Trust > Networks > Tunnels > Routes:"
printf '  Hostname: your configured public hostname (e.g. nexus.cyverax.com)\n'
printf '  Service type: HTTPS; URL: %s:%s\n' "$BIND_IP" "$PORT"
echo "  TLS origin verification: trust the appliance CA on the cloudflared connector host."
printf '  Local CA to copy to connector host: %s\n' "$CA"
echo "  Set Cloudflare CA Pool to the copied CA file path on the connector host."
echo "  Do not turn off TLS certificate verification unless diagnosing temporarily."
echo "  This local pass does not verify the remote cloudflared connector can reach the appliance."
