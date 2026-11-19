import React,{useCallback,useEffect,useState} from 'react';
import {RoomEvent,Track} from 'livekit-client';
import {summarizeRoom,explainCameraState} from './meeting-diagnostics.mjs';

const WATCHED=[
 RoomEvent.ParticipantConnected,RoomEvent.ParticipantDisconnected,
 RoomEvent.TrackPublished,RoomEvent.TrackUnpublished,
 RoomEvent.TrackSubscribed,RoomEvent.TrackUnsubscribed,
 RoomEvent.TrackSubscriptionFailed,RoomEvent.TrackSubscriptionStatusChanged,
 RoomEvent.TrackMuted,RoomEvent.TrackUnmuted,
 RoomEvent.ConnectionStateChanged,RoomEvent.Reconnecting,RoomEvent.Reconnected
];
export default function MeetingDiagnostics({room,expanded=false,onClose}){
 const [snapshot,setSnapshot]=useState(()=>summarizeRoom(room));
 const [errors,setErrors]=useState([]);
 const refresh=useCallback(()=>setSnapshot(summarizeRoom(room)),[room]);
 useEffect(()=>{
   const onSubscriptionFailure=(sid,error,participant)=>{
     const name=participant?.name||'Remote participant';
     setErrors(previous=>[...previous.slice(-3),String(name).slice(0,60)+': remote track subscription failed'+(error?.message?': '+String(error.message).slice(0,100):'')]);
     refresh();
   };
   WATCHED.forEach(event=>room.on(event,refresh));
   room.on(RoomEvent.TrackSubscriptionFailed,onSubscriptionFailure);
   refresh();
   const timer=setInterval(refresh,3000);
   return ()=>{clearInterval(timer);WATCHED.forEach(event=>room.off(event,refresh));room.off(RoomEvent.TrackSubscriptionFailed,onSubscriptionFailure)};
 },[room,refresh]);
 const warning=snapshot.participants.find(p=>!p.isLocal&&p.cameraState!=='video-active'&&p.cameraState!=='camera-off');
 const badConnection=snapshot.connectionState!=='connected';
 return <>
   {(warning||badConnection)&&!expanded&&<div role="status" className="nexus-media-warning">
      {badConnection?'Media: '+snapshot.connectionState:warning?.name+': '+explainCameraState(warning.cameraState)}
   </div>}
   {expanded&&<div className="nexus-media-diagnostics" role="dialog" aria-label="Meeting media diagnostics">
     <div className="nexus-drawer-head"><h2>Call health</h2><button type="button" onClick={onClose} aria-label="Close media diagnostics">✕</button></div>
     <div className="space-y-4 overflow-y-auto p-4 text-xs">
       <p>Connection: <strong>{snapshot.connectionState}</strong>. {snapshot.remoteCount} remote participant(s).</p>
       {snapshot.participants.map((p,i)=><div key={i} className="rounded-xl border border-zinc-700 p-3">
         <div className="mb-1 font-semibold">{p.name} {p.isLocal?'(you)':''}</div>
         <p>{explainCameraState(p.cameraState)}</p>
         {!p.isLocal&&p.cameraPublished&&<p>Remote camera subscribed: {p.cameraSubscribed?'Yes':'Not yet'}</p>}
       </div>)}
       {errors.length>0&&<div className="rounded-lg border border-amber-700 bg-amber-900/30 p-3"><strong>Recent subscription errors</strong>{errors.map((e,i)=><p key={i} className="mt-2 break-words">{e}</p>)}</div>}
       <p className="text-zinc-400">This panel reports actual LiveKit track state. A local camera preview does not prove remote media delivery. If the connection never reaches connected, check ICE routing first.</p>
       <button type="button" className="rounded-lg border border-indigo-500 px-3 py-2 text-indigo-200" onClick={()=>navigator.clipboard?.writeText(JSON.stringify({room:snapshot,subscriptionErrors:errors},null,2)).catch(()=>{})}>Copy safe diagnostic report</button>
     </div>
   </div>}
 </>;
}
