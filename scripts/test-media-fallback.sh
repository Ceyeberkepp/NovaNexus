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
grep -Fq 'allow_udp_unstable_fallback' scripts/check-media.sh
grep -Fq 'TURN/TLS' scripts/check-media.sh
grep -Fq 'reconnect' src/MeetingRoom.jsx
echo "Public ICE/TCP fallback and media diagnostic regression checks passed."
