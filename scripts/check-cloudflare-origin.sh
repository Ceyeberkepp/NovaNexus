#!/usr/bin/env bash
# Validate the primary HTTPS endpoint used for both local access and Cloudflare Tunnel.
set -Eeuo pipefail
ROOT_DIR="${NOVANEXUS_ROOT_DIR:-/opt/novanexus}"
ENV_FILE="$ROOT_DIR/.env"
if [[ ! -r "$ENV_FILE" ]]; then
  echo "[NovaNexus] Cannot read $ENV_FILE. Run on the appliance as root." >&2
  exit 2
fi
DOMAIN="$(sed -n 's/^NOVANEXUS_DOMAIN=//p' "$ENV_FILE" | tail -n1)"
[[ -n "$DOMAIN" && "$DOMAIN" != *:* && "$DOMAIN" != */* ]] || {
  echo "[NovaNexus] Invalid saved HTTPS origin. Re-run the current installer." >&2
  exit 2
}
CA_FILE="$ROOT_DIR/novanexus-local-root-ca.crt"
CURL_ARGS=(--noproxy '*' --silent --show-error --fail --connect-timeout 4 --max-time 10)
# A private IP certificate must chain to the local CA, while a public domain
# uses normal platform trust. Never disable TLS certificate verification.
if [[ "$DOMAIN" =~ ^[0-9]+([.][0-9]+){3}$ ]]; then
  [[ -s "$CA_FILE" ]] || { echo "[NovaNexus] Missing CA at $CA_FILE. Run the installer." >&2; exit 2; }
  CURL_ARGS+=(--cacert "$CA_FILE")
fi
printf '[NovaNexus] One HTTPS origin: https://%s/ (TCP 443)\n' "$DOMAIN"
if ! RESPONSE="$(curl "${CURL_ARGS[@]}" "https://$DOMAIN/api/health" 2>&1)"; then
  printf '[NovaNexus] FAIL: HTTPS origin is unreachable or its certificate is untrusted: %s\n' "$RESPONSE" >&2
  echo "[NovaNexus] Check the host firewall, Caddy container, and port 443." >&2
  exit 1
fi
if [[ "$RESPONSE" != *'"status":"ok"'* ]]; then
  printf '[NovaNexus] FAIL: The application health check returned: %s\n' "$RESPONSE" >&2
  exit 1
fi
echo "[NovaNexus] PASS: Original HTTPS endpoint is healthy."
# Cloudflare normally sends the external hostname as Host, not the origin IP.
# Verify that request routing works without an HTTP Host Header override.
TUNNEL_HOST="$(sed -n 's/^NOVANEXUS_TUNNEL_DOMAIN=//p' "$ENV_FILE" | tail -n1)"
[[ -n "$TUNNEL_HOST" ]] || TUNNEL_HOST="tunnel-origin-check.example.invalid"
if ! RESPONSE="$(curl "${CURL_ARGS[@]}" -H "Host: $TUNNEL_HOST" "https://$DOMAIN/api/health" 2>&1)"; then
  printf '[NovaNexus] FAIL: tunnel Host header %s rejected: %s\n' "$TUNNEL_HOST" "$RESPONSE" >&2
  exit 1
fi
[[ "$RESPONSE" == *'"status":"ok"'* ]] || {
  echo "[NovaNexus] FAIL: tunnel Host header did not route to the application." >&2
  exit 1
}
echo "[NovaNexus] PASS: Tunnel Host header accepted; no manual HTTP Host Header required."
printf '[NovaNexus] Cloudflare Tunnel service: HTTPS to %s:443\n' "$DOMAIN"
echo "[NovaNexus] Cloudflare CA Pool expects a CERTIFICATE FILE PATH accessible to cloudflared, not pasted PEM text."
echo "[NovaNexus] Copy/mount this CA onto the cloudflared host or container, then use that local path in CA Pool."
echo "[NovaNexus] Keep Disable TLS certificate verification OFF once the CA Pool file is configured."
echo "[NovaNexus] Verify from the cloudflared host: curl --cacert /path/on/connector/novanexus-ca.crt https://$DOMAIN/api/health"
printf '[NovaNexus] Local CA path on the appliance: %s\n' "$CA_FILE"
echo "[NovaNexus] If Cloudflare still reports 502, verify the same origin from the cloudflared machine and inspect its logs."
