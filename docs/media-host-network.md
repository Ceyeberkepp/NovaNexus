# LAN + internet LiveKit media on a single Nexus server

## Why this mode exists

In the default Compose deployment, LiveKit runs on the isolated Docker bridge
(e.g. `172.18.0.3`). Even with `rtc.advertise_internal_ip: true`, that is
**not** the server's reachable LAN address (`192.168.0.52` in one installation).
The other advertised candidate is the server's STUN-discovered public address.
A LAN browser on a network without working NAT hairpin may reach neither.
This optional mode moves **only LiveKit** to the Linux host network namespace.
The other five services, database volumes, HTTPS routes and credentials remain
on their existing Docker network.

This is a targeted mitigation for LAN media failures, not a guarantee of working
WebRTC over restrictive networks. **Cloudflare HTTP Tunnel carries signaling,
not LiveKit UDP/TCP media; TURN/TLS still needs a distinct reachable TCP 443
endpoint for UDP-blocking clients.** A working phone does not validate a laptop.

## Before use

1. Take a VM/LXC snapshot and back up `.env`, `Caddyfile`,
   `additional-sites.caddy`, and `livekit.yaml`.
2. Confirm host networking is supported by your nested LXC. Do not modify
   router NAT, disable firewalls, or disable unrelated security policies.
3. Run the exact configuration validation first:

```sh
cd /opt/novanexus
docker compose -f docker-compose.yml -f docker-compose.media-host.yml config --quiet
docker compose -f docker-compose.yml -f docker-compose.media-host.yml config |
  sed -n '/^  livekit:/,/^  [a-z]/p'
```

Confirm the effective livekit service has `network_mode: host` and **no**
`ports` or `networks` settings. If not, stop; your Docker Compose version
doesn't correctly apply the override. Check ports 7880/TCP, 7881/TCP,
7882/UDP and 3478/UDP will be available after the old LiveKit container stops.

## Activate (opt-in only)

```sh
cd /opt/novanexus
docker compose -f docker-compose.yml -f docker-compose.media-host.yml \
  up -d --no-deps --force-recreate livekit https
docker compose -f docker-compose.yml -f docker-compose.media-host.yml ps
curl -kfsS https://127.0.0.1/api/health
```

Caddy's `/rtc` proxy now reaches host-networked LiveKit using Docker's
`host-gateway` mapping. Recreating Caddy briefly interrupts active sessions.
Check LiveKit's observed **advertised ICE candidates** include the server's
LAN IPv4 and the correct public IPv4; do not publish raw SDP or credentials.

**Use the same two-file Compose invocation on subsequent upgrades and restarts.**
Calling `docker compose up` without the override may revert the media topology.

## Roll back

```sh
cd /opt/novanexus
docker compose -f docker-compose.yml -f docker-compose.media-host.yml stop livekit https
docker compose -f docker-compose.yml up -d --no-deps --force-recreate livekit https
docker compose ps
curl -kfsS https://127.0.0.1/api/health
```

Keep the `livekit.yaml` credentials and `rtc.use_external_ip` unchanged during
this transition. If a public ICE address differs from your inbound-forwarded
gateway, resolve that independently; never blindly pin a LAN IP as the only
`node_ip`, which can disconnect remote callers.

## TURN/TLS limitation

Caddy listening on HTTPS/TCP 443 cannot turn HTTP traffic into TURN/TLS.
On a *single public IP*, proper TURN/TLS on TCP 443 requires a dedicated
TCP-layer SNI router (or separate public IP), a valid certificate for a TURN
hostname, and an ingress path that bypasses Cloudflare's HTTP Tunnel. No
automatic TURN/TLS enablement is claimed by this optional configuration.
