#!/usr/bin/env bash
# Opt-in targeted ICE interface repair for an already host-networked LiveKit.
# Does not alter/recreate Caddy, tunnel, database, app, or signaling bridge.
set -Eeuo pipefail
cd "$(dirname "$0")/.."
media(){ docker compose -f docker-compose.yml -f docker-compose.media-host.yml "$@"; }
log(){ printf '[Nexus ICE] %s\n' "$*"; }
fail(){ printf '[Nexus ICE] ERROR: %s\n' "$*" >&2; exit 1; }
command -v python3 >/dev/null || fail "Python 3 is required"
command -v ip >/dev/null || fail "iproute2 required"
[[ -f livekit.yaml && -f docker-compose.media-host.yml ]] || fail "LiveKit configuration or host override missing"
iface="${NOVANEXUS_MEDIA_INTERFACE:-eth0}"
lan="$(ip -4 -o addr show dev "$iface" scope global | awk 'NR==1 {split($4,p,"/");print p[1]}')"
[[ -n "$lan" ]] || fail "No IPv4 LAN address on interface $iface"
current="$(media ps -q livekit)"
[[ -n "$current" ]] || fail "LiveKit container not found"
[[ "$(docker inspect --format '{{.HostConfig.NetworkMode}}' "$current")" == host ]] || fail "LiveKit must already be in host-network mode; use the guarded host activation first"
https_before="$(media ps -q https)"
[[ -n "$https_before" ]] || fail "HTTPS service not found"
https_id="$(docker inspect --format '{{.Id}}' "$https_before")"
health(){ curl -k -sS -o /dev/null -w '%{http_code}' --connect-timeout 2 --max-time 5 https://127.0.0.1/api/health || true; }
[[ "$(health)" == 200 ]] || fail "HTTPS unhealthy; no changes made"
media config --quiet || fail "Compose validation failed"
temp="$(mktemp -d)"
backup="/root/livekit-before-ice-filter-$(date +%Y%m%d-%H%M%S).yaml"
rollback_enabled=0
rollback(){
 if [[ "$rollback_enabled" == 1 ]]; then
  log "Restoring original LiveKit YAML and host-mode media container."
  cp -p "$backup" livekit.yaml
  media up -d --no-deps --force-recreate livekit || log "WARNING: Automatic rollback failed; restore $backup manually."
 fi
}
cleanup(){ rm -rf "$temp"; }
trap cleanup EXIT
trap rollback ERR
python3 scripts/media-ice-interface.py prepare livekit.yaml "$temp/livekit.yaml" "$iface" || fail "Could not safely prepare RTC interface filter"
cp -p livekit.yaml "$backup"
chmod 600 "$backup" "$temp/livekit.yaml"
log "Saved existing credentials and configuration at $backup"
log "Selecting only $iface ($lan). Only LiveKit will be recreated."
cp -p "$temp/livekit.yaml" livekit.yaml
rollback_enabled=1
start="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
media up -d --no-deps --force-recreate livekit
good=0
for attempt in $(seq 1 25); do
 now="$(media ps -q https)"
 [[ -n "$now" && "$(docker inspect --format '{{.Id}}' "$now")" == "$https_id" ]] || break
 current="$(media ps -q livekit)"
 [[ -n "$current" && "$(docker inspect --format '{{.State.Running}}' "$current")" == true ]] || { sleep 1; continue; }
 docker logs --since "$start" "$current" > "$temp/logs" 2>&1 || true
 # Require proven interface candidates, not just a running process.
 if python3 scripts/media-ice-interface.py check-log "$temp/logs" "$lan" >/dev/null 2>&1; then
  signal="$(curl -k -sS -o /dev/null -w '%{http_code}' --connect-timeout 2 --max-time 4 https://127.0.0.1/rtc || true)"
  if [[ "$(health)" == 200 && "$signal" != 000 && "$signal" != 502 && "$signal" != 503 && "$signal" != 504 ]]; then
   good=1
   break
  fi
 fi
 sleep 1
done
if [[ "$good" != 1 ]]; then
 log "Verification failed; Docker bridges may still be advertised (known LiveKit-version behavior)."
 log "Rollback is now restoring the previous media configuration."
 false
fi
rollback_enabled=0
trap - ERR
log "ICE interface filter active; LiveKit is using the correct LAN interface and HTTPS stayed up."
log "Real Windows/iPhone ICE still requires a call test. External networks may need port forwarding or TURN/TLS."
