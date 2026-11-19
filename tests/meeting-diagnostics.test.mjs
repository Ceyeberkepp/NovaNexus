import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeParticipant,summarizeRoom,explainCameraState,summarizeVideoRtpStats} from '../src/meeting-diagnostics.mjs';
const mock=(pubs,isLocal=false)=>({name:isLocal?'Me':'Remote',isLocal,trackPublications:new Map(pubs)});
test('distinguishes remote unpublished from subscription failure',()=>{
 const absent=summarizeParticipant(mock([]));
 assert.equal(absent.cameraState,'not-published');
 const waiting=summarizeParticipant(mock([['cam',{source:'camera',isSubscribed:false,isMuted:false}]]));
 assert.equal(waiting.cameraState,'not-subscribed');
 assert.match(explainCameraState(waiting.cameraState),/subscription/);
});
test('does not confuse camera muted with a disconnected remote video',()=>{
 const muted=summarizeParticipant(mock([['cam',{source:'camera',isMuted:true,isSubscribed:false}]]));
 assert.equal(muted.cameraState,'camera-off');
});
test('reports a subscribed and live camera video track as active',()=>{
 const active=summarizeParticipant(mock([['cam',{source:'camera',isSubscribed:true,track:{mediaStreamTrack:{readyState:'live'}}}]]));
 assert.equal(active.cameraState,'video-active');
 assert.equal(active.cameraSubscribed,true);
 const ended=summarizeParticipant(mock([['cam',{source:'camera',isSubscribed:true,track:{mediaStreamTrack:{readyState:'ended'}}}]]));
 assert.equal(ended.cameraState,'track-ended');
});
test('summarizes remote and local cameras without ICE/IP or token data',()=>{
 const room={state:'connected',localParticipant:mock([['cam',{source:'camera',track:{}}]],true),remoteParticipants:new Map([['r',mock([])]])};
 const report=summarizeRoom(room);
 assert.equal(report.remoteCount,1);
 assert.equal(report.participants.length,2);
 assert.equal(report.participants[0].isLocal,true);
 assert.equal(JSON.stringify(report).includes('token'),false);
});

test('incoming video frame statistics distinguish published tracks from decoded media',()=>{
 const stats=new Map([['v',{type:'inbound-rtp',kind:'video',packetsReceived:250,bytesReceived:150000,framesDecoded:98}],['audio',{type:'inbound-rtp',kind:'audio',packetsReceived:500}]]);
 const result=summarizeVideoRtpStats(stats,false);
 assert.deepEqual(result,{direction:'incoming',streams:1,packets:250,bytes:150000,frames:98});
});
test('video without received RTP frames is still not confirmed viewable',()=>{
 const stats=new Map([['v',{type:'inbound-rtp',kind:'video',packetsReceived:0,bytesReceived:0,framesDecoded:0}]]);
 const result=summarizeVideoRtpStats(stats,false);
 assert.equal(result.frames,0);
 assert.equal(result.packets,0);
});
test('outgoing RTP statistics use frames encoded and exclude non-video tracks',()=>{
 const stats=new Map([['v',{type:'outbound-rtp',kind:'video',packetsSent:40,bytesSent:80000,framesEncoded:35}],['audio',{type:'outbound-rtp',kind:'audio',packetsSent:1000}]]);
 assert.deepEqual(summarizeVideoRtpStats(stats,true),{direction:'outgoing',streams:1,packets:40,bytes:80000,frames:35});
});
