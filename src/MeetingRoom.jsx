import React, {useEffect,useState} from 'react';
import {LiveKitRoom, VideoConference, useRoomContext} from '@livekit/components-react';
import VideoSettings from './VideoSettings';
import {readChatPreferences} from './ChatPreferences';
import '@livekit/components-styles';

// The built-in conference controls provide microphone, camera, screen sharing,
// active-speaker layouts, in-room chat and a real leave button.
export default function MeetingRoom({roomId,user,onEnd}) {
  const [maxParticipants,setMaxParticipants] = useState(1000);
  const [prefs,setPrefs] = useState(()=>readChatPreferences(user?.id||0));
  const [showSettings,setShowSettings] = useState(false);
  const [workspaceLimit,setWorkspaceLimit] = useState(1000);
  useEffect(()=>{let active=true;fetch('/api/workspace/settings',{credentials:'same-origin'}).then(r=>r.json()).then(data=>{const max=Number(data?.settings?.default_meeting_limit);if(active&&Number.isInteger(max)&&max>=1&&max<=1000){setMaxParticipants(max);setWorkspaceLimit(max);}}).catch(()=>{});return ()=>{active=false;};},[]);
  const [connection,setConnection] = useState(null);
  const [error,setError] = useState('');
  const [loading,setLoading] = useState(false);
  const [ended,setEnded] = useState(false);
  const [copyFeedback,setCopyFeedback] = useState('');
  const shareUrl=window.location.origin+'/?room='+encodeURIComponent(roomId||'');
  async function copyInvite(){try{await navigator.clipboard.writeText(shareUrl);setCopyFeedback('Invite link copied.');}catch{setCopyFeedback('Select and copy the invite link below.');}}

  async function join() {
    if(!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(roomId||'')) {
      setError('Meeting ID must use letters, numbers, - or _ (maximum 80 characters).');
      return;
    }
    if(!Number.isInteger(maxParticipants)||maxParticipants<1||maxParticipants>workspaceLimit){
      setError("Meeting capacity must be between 1 and the administrator's configured limit.");
      return;
    }
    setLoading(true);setError('');
    try {
      const response=await fetch('/api/meetings/token',{
        method:'POST',
        credentials:'same-origin',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({room:roomId,maxParticipants})
      });
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||'Unable to join meeting');
      setConnection(data);
    }catch(err){setError(err.message||'Video connection unavailable');}
    finally{setLoading(false);}
  }
  const leave=()=>{setEnded(true);onEnd();};
  if(connection&&!ended)return <div className="h-screen w-screen bg-zinc-950 text-white relative" data-lk-theme="default">
    <div className="absolute top-3 left-3 z-50 rounded-xl bg-zinc-900/90 border border-white/10 text-white p-2 flex flex-wrap items-center gap-2 text-xs"><span className="font-semibold">Meeting: {roomId}</span><button className="rounded-lg bg-indigo-600 px-3 py-2" onClick={copyInvite}>Copy invite link</button><button className="rounded-lg border border-zinc-600 px-3 py-2" onClick={()=>setShowSettings(true)}>Meeting Settings</button>{copyFeedback&&<span role="status">{copyFeedback}</span>}</div>
    <LiveKitRoom
      serverUrl={connection.serverUrl}
      token={connection.token}
      connect={true}
      audio={prefs.callMicEnabled===false?false:{echoCancellation:prefs.callEchoCancellation!==false,noiseSuppression:prefs.callNoiseSuppression!==false,...(prefs.callAudioDevice?{deviceId:prefs.callAudioDevice}:{})}}
      video={prefs.callCamEnabled===false?false:{resolution:({ '360p':{width:640,height:360}, '720p':{width:1280,height:720}, '1080p':{width:1920,height:1080}}[prefs.callQuality]||{width:1280,height:720}),...(prefs.callVideoDevice?{deviceId:prefs.callVideoDevice}:{})}}
      onDisconnected={leave}
      onError={(e)=>setError(e?.message||'Connection failed')}
      style={{height:'100%'}}>
      <VideoConference />
      {showSettings&&<ConnectedSettings userId={user?.id||0} settings={prefs} onSave={setPrefs} onClose={()=>setShowSettings(false)}/>}
    </LiveKitRoom>
    {error&&<div role="alert" className="fixed bottom-6 left-6 z-50 bg-red-800 text-white p-3 rounded-lg">{error}</div>}
  </div>;
  return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-5">
    <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl p-8 space-y-5">
      <h1 className="text-2xl font-bold">NovaNexus Video Meeting</h1>
      <div className="text-slate-300">Room: <strong>{roomId}</strong></div>
      <div className="text-slate-300">Signed in as {user?.name||'Member'}</div><button className="rounded-lg border border-slate-500 px-4 py-2 text-sm" onClick={()=>setShowSettings(true)}>Video &amp; Audio Settings</button>
      <label className="grid gap-2 text-sm">Share meeting link<input aria-label="Meeting invitation link" readOnly className="w-full rounded-lg text-slate-900 p-3" value={shareUrl}/></label><button type="button" onClick={copyInvite} className="rounded-lg border border-slate-500 px-4 py-2 text-sm">Copy meeting link</button>{copyFeedback&&<p role="status" className="text-sm text-slate-300">{copyFeedback}</p>}
      <label className="grid gap-2 font-medium" htmlFor="meeting-limit">
        Maximum participants (1–{workspaceLimit})
        <input id="meeting-limit" className="w-full rounded-lg text-slate-900 p-3"
          type="number" min={1} max={workspaceLimit} step={1} value={maxParticipants}
          onChange={e=>setMaxParticipants(Number(e.target.value))} />
      </label>
      <p className="text-xs text-slate-400">
        Capacity is configurable up to 1000; actual simultaneous audio/video capacity
        depends on server resources, bandwidth and browser conditions.
      </p>
      {error&&<div role="alert" className="rounded-lg bg-red-900 p-3">{error}</div>}
      {showSettings&&<VideoSettings userId={user?.id||0} settings={prefs} onSave={setPrefs} onClose={()=>setShowSettings(false)}/>}
      <div className="flex gap-3">
        <button onClick={join} disabled={loading} className="flex-1 rounded-lg bg-indigo-600 p-3 font-semibold disabled:opacity-60">{loading?'Connecting...':'Join Meeting'}</button>
        <button onClick={onEnd} className="rounded-lg border border-slate-600 p-3">Back</button>
      </div>
    </div>
  </div>;
}

function ConnectedSettings(props){
 const room=useRoomContext();
 return <VideoSettings {...props} room={room}/>;
}
