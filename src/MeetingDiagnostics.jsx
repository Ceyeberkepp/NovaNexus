import React,{useCallback,useEffect,useRef,useState} from 'react';
import {RoomEvent,Track} from 'livekit-client';
import {summarizeRoom,explainCameraState,summarizeVideoRtpStats} from './meeting-diagnostics.mjs';

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
 const [videoStats,setVideoStats]=useState({});
 const lastFrames=useRef({});
 useEffect(()=>{
  let live=true;
  const sample=async()=>{
   const participants=[room.localParticipant,...Array.from(room.remoteParticipants.values())].filter(Boolean);
   const results=await Promise.all(participants.map(async p=>{
     const publication=Array.from(p.trackPublications.values()).find(pub=>pub.source===Track.Source.Camera);
     const track=publication?.track;
     const key=p.sid||p.identity;
     if(!track||typeof track.getRTCStatsReport!=='function')return [key,null];
     try{
       const report=await track.getRTCStatsReport();
       const stats=summarizeVideoRtpStats(report,!!p.isLocal);
       const previous=lastFrames.current[key];
       return [key,stats?{...stats,deltaFrames:previous===undefined?null:Math.max(0,stats.frames-previous)}:null];
     }catch{return [key,null];}
   }));
   if(!live)return;
   const next=Object.fromEntries(results.filter(([key])=>!!key));
   lastFrames.current=Object.fromEntries(results.filter(([,value])=>value).map(([key,value])=>[key,value.frames]));
   setVideoStats(next);
  };
  sample();
  const timer=setInterval(sample,4000);
  return ()=>{live=false;clearInterval(timer)};
 },[room]);
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
         {(()=>{
           const participant=p.isLocal?room.localParticipant:Array.from(room.remoteParticipants.values()).find(x=>(x.name||x.identity)===p.name);
           const video=participant&&videoStats[participant.sid||participant.identity];
           if(!video)return <p className="mt-1 text-zinc-500">RTP video statistics are not available yet.</p>;
           return <div className="mt-2 text-zinc-300">
             <p>{p.isLocal?'Outgoing':'Incoming'} packets: {video.packets}; video frames {p.isLocal?'encoded':'decoded'}: {video.frames}</p>
             <p>{video.deltaFrames===null?'Measuring new frames…':video.deltaFrames>0?video.deltaFrames+' new frames in the last sample':'No additional frames in the last sample'}</p>
           </div>;
         })()}
       </div>)}
       {errors.length>0&&<div className="rounded-lg border border-amber-700 bg-amber-900/30 p-3"><strong>Recent subscription errors</strong>{errors.map((e,i)=><p key={i} className="mt-2 break-words">{e}</p>)}</div>}
       <p className="text-zinc-400">This panel reports actual LiveKit track and video frame counters. A local camera preview does not prove remote media delivery. If the connection never reaches connected, check ICE routing first.</p>
       <button type="button" className="rounded-lg border border-indigo-500 px-3 py-2 text-indigo-200" onClick={()=>navigator.clipboard?.writeText(JSON.stringify({room:snapshot,videoRtpStats:videoStats,subscriptionErrors:errors},null,2)).catch(()=>{})}>Copy safe diagnostic report</button>
     </div>
   </div>}
 </>;
}
