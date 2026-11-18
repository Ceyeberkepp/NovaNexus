import test from 'node:test';
import assert from 'node:assert/strict';
import {liveKitSignalingOrigin} from '../src/meeting-origin.mjs';

test('Cloudflare tunnel calls stay on the public HTTPS origin',()=>{
 assert.equal(liveKitSignalingOrigin({protocol:'https:',host:'nexus.cyverax.com'}),'wss://nexus.cyverax.com');
});
test('LAN calls use the existing LAN IP only',()=>{
 assert.equal(liveKitSignalingOrigin({protocol:'https:',host:'192.168.0.52'}),'wss://192.168.0.52');
});
test('development supports HTTP and explicit alternate development port',()=>{
 assert.equal(liveKitSignalingOrigin({protocol:'http:',host:'localhost:5173'}),'ws://localhost:5173');
});
test('reject unsupported browser schemes',()=>{
 assert.throws(()=>liveKitSignalingOrigin({protocol:'file:',host:''}));
});
