#!/usr/bin/env bash
# Read-only LiveKit media diagnostics. Run on the NovaNexus Linux container.
# This deliberately does not print livekit.yaml API credentials.
set -Eeuo pipefail
ROOT_DIR="${NOVANEXUS_ROOT_DIR:-/opt/novanexus}"
cd "$ROOT_DIR" || { echo "Cannot access $ROOT_DIR" >&2; exit 2; }
[[ -r .env && -r livekit.yaml && -f docker-compose.yml ]] || { echo "Missing deployment files in $ROOT_DIR" >&2; exit 2; }
read_setting(){ sed -n "s/^$1=//p" .env | tail -n 1; }
mode="$(read_setting NOVANEXUS_MEDIA_MODE)"
origin="$(read_setting NOVANEXUS_DOMAIN)"
tunnel="$(read_setting NOVANEXUS_TUNNEL_DOMAIN)"
public="$(read_setting NOVANEXUS_PUBLIC_DOMAIN)"
echo "=== NovaNexus LiveKit media diagnostics (no secrets) ==="
printf 'Local HTTPS origin: %s\n' "$origin"
printf 'Media mode: %s\n' "${mode:-unconfigured (older installation)}"
printf 'Tunnel domain recorded: %s\n' "${tunnel:-not configured in installer}"
printf 'Other public hostname recorded: %s\n' "${public:-not configured}"
echo "ICE configuration:"
grep -E '^[[:space:]]*(use_external_ip|advertise_internal_ip|skip_external_ip_validation|allow_tcp_fallback|tcp_fallback_rtt_threshold|allow_udp_unstable_fallback|node_ip|tcp_port|udp_port|enabled):' livekit.yaml | head -n 20 || true
echo ""
echo "Docker services:"
docker compose ps livekit https || true
echo ""
echo "Media port exposure on this Linux container:"
if command -v ss >/dev/null; then
 ss -lntup 2>/dev/null | grep -E ':(7881|7882|3478)[[:space:]]' || true
else
 echo "ss unavailable"
fi
echo ""
echo "Expected external media path: Public gateway -> Proxmox host -> LightNAS Proxmox LXC -> NovaNexus nested Linux container -> Docker LiveKit."
echo "Media forwarding needed: TCP 7881, UDP 7882, UDP 3478 (or a separately reachable TURN relay)."
echo "Cloudflare HTTP tunnels carry WSS signaling on 443, NOT these UDP media packets."
echo "Testing from this container cannot prove remote iPhone (5G) connectivity."
if [[ "$mode" != public ]]; then
 echo "ACTION: This installation does NOT explicitly enable public ICE candidates."
 echo "After establishing external media forwarding, rerun: NOVANEXUS_MEDIA_MODE=public bash /root/novanexus-install.sh"
 exit 1
fi
if ! grep -Eq '^[[:space:]]+use_external_ip:[[:space:]]+true' livekit.yaml; then
 echo "ERROR: Public media mode saved but LiveKit is not configured for public ICE candidates." >&2
 exit 1
fi
if ! grep -Eq '^[[:space:]]+allow_udp_unstable_fallback:[[:space:]]+true' livekit.yaml; then
 echo "NOTICE: Deployed LiveKit is not configured to migrate away from lossy UDP."
 echo "Re-run the updated one-click installer to enable TCP fallback."
fi
if ! grep -Eq '^[[:space:]]+skip_external_ip_validation:[[:space:]]+true' livekit.yaml; then
 echo "NOTICE: NAT hairpin validation may hide the public IP on nested LXC and Docker."
fi
echo "Public ICE candidate mode is configured. External port forwarding/relay is STILL UNVERIFIED."
echo "IMPORTANT: A corporate firewall that blocks UDP and direct TCP 7881 still requires reachable TURN/TLS (preferably TCP 443 on a distinct public endpoint)."
echo "TCP 443 to the Cloudflare webpage alone cannot transport media."
