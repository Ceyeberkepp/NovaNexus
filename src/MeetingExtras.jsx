import React,{useEffect,useRef,useState} from 'react';
import {useRoomContext} from '@livekit/components-react';
import {RoomEvent} from 'livekit-client';
import {Disc,Square,Users,Shield,Cast,Monitor,ChevronDown} from 'lucide-react';

export default function MeetingExtras({roomId,maxParticipants}){
 const room=useRoomContext();
 const [participants,setParticipants]=useState(1);
 const [expanded,setExpanded]=useState(false);
 const [recording,setRecording]=useState(false);
 const [notice,setNotice]=useState('');
 const recordingRef=useRef(null);
 const streamRef=useRef(null);
 useEffect(()=>{
  const update=()=>setParticipants(1+room.remoteParticipants.size);
  update();room.on(RoomEvent.ParticipantConnected,update);room.on(RoomEvent.ParticipantDisconnected,update);
  return ()=>{
   room.off(RoomEvent.ParticipantConnected,update);room.off(RoomEvent.ParticipantDisconnected,update);
   if(recordingRef.current?.state==='recording')recordingRef.current.stop();
   streamRef.current?.getTracks().forEach(t=>t.stop());
  };
 },[room]);
 async function startRecording(){
  try{
   if(!navigator.mediaDevices?.getDisplayMedia||!window.MediaRecorder)throw Error('Screen capture and recording are not supported by this browser');
   // The browser prompts for the specific display surface; it cannot silently capture a call.
   const stream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:true});
   streamRef.current=stream;
   const type=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));
   const recorder=new MediaRecorder(stream,type?{mimeType:type}:undefined);
   const chunks=[];
   recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
   recorder.onstop=()=>{
    const blob=new Blob(chunks,{type:recorder.mimeType||'video/webm'});
    if(blob.size){const url=URL.createObjectURL(blob);
     const a=document.createElement('a');a.href=url;a.download='NovaNexus-'+roomId+'-'+new Date().toISOString().replace(/[:.]/g,'-')+'.webm';a.click();
     setTimeout(()=>URL.revokeObjectURL(url),3000);
    }
    stream.getTracks().forEach(track=>track.stop());
    setRecording(false);setNotice('Local recording saved to your Downloads folder.');
   };
   stream.getVideoTracks()[0]?.addEventListener('ended',()=>{if(recorder.state==='recording')recorder.stop()});
   recorder.start(1000);recordingRef.current=recorder;setRecording(true);
   setNotice('Recording your selected screen/window locally. This is NOT server-side recording.');
  }catch(e){setNotice(e.message||'Recording could not start');}
 }
 function stopRecording(){if(recordingRef.current?.state==='recording')recordingRef.current.stop();}
 return <div className="fixed right-3 top-3 z-[55] max-w-[270px] text-white text-xs">
  <div className="flex gap-2 justify-end">
   <span className="flex items-center gap-2 rounded-xl bg-zinc-900/95 border border-zinc-700 px-3 py-2"><Users size={14}/> {participants}/{maxParticipants}</span>
   <button onClick={()=>setExpanded(x=>!x)} className="flex items-center gap-2 rounded-xl bg-zinc-900/95 border border-zinc-700 px-3 py-2"><ChevronDown size={14}/> More</button>
  </div>
  {expanded&&<div className="mt-2 rounded-xl border border-zinc-700 bg-zinc-900/95 p-3 space-y-3 shadow-xl">
   <h3 className="font-bold text-indigo-200">Meeting tools</h3>
   <div className="flex gap-2 items-center"><Disc size={15} className="text-red-400"/><span className="font-semibold">Recording</span></div>
   <p className="text-[11px] leading-relaxed text-zinc-400">Record a browser-selected window or tab to a local WebM file. Screen/tab audio availability varies; this does not capture server audio or create cloud recordings.</p>
   {recording?<button className="flex gap-2 items-center w-full rounded-lg bg-rose-600 px-3 py-2 font-semibold" onClick={stopRecording}><Square size={13}/> Stop and download</button>:<button className="flex gap-2 items-center w-full rounded-lg bg-indigo-600 px-3 py-2 font-semibold" onClick={startRecording}><Disc size={13}/> Record selected screen</button>}
   <div className="border-t border-zinc-700 pt-3 space-y-3 text-[11px]">
    <div className="flex items-start gap-2"><Users size={15} className="text-zinc-500"/><span><strong>Breakout rooms</strong><br/><span className="text-zinc-400">Host assignment not yet available.</span></span></div>
    <div className="flex items-start gap-2"><Cast size={15} className="text-zinc-500"/><span><strong>Broadcast feed</strong><br/><span className="text-zinc-400">RTMP/egress not configured.</span></span></div>
    <div className="flex items-start gap-2"><Monitor size={15} className="text-zinc-500"/><span><strong>Remote control</strong><br/><span className="text-zinc-400">Permission and remote-control protocol not configured.</span></span></div>
   </div>
   {notice&&<p role="status" className="text-[11px] text-amber-200">{notice}</p>}
  </div>}
 </div>;
}
