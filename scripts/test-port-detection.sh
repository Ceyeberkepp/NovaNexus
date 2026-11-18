#!/usr/bin/env bash
set -euo pipefail

# Load only the installer helper: sourcing the installer would install services.
helper=$(sed -n '/^host_port_busy(){/,/^}/p' scripts/install.sh)
[[ "$helper" == host_port_busy* ]] || { echo "Port helper missing" >&2; exit 1; }
eval "$helper"

# Stub the ss output to reproduce occupied, free, and overlapping ports.
ss() {
  cat <<'LISTENERS'
LISTEN 0 4096 0.0.0.0:80 0.0.0.0:*
LISTEN 0 4096 [::]:443 [::]:*
LISTEN 0 4096 127.0.0.1:18081 0.0.0.0:*
LISTEN 0 4096 127.0.0.1:8080 0.0.0.0:*
LISTEN 0 4096 127.0.0.1:1443 0.0.0.0:*
LISTEN 0 4096 127.0.0.1:180810 0.0.0.0:*
LISTEN 0 4096 127.0.0.1:1 0.0.0.0:*
LISTENERS
}
for port in 80 443 8080 1443 18081 1; do
  host_port_busy "$port" || { echo "Expected occupied: $port" >&2; exit 1; }
done
for port in 8081 18082 8880 444 1808 81; do
  if host_port_busy "$port"; then echo "Expected free: $port" >&2; exit 1; fi
done
if host_port_busy invalid; then echo "Invalid port accepted" >&2; exit 1; fi
echo "Exact HTTP/HTTPS/tunnel port detection passed"
