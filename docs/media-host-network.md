# Optional LAN + public LiveKit media without changing Cloudflare Tunnel

## Reason
The default LiveKit Docker bridge advertises 172.18.x.x as an internal
candidate, which is not reachable from a Windows computer on a 192.168.x.x
LAN. The host-media override lets LiveKit advertise the Nexus host LAN IP
as well as its STUN-discovered WAN IP. This addresses a plausible ICE routing
problem; real laptop/iPhone media still needs validation.

**Cloudflare Tunnel configuration, DNS, Caddyfile, additional-sites.caddy,
Caddy HTTPS container, TLS certificates, and application database are unchanged
by this override.** The existing HTTPS Caddy /rtc upstream still resolves
`livekit:7880`: a small private Caddy signaling bridge acquires that Docker
DNS alias and forwards HTTP/WebSocket signaling to LiveKit on the host network.
Only the LiveKit container and new internal signaling bridge change.

## Preparation
Take a Proxmox snapshot and back up `.env`, `Caddyfile`,
`additional-sites.caddy`, `livekit.yaml`. Keep your current media IP discovery
and credentials; **do not** run the one-click installer to activate this mode
because it may regenerate site files.

Check Docker Compose v2.24+ understands reset tags:
```bash
cd /opt/novanexus
docker compose -f docker-compose.yml -f docker-compose.media-host.yml config --quiet
docker compose -f docker-compose.yml -f docker-compose.media-host.yml config --format json |
  python3 -c 'import json,sys; s=json.load(sys.stdin)["services"]; assert s["livekit"].get("network_mode")=="host"; assert not s["livekit"].get("ports"); assert not s["livekit"].get("networks"); assert s["media-signaling-bridge"]["networks"]; print("Media override validated")'
```
The server's host-network ports TCP 7880/7881 and UDP 7882/3478 must be
available after removing the old LiveKit container. Nested LXC must support
Docker host networking. If validation fails, stop; do not change Caddy.

## Activate (short LiveKit call interruption, no Caddy restart)

For an existing installation already updated to this commit, use the guarded activation script:

```bash
cd /opt/novanexus
bash scripts/activate-media-host.sh
```

The script validates Compose, records the running HTTPS container identity, activates only LiveKit and the internal signaling bridge, and rolls back media services on failure. It does not modify or restart Cloudflare Tunnel or Caddy. A real two-device call is still necessary after the command.

Manual activation (if deliberately not using the guarded script):
```bash
cd /opt/novanexus
docker compose -f docker-compose.yml -f docker-compose.media-host.yml \
  up -d --no-deps --force-recreate livekit media-signaling-bridge
docker compose ps https
curl -kfsS https://192.168.0.52/api/health
```
The active calls may briefly disconnect because LiveKit is recreated. The
Cloudflare Tunnel process, routing and Caddy HTTPS service are not restarted.
Test both phone and Windows laptop in a new call. If LiveKit cannot bind host
network ports or Caddy /rtc signaling fails, **rollback**.

Always use both `-f` files when recreating media services in this mode.

## Rollback (no Caddy restart)
```bash
cd /opt/novanexus
docker compose -f docker-compose.yml -f docker-compose.media-host.yml stop livekit media-signaling-bridge
docker compose -f docker-compose.yml up -d --no-deps --force-recreate livekit
docker compose -f docker-compose.yml -f docker-compose.media-host.yml rm -sf media-signaling-bridge
docker compose ps https livekit
curl -kfsS https://192.168.0.52/api/health
```
The bridge removal step targets only the opt-in internal proxy.

## Separate TURN/TLS requirement
Cloudflare's standard HTTP Tunnel handles HTTPS and WSS signaling, **not**
UDP media or TURN/TLS transport. Restricted corporate networks still need
a separately reachable TLS TURN endpoint on TCP 443, which requires careful
SNI routing or a second external IP. The host-media override does not enable
TURN/TLS, and does not prove remote calls will succeed. Do not disable
firewalls, replace the HTTPS listener, or expose an unauthenticated relay.
