#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")/.."
node <<'NODE'
const fs=require('fs');
const override=fs.readFileSync('docker-compose.media-host.yml','utf8');
const base=fs.readFileSync('docker-compose.yml','utf8');
const proxy=fs.readFileSync('Caddyfile','utf8');
const bridge=fs.readFileSync('media-signaling.Caddyfile','utf8');
const docs=fs.readFileSync('docs/media-host-network.md','utf8');
for(const value of ['network_mode: host','ports: !reset []','networks: !reset []','media-signaling-bridge:','host.docker.internal:host-gateway','- livekit']) {
 if(!override.includes(value))throw Error('Missing host media topology: '+value);
}
if(!bridge.includes('reverse_proxy host.docker.internal:7880'))throw Error('Bridge target missing');
if(!proxy.includes('reverse_proxy {$LIVEKIT_SIGNALING_UPSTREAM:livekit:7880}'))throw Error('Default Caddy upstream changed');
if(!base.includes('LIVEKIT_SIGNALING_UPSTREAM: ${LIVEKIT_SIGNALING_UPSTREAM:-livekit:7880}'))throw Error('Default proxy environment changed');
for(const required of ['Cloudflare Tunnel','Rollback','no Caddy restart']){
 if(!docs.toLowerCase().includes(required.toLowerCase()))throw Error('Missing safety documentation: '+required);
}
console.log('LAN host media + Caddy-preserving signaling bridge static checks passed.');
NODE
