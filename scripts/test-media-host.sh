#!/usr/bin/env bash
# Static regression guard; runtime Compose validation is performed in deployment.
set -Eeuo pipefail
cd "$(dirname "$0")/.."
node <<'NODE'
const fs=require('fs');
const override=fs.readFileSync('docker-compose.media-host.yml','utf8');
const compose=fs.readFileSync('docker-compose.yml','utf8');
const caddy=fs.readFileSync('Caddyfile','utf8');
const docs=fs.readFileSync('docs/media-host-network.md','utf8');
for(const line of ['network_mode: host','ports: !reset []','networks: !reset []',
 'host.docker.internal:7880','host.docker.internal:host-gateway']) {
 if(!override.includes(line)) throw Error('Missing opt-in host media setting '+line);
}
if(!compose.includes('LIVEKIT_SIGNALING_UPSTREAM: ${LIVEKIT_SIGNALING_UPSTREAM:-livekit:7880}'))throw Error('Default signaling upstream changed');
if(!caddy.includes('reverse_proxy {$LIVEKIT_SIGNALING_UPSTREAM:livekit:7880}'))throw Error('Host-media signaling proxy is not configurable');
for(const text of ['docker-compose.media-host.yml','roll back','TURN/TLS']){
 if(!docs.toLowerCase().includes(text.toLowerCase()))throw Error('Missing safety instructions: '+text);
}
console.log('Host media override and default backward compatibility checks passed');
NODE
