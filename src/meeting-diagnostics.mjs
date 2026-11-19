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
