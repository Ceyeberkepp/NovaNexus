// Pure, privacy-preserving snapshot of LiveKit room media state.
// Never collect SDP, IP addresses, ICE passwords, tokens, or identities.
export function summarizeParticipant(participant, cameraSource='camera') {
  const publications=Array.from(participant?.trackPublications?.values?.()||[]);
  const camera=publications.find(p=>p.source===cameraSource);
  const isLocal=!!participant?.isLocal;
  const cameraTrack=camera?.track;
  let cameraState='not-published';
  if(camera?.isMuted)cameraState='camera-off';
  else if(!camera)cameraState='not-published';
  else if(!isLocal && camera?.isSubscribed===false)cameraState='not-subscribed';
  else if(!cameraTrack)cameraState=isLocal?'publishing':'waiting-for-track';
  else if(cameraTrack.mediaStreamTrack?.readyState==='ended')cameraState='track-ended';
  else if(cameraTrack.isMuted)cameraState='camera-off';
  else cameraState='video-active';
  return {
    name:String(participant?.name||participant?.identity||'Participant').slice(0,80),
    participantKey:String(participant?.sid||participant?.identity||''),
    isLocal,
    cameraState,
    cameraPublished:!!camera,
    cameraSubscribed:isLocal?null:camera?.isSubscribed===true,
    cameraMuted:!!camera?.isMuted
  };
}
export function explainCameraState(state) {
  switch(state){
    case 'video-active':return 'Camera track connected';
    case 'camera-off':return 'Camera is off or muted';
    case 'not-subscribed':return 'Waiting for remote video subscription';
    case 'waiting-for-track':return 'Remote video track has not arrived';
    case 'publishing':return 'Camera is starting';
    case 'track-ended':return 'Camera track ended unexpectedly';
    default:return 'No camera track published';
  }
}
export function summarizeRoom(room){
  const local=room?.localParticipant;
  const remote=Array.from(room?.remoteParticipants?.values?.()||[]);
  return {
    connectionState:String(room?.state||'unknown'),
    participants:[...(local?[summarizeParticipant(local)]:[]),...remote.map(p=>summarizeParticipant(p))],
    remoteCount:remote.length
  };
}

export function summarizeVideoRtpStats(report,isLocal=false) {
 if(!report||typeof report.forEach!=='function')return null;
 const direction=isLocal?'outbound-rtp':'inbound-rtp';
 let packets=0,bytes=0,frames=0,streams=0;
 report.forEach(stat=>{
  if(stat.type!==direction || !(['video',undefined].includes(stat.kind) && (stat.kind==='video'||stat.mediaType==='video')))return;
  if(stat.isRemote) return;
  streams++;
  packets+=Math.max(0,Number(isLocal?stat.packetsSent:stat.packetsReceived)||0);
  bytes+=Math.max(0,Number(isLocal?stat.bytesSent:stat.bytesReceived)||0);
  frames+=Math.max(0,Number(isLocal?stat.framesEncoded:stat.framesDecoded)||0);
 });
 return streams?{direction:isLocal?'outgoing':'incoming',streams,packets,bytes,frames}:null;
}


// Read only non-identifying ICE transport information. In particular, do not
// report local/remote addresses, ports, SDP or network identifiers.
export function summarizeICETransport(report) {
 if(!report||typeof report.forEach!=='function')return null;
 const stats=new Map();
 report.forEach((entry,key)=>stats.set(entry.id||key,entry));
 let selected=null;
 report.forEach(entry=>{
  if(entry.type==='transport'&&entry.selectedCandidatePairId)selected=stats.get(entry.selectedCandidatePairId)||selected;
 });
 if(!selected)report.forEach(entry=>{
  if(entry.type==='candidate-pair'&&entry.state==='succeeded'&&(entry.nominated||entry.selected))selected=entry;
 });
 if(!selected)return {state:'no-selected-pair'};
 const local=stats.get(selected.localCandidateId);
 const remote=stats.get(selected.remoteCandidateId);
 const type=local?.candidateType;
 const safeType=['host','srflx','prflx','relay'].includes(type)?type:'unknown';
 const protocol=String(local?.protocol||'').toLowerCase();
 return {
  state:selected.state==='succeeded'?'connected':'checking',
  candidateType:safeType,
  protocol:['udp','tcp'].includes(protocol)?protocol:'unknown',
  relayed:safeType==='relay',
  remoteCandidateType:['host','srflx','prflx','relay'].includes(remote?.candidateType)?remote.candidateType:'unknown'
 };
}


// A remote video track can remain "live" while its RTP media stops arriving
// or decoding. Require three consecutive non-progressing samples (~12 seconds
// at the call-health sampling cadence) before reporting a stall. The first
// sample alone cannot establish whether the camera is stalled.
export function advanceRemoteVideoHealth(previous,stats,active=true) {
 if(!active||!stats||!Number.isFinite(stats.frames)||!Number.isFinite(stats.packets))
  return {lastFrames:null,lastPackets:null,stalledSamples:0,status:'unavailable'};
 const frames=Math.max(0,stats.frames);
 const packets=Math.max(0,stats.packets);
 if(!previous||previous.lastFrames===null||previous.lastPackets===null)
  return {lastFrames:frames,lastPackets:packets,stalledSamples:0,status:'warming-up'};
 // A replaced/renegotiated track can reset RTP counters; treat it as a new
 // baseline rather than incorrectly reporting a persistent black tile.
 if(frames<previous.lastFrames||packets<previous.lastPackets)
  return {lastFrames:frames,lastPackets:packets,stalledSamples:0,status:'warming-up'};
 if(frames>previous.lastFrames)
  return {lastFrames:frames,lastPackets:packets,stalledSamples:0,status:'receiving'};
 const stalledSamples=(previous.stalledSamples||0)+1;
 const status=stalledSamples>=3
  ? (packets>previous.lastPackets?'decode-stalled':'no-video-packets')
  : 'warming-up';
 return {lastFrames:frames,lastPackets:packets,stalledSamples,status};
}
