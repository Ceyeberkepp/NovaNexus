import React, {useEffect,useRef,useState} from 'react';
import {LiveKitRoom, useRoomContext} from '@livekit/components-react';
import ConferenceStage from './ConferenceStage';
import {liveKitSignalingOrigin} from './meeting-origin.mjs';
import VideoSettings from './VideoSettings';
import MeetingExtras from './MeetingExtras';
import {readChatPreferences} from './ChatPreferences';
import '@livekit/components-styles';

// The built-in conference controls provide microphone, camera, screen sharing,
// active-speaker layouts, in-room chat and a real leave button.
export default function MeetingRoom({roomId,user,onEnd,autoJoin=false,audioOnly=false,initialConnection=null}) {
  const [maxParticipants,setMaxParticipants] = useState(1000);
  const [prefs,setPrefs] = useState(()=>readChatPreferences(user?.id||0));
  const [showSettings,setShowSettings] = useState(false);
  const [activeBreakoutId,setActiveBreakoutId] = useState(0);
  const switchingRef=useRef(false);
  const autostartedRef=useRef(false);
  const retryTimerRef=useRef(null);
  const retryAttemptsRef=useRef(0);
  const activeRoomRef=useRef(true);
  const [reconnecting,setReconnecting]=useState(false);
  useEffect(()=>()=>{activeRoomRef.current=false;if(retryTimerRef.current)clearTimeout(retryTimerRef.current)},[]);
  const [workspaceLimit,setWorkspaceLimit] = useState(1000);
  const [meetingBaseURL,setMeetingBaseURL]=useState(window.location.origin);
  useEffect(()=>{let active=true;fetch('/api/workspace/settings',{credentials:'same-origin'}).then(r=>r.json()).then(data=>{const max=Number(data?.settings?.default_meeting_limit);if(active&&Number.isInteger(max)&&max>=1&&max<=1000){setMaxParticipants(max);setWorkspaceLimit(max);}const requested=String(data?.settings?.meeting_public_url||'');if(active&&requested.startsWith('https://'))setMeetingBaseURL(requested.replace(/\/$/ ,''));}).catch(()=>{});return ()=>{active=false;};},[]);
  const [connection,setConnection] = useState(initialConnection);
  const [error,setError] = useState('');
  const [loading,setLoading] = useState(false);
  const [ended,setEnded] = useState(false);
  const [copyFeedback,setCopyFeedback] = useState('');
  const [meetingPassword,setMeetingPassword] = useState('');
  const [hostPassword,setHostPassword] = useState('');
  const [passwordFeedback,setPasswordFeedback] = useState('');
  const shareUrl=meetingBaseURL+'/'+encodeURIComponent(roomId||'');
  async function copyInvite(){try{await navigator.clipboard.writeText(shareUrl);setCopyFeedback('Invite link copied.');}catch{setCopyFeedback('Select and copy the invite link below.');}}

  async function join(breakoutID=0,useServerCapacity=false) {
    if(!/^[0-9]{8}$/.test(roomId||'')) {
      setError('Meeting ID must be exactly 8 digits.');
      return;
    }
    if(!useServerCapacity&&(!Number.isInteger(maxParticipants)||maxParticipants<1||maxParticipants>workspaceLimit)){
      setError("Meeting capacity must be between 1 and the administrator's configured limit.");
      return;
    }
    setLoading(true);setError('');
    try {
      const response=await fetch('/api/meetings/token',{
        method:'POST',
        credentials:'same-origin',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({room:roomId,password:meetingPassword,maxParticipants:useServerCapacity?0:maxParticipants,breakoutID})
      });
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||'Unable to join meeting');
      setActiveBreakoutId(breakoutID);
      // Use the hostname visible to the participant's browser. The
      // Cloudflare Tunnel overrides upstream Host to the appliance IP,
      // which must not be returned as a WebSocket destination to public
      // participants. Caddy proxies /rtc at this browser origin.
      setConnection({...data,serverUrl:liveKitSignalingOrigin(window.location)});
    }catch(err){setError(err.message||'Video connection unavailable');}
    finally{setLoading(false);}
  }
  const leave=()=>{
    activeRoomRef.current=false;
    if(retryTimerRef.current){clearTimeout(retryTimerRef.current);retryTimerRef.current=null;}
    setEnded(true);onEnd();
  };
  function recoverConnection(message){
    if(!activeRoomRef.current||switchingRef.current)return;
    setConnection(null);
    setError(message);
    if(retryTimerRef.current||retryAttemptsRef.current>=2){setReconnecting(false);return;}
    retryAttemptsRef.current+=1;
    const attempt=retryAttemptsRef.current;
    setReconnecting(true);
    retryTimerRef.current=window.setTimeout(async()=>{
      retryTimerRef.current=null;
      if(!activeRoomRef.current)return;
      // Fetch a fresh room token; never reuse the previous failed WebRTC
      // connection or interrupt LiveKit's built-in transient reconnection.
      await join(activeBreakoutId,true);
      if(activeRoomRef.current)setReconnecting(false);
    },1500*attempt);
  }
  async function switchBreakout(id){
    if(id===activeBreakoutId)return;
    switchingRef.current=true;
    await join(id,true);
    window.setTimeout(()=>{switchingRef.current=false;},1700);
  }
  useEffect(()=>{if(autoJoin&&!initialConnection&&!autostartedRef.current&&/^[0-9]{8}$/.test(roomId)){autostartedRef.current=true;join(0,true);}},[autoJoin,roomId]);

  if(connection&&!ended)return <div className="h-screen w-screen bg-zinc-950 text-white relative" data-lk-theme="default">
    <div className="absolute top-3 left-3 z-50 rounded-xl bg-zinc-900/90 border border-white/10 text-white p-2 flex flex-wrap items-center gap-2 text-xs"><span className="font-semibold">Meeting: {roomId}{activeBreakoutId>0?` · Breakout ${activeBreakoutId}`:""}</span>{copyFeedback&&<span role="status">{copyFeedback}</span>}</div>
    <LiveKitRoom
      key={activeBreakoutId}
      serverUrl={connection.serverUrl}
      token={connection.token}
      connect={true}
      audio={audioOnly?true:(prefs.callMicEnabled===false?false:{echoCancellation:prefs.callEchoCancellation!==false,noiseSuppression:prefs.callNoiseSuppression!==false,...(prefs.callAudioDevice?{deviceId:prefs.callAudioDevice}:{})})}
      video={audioOnly?false:prefs.callCamEnabled===false?false:{resolution:({ '360p':{width:640,height:360}, '720p':{width:1280,height:720}, '1080p':{width:1920,height:1080}}[prefs.callQuality]||{width:1280,height:720}),...(prefs.callVideoDevice?{deviceId:prefs.callVideoDevice}:{})}}
      onDisconnected={()=>recoverConnection('Call disconnected. Trying to restore the media connection. If retries fail, check LiveKit ICE/TURN reachability.')}
      onError={(e)=>{
        const raw=String(e?.message||'Connection failed');
        const iceFailed=/pc connection|peer connection|ice|candidate|connectivity|transport/i.test(raw);
        if(iceFailed){
          recoverConnection('Media connection failed (WebRTC/ICE). Nexus is attempting to reconnect. If your work firewall blocks direct UDP/TCP media, a reachable TURN/TLS relay is required. Details: '+raw);
        }else{
          setReconnecting(false);setConnection(null);
          setError('Unable to connect to the meeting server: '+raw);
        }
      }}
      style={{height:'100%'}}>
      <ConferenceStage roomId={roomId} onEnd={leave}/>
      {!user?.isGuest&&<MeetingExtras shareUrl={shareUrl} roomId={roomId} maxParticipants={connection.maxParticipants} user={user} isHost={connection.isHost} onOpenSettings={()=>setShowSettings(true)} onSwitchBreakout={switchBreakout} activeBreakoutId={activeBreakoutId}/>}
      {showSettings&&<ConnectedSettings userId={user?.id||0} settings={prefs} onSave={setPrefs} onClose={()=>setShowSettings(false)}/>}
    </LiveKitRoom>
    {error&&<div role="alert" className="fixed bottom-6 left-6 z-50 bg-red-800 text-white p-3 rounded-lg">{error}</div>}
  </div>;
  return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-5">
    <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl p-8 space-y-5">
      <h1 className="text-2xl font-bold">Nexus Workspace Video Meeting</h1>
      {reconnecting&&<div role="status" className="rounded-lg bg-indigo-900/60 p-3 text-sm font-medium text-indigo-100">Reconnecting to your meeting automatically… attempt {retryAttemptsRef.current} of 2.</div>}
      <div className="text-slate-300">Room: <strong>{roomId}</strong></div>
      <div className="text-slate-300">Signed in as {user?.name||'Member'}</div><button className="rounded-lg border border-slate-500 px-4 py-2 text-sm" onClick={()=>setShowSettings(true)}>Video &amp; Audio Settings</button>
      <label className="grid gap-2 text-sm">Share meeting link<input aria-label="Meeting invitation link" readOnly className="w-full min-w-0 rounded-lg border border-slate-600 bg-white p-3 text-sm font-semibold text-slate-900" value={shareUrl}/></label><button type="button" onClick={copyInvite} className="rounded-lg border border-slate-500 px-4 py-2 text-sm">Copy meeting link</button>{copyFeedback&&<p role="status" className="text-sm text-slate-300">{copyFeedback}</p>}
      {!user?.isGuest&&<label className="grid gap-2 text-sm">Meeting password (if required)
        <input type="password" autoComplete="off" value={meetingPassword} onChange={e=>setMeetingPassword(e.target.value)} className="rounded-lg border border-slate-600 bg-white p-3 text-slate-900"/>
      </label>}
      {!user?.isGuest&&<form className="space-y-2" onSubmit={async e=>{
        e.preventDefault();setPasswordFeedback('');
        const r=await fetch('/api/meetings/password',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({room:roomId,password:hostPassword})});
        const d=await r.json().catch(()=>({}));setPasswordFeedback(r.ok?'Meeting password updated.':d.error||'Unable to update meeting password');
      }}>
        <label className="grid gap-2 text-sm">Host: set or remove meeting password
          <input type="password" autoComplete="new-password" minLength={6} value={hostPassword} onChange={e=>setHostPassword(e.target.value)} placeholder="6+ characters; leave blank to remove" className="rounded-lg border border-slate-600 bg-white p-3 text-slate-900"/>
        </label>
        <button type="submit" className="rounded-lg border border-slate-500 px-4 py-2 text-sm">Update password (host only)</button>
        {passwordFeedback&&<p role="status">{passwordFeedback}</p>}
      </form>}
      <label className="grid gap-2 font-medium" htmlFor="meeting-limit">
        Maximum participants (1–{workspaceLimit})
        <input id="meeting-limit" className="w-full rounded-lg border border-slate-600 bg-white p-3 font-semibold text-slate-900"
          type="number" min={1} max={workspaceLimit} step={1} value={maxParticipants}
          onChange={e=>setMaxParticipants(Number(e.target.value))} />
      </label>
      <p className="text-xs text-slate-400">
        Capacity is configurable up to 1000; actual simultaneous audio/video capacity
        depends on server resources, bandwidth and browser conditions.
      </p>
      {error&&<div role="alert" className="rounded-lg border border-rose-500/30 bg-rose-900/90 p-4 text-sm leading-6 text-white">{error}</div>}
      {showSettings&&<VideoSettings userId={user?.id||0} settings={prefs} onSave={setPrefs} onClose={()=>setShowSettings(false)}/>}
      <div className="flex gap-3">
        <button onClick={()=>join()} disabled={loading} className="flex-1 rounded-lg bg-indigo-600 p-3 font-semibold disabled:opacity-60">{loading?'Connecting...':'Join Meeting'}</button>
        <button onClick={onEnd} className="rounded-lg border border-slate-600 p-3">Back</button>
      </div>
    </div>
  </div>;
}

function ConnectedSettings(props){
 const room=useRoomContext();
 return <VideoSettings {...props} room={room}/>;
}
