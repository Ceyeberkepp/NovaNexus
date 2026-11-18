// The browser's actual origin is the correct signaling endpoint, including
// behind a Cloudflare Tunnel that rewrites the upstream HTTP Host header.
export function liveKitSignalingOrigin(location) {
 const protocol=location?.protocol==='https:'?'wss:':location?.protocol==='http:'?'ws:':null;
 if(!protocol||!location?.host)throw new Error('A valid browser HTTP(S) origin is required for calls');
 return protocol+'//'+location.host;
}
