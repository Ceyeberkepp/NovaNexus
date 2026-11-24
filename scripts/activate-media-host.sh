#!/usr/bin/env bash
# Opt-in LAN media activation with rollback. Preserves HTTPS Caddy and Cloudflare Tunnel.
set -Eeuo pipefail
cd "$(dirname "$0")/.."
base(){ docker compose -f docker-compose.yml "$@"; }
media(){ docker compose -f docker-compose.yml -f docker-compose.media-host.yml "$@"; }
log(){ printf '[Nexus media] %s\n' "$*"; }
fail(){ printf '[Nexus media] ERROR: %s\n' "$*" >&2; exit 1; }
[[ -f livekit.yaml && -f .env && -f media-signaling.Caddyfile ]] || fail "LiveKit runtime files missing."
command -v python3 >/dev/null || fail "Python 3 required for safe Compose validation."
base config --quiet || fail "Original Compose configuration invalid."
media config --quiet || fail "Media Compose override invalid."
media config --format json | python3 -c '
import json,sys
services=json.load(sys.stdin)["services"]
lk=services["livekit"]
assert lk.get("network_mode")=="host"
assert not lk.get("ports") and not lk.get("networks")
assert "media-signaling-bridge" in services and "https" in services
' || fail "Unsafe media Compose configuration; no changes made."
https_before="$(base ps -q https)"
[[ -n "$https_before" ]] || fail "HTTPS Caddy not running."
https_id="$(docker inspect -f '{{.Id}}' "$https_before")"
health(){ curl -k -sS -o /dev/null -w '%{http_code}' --connect-timeout 2 --max-time 5 https://127.0.0.1/api/health || true; }
[[ "$(health)" == 200 ]] || fail "Existing HTTPS health failed; no changes made."
rollback_enabled=0
rollback(){
 if [[ "$rollback_enabled" == 1 ]]; then
  log "Rolling back media services; HTTPS and tunnel unchanged."
  media stop livekit media-signaling-bridge >/dev/null 2>&1 || true
  base up -d --no-deps --force-recreate livekit >/dev/null 2>&1 || true
  media rm -sf media-signaling-bridge >/dev/null 2>&1 || true
 fi
}
trap rollback ERR
rollback_enabled=1
log "Activating host-networked LiveKit and internal signaling bridge only."
media up -d --no-deps --force-recreate livekit media-signaling-bridge
healthy=0
for attempt in $(seq 1 20); do
 current="$(base ps -q https)"
 [[ -n "$current" ]] || break
 [[ "$(docker inspect -f '{{.Id}}' "$current")" == "$https_id" ]] || break
 running="$(media ps --status running --services 2>/dev/null || true)"
 signal="$(curl -k -sS -o /dev/null -w '%{http_code}' --connect-timeout 2 --max-time 4 https://127.0.0.1/rtc || true)"
 if [[ "$(health)" == 200 ]] && grep -qx livekit <<<"$running" && grep -qx media-signaling-bridge <<<"$running" &&
    [[ "$signal" != 000 && "$signal" != 502 && "$signal" != 503 && "$signal" != 504 ]]; then
   healthy=1
   break
 fi
 sleep 1
done
[[ "$healthy" == 1 ]] || { log "Media signaling failed; restoring previous LiveKit mode."; false; }
trap - ERR
rollback_enabled=0
log "HTTP signaling verified and HTTPS container preserved. Confirm a real two-way video call."
