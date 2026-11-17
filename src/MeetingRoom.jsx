import React, {useEffect,useState} from 'react';
import {LiveKitRoom, VideoConference} from '@livekit/components-react';
import '@livekit/components-styles';

// The built-in conference controls provide microphone, camera, screen sharing,
// active-speaker layouts, in-room chat and a real leave button.
export default function MeetingRoom({roomId,user,onEnd}) {
  const [maxParticipants,setMaxParticipants] = useState(1000);
  const [workspaceLimit,setWorkspaceLimit] = useState(1000);
  useEffect(()=>{let active=true;fetch('/api/workspace/settings',{credentials:'same-origin'}).then(r=>r.json()).then(data=>{const max=Number(data?.settings?.default_meeting_limit);if(active&&Number.isInteger(max)&&max>=1&&max<=1000){setMaxParticipants(max);setWorkspaceLimit(max);}}).catch(()=>{});return ()=>{active=false;};},[]);
  const [connection,setConnection] = useState(null);
  const [error,setError] = useState('');
  const [loading,setLoading] = useState(false);
  const [ended,setEnded] = useState(false);

  async function join() {
    if(!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(roomId||'')) {
      setError('Meeting ID must use letters, numbers, - or _ (maximum 80 characters).');
      return;
    }
    if(!Number.isInteger(maxParticipants)||maxParticipants<1||maxParticipants>workspaceLimit){
      setError('Meeting capacity must be between 1 and the administrator's configured limit.');
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
  if(connection&&!ended)return <div className="h-screen w-screen bg-zinc-950 text-white" data-lk-theme="default">
    <LiveKitRoom
      serverUrl={connection.serverUrl}
      token={connection.token}
      connect={true}
      audio={true}
      video={true}
      onDisconnected={leave}
      onError={(e)=>setError(e?.message||'Connection failed')}
      style={{height:'100%'}}>
      <VideoConference />
    </LiveKitRoom>
    {error&&<div role="alert" className="fixed bottom-6 left-6 z-50 bg-red-800 text-white p-3 rounded-lg">{error}</div>}
  </div>;
  return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-5">
    <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl p-8 space-y-5">
      <h1 className="text-2xl font-bold">NovaNexus Video Meeting</h1>
      <div className="text-slate-300">Room: <strong>{roomId}</strong></div>
      <div className="text-slate-300">Signed in as {user?.name||'Member'}</div>
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
      <div className="flex gap-3">
        <button onClick={join} disabled={loading} className="flex-1 rounded-lg bg-indigo-600 p-3 font-semibold disabled:opacity-60">{loading?'Connecting...':'Join Meeting'}</button>
        <button onClick={onEnd} className="rounded-lg border border-slate-600 p-3">Back</button>
      </div>
    </div>
  </div>;
}
