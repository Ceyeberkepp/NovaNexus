import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeParticipant,summarizeRoom,explainCameraState,summarizeVideoRtpStats,summarizeICETransport,advanceRemoteVideoHealth} from '../src/meeting-diagnostics.mjs';
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

test('ICE summary reports selected direct UDP route without candidate IPs',()=>{
 const report=new Map([
  ['transport',{id:'transport',type:'transport',selectedCandidatePairId:'pair'}],
  ['pair',{id:'pair',type:'candidate-pair',state:'succeeded',localCandidateId:'local',remoteCandidateId:'remote'}],
  ['local',{id:'local',type:'local-candidate',candidateType:'srflx',protocol:'udp',address:'203.0.113.99',port:9999}],
  ['remote',{id:'remote',type:'remote-candidate',candidateType:'host',address:'10.1.2.3'}]
 ]);
 const summary=summarizeICETransport(report);
 assert.deepEqual(summary,{state:'connected',candidateType:'srflx',protocol:'udp',relayed:false,remoteCandidateType:'host'});
 assert.doesNotMatch(JSON.stringify(summary),/203\\.0\\.113|10\\.1\\.2|9999/);
});
test('ICE summary recognizes a TCP TURN relay and missing path',()=>{
 const relay=new Map([
  ['pair',{id:'pair',type:'candidate-pair',state:'succeeded',nominated:true,localCandidateId:'local'}],
  ['local',{id:'local',type:'local-candidate',candidateType:'relay',protocol:'tcp'}]
 ]);
 assert.equal(summarizeICETransport(relay).relayed,true);
 assert.equal(summarizeICETransport(new Map()).state,'no-selected-pair');
 assert.equal(summarizeICETransport(null),null);
});

test('remote video health waits for repeated failures before flagging black frames',()=>{
 let state=advanceRemoteVideoHealth(null,{frames:3,packets:100});
 assert.equal(state.status,'warming-up');
 state=advanceRemoteVideoHealth(state,{frames:3,packets:101});
 assert.equal(state.status,'warming-up');
 state=advanceRemoteVideoHealth(state,{frames:3,packets:102});
 assert.equal(state.status,'warming-up');
 state=advanceRemoteVideoHealth(state,{frames:3,packets:103});
 assert.equal(state.status,'decode-stalled');
 state=advanceRemoteVideoHealth(state,{frames:4,packets:104});
 assert.equal(state.status,'receiving');
 assert.equal(state.stalledSamples,0);
});
test('remote RTP loss is distinguished from decoder stall and camera mute',()=>{
 let state=advanceRemoteVideoHealth(null,{frames:4,packets:10});
 for(let n=0;n<3;n++)state=advanceRemoteVideoHealth(state,{frames:4,packets:10});
 assert.equal(state.status,'no-video-packets');
 assert.equal(advanceRemoteVideoHealth(state,{frames:4,packets:10},false).status,'unavailable');
 assert.equal(advanceRemoteVideoHealth(state,null).status,'unavailable');
});
