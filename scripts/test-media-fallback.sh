#!/usr/bin/env bash
# Validate that both the installer and the published media diagnostics retain
# support for corporate-network ICE/TCP fallback and nested NAT installations.
set -Eeuo pipefail
cd "$(dirname "$0")/.."
bash -n scripts/install.sh scripts/check-media.sh
node -e "const f=require('fs').readFileSync('docker-compose.yml','utf8');for(const p of ['7881:7881/tcp','7882:7882/udp','3478:3478/udp'])if(!f.includes(p))throw Error('Missing exposed LiveKit '+p)"
for directive in \
 'use_external_ip: true' \
 'advertise_internal_ip: true' \
 'skip_external_ip_validation: true' \
 'allow_tcp_fallback: true' \
 'tcp_fallback_rtt_threshold: 1500' \
 'allow_udp_unstable_fallback: true'; do
 grep -Fq "$directive" scripts/install.sh || {
  echo "Required LiveKit directive missing in one-click installer: $directive" >&2
  exit 1
 }
done
# Parse the installer's public-IP guard without running apt, Docker or the installer.
guard="$(sed -n '/^valid_ipv4(){/,/^detect_ipv4(){/p' scripts/install.sh | sed '$d')"
[[ "$guard" == *'valid_public_ipv4()'* ]] || { echo 'Missing public IP guard' >&2; exit 1; }
for ip in 8.8.8.8 1.1.1.1; do
  bash -c "$guard; valid_public_ipv4 \"\\$1\"" -- "$ip" || { echo "Unexpected public IP rejection: $ip" >&2; exit 1; }
done
for ip in 127.0.0.1 10.1.1.1 192.168.1.10 172.16.8.1 100.64.1.1 169.254.1.2 198.18.0.1 192.0.2.1 198.51.100.2 203.0.113.4 224.0.0.1 999.1.1.1; do
  if bash -c "$guard; valid_public_ipv4 \"\\$1\"" -- "$ip"; then
    echo "Reserved/non-routable IP accepted as public ICE address: $ip" >&2; exit 1
  fi
done
grep -Fq 'node_ip: $NOVANEXUS_MEDIA_PUBLIC_IP' scripts/install.sh
grep -Fq 'use_external_ip: false' scripts/install.sh
grep -Fq 'NOVANEXUS_MEDIA_PUBLIC_IP=' scripts/check-media.sh || grep -Fq 'read_setting NOVANEXUS_MEDIA_PUBLIC_IP' scripts/check-media.sh
grep -Fq 'allow_udp_unstable_fallback' scripts/check-media.sh
grep -Fq 'TURN/TLS' scripts/check-media.sh
grep -Fq 'reconnect' src/MeetingRoom.jsx
echo "Public ICE/TCP fallback and media diagnostic regression checks passed."
