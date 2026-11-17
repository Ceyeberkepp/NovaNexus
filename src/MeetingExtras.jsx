import React,{useEffect,useRef,useState} from 'react';
import {useRoomContext} from '@livekit/components-react';
import {RoomEvent} from 'livekit-client';
import {Disc,Square,Users,Cast,Monitor,MoreVertical,Settings,Link2,DoorOpen,Plus,Trash2,ArrowLeft} from 'lucide-react';

export default function MeetingExtras({shareUrl,roomId,maxParticipants,user,isHost,onOpenSettings,onSwitchBreakout,activeBreakoutId=0}){
 const room=useRoomContext();
 const [participants,setParticipants]=useState(1);
 const [expanded,setExpanded]=useState(false);
 const [recording,setRecording]=useState(false);
 const [notice,setNotice]=useState('');
 const [breakoutOpen,setBreakoutOpen]=useState(false);
 const [breakouts,setBreakouts]=useState([]);
 const [team,setTeam]=useState([]);
 const [roomName,setRoomName]=useState('');
 const [selectedUser,setSelectedUser]=useState('');
 const [currentAssignment,setCurrentAssignment]=useState(0);
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
 async function breakoutRequest(payload){
  const method=payload?'POST':'GET';
  const res=await fetch(method==='GET'?'/api/meetings/breakouts?parent='+encodeURIComponent(roomId):'/api/meetings/breakouts',{
    credentials:'same-origin',method,headers:payload?{'Content-Type':'application/json'}:undefined,
    body:payload?JSON.stringify({...payload,parent:roomId}):undefined
  });
  const data=await res.json();
  if(!res.ok)throw Error(data.error||'Breakout update failed');
  return data;
 }
 async function refreshBreakouts(){
  try{
   const data=await breakoutRequest();
   setBreakouts(data.breakouts||[]);
   if(!data.isHost){
    const assigned=(data.breakouts||[]).find(b=>b.assigned)?.id||0;
    setCurrentAssignment(assigned);
    if(assigned!==activeBreakoutId)onSwitchBreakout?.(assigned);
   }
  }catch(e){setNotice(e.message)}
 }
 useEffect(()=>{
  let live=true;
  if(isHost){fetch('/api/users',{credentials:'same-origin'}).then(r=>r.json()).then(d=>{if(live)setTeam(d.users||[])}).catch(()=>{});}
  return()=>{live=false};
 },[isHost]);
 useEffect(()=>{refreshBreakouts();const timer=setInterval(refreshBreakouts,5000);return()=>clearInterval(timer)},[roomId,isHost,activeBreakoutId]);
 async function mutate(payload){
  try{
   await breakoutRequest(payload);setRoomName('');setNotice('Saved breakout room changes.');await refreshBreakouts();
  }catch(e){setNotice(e.message)}
 }
 async function copyLink(){
  try{await navigator.clipboard.writeText(shareUrl||window.location.origin+'/'+roomId);setNotice('Meeting link copied.');}
  catch{setNotice('Copy this meeting link: '+(shareUrl||window.location.origin+'/'+roomId))}
 }

 return <div className="fixed bottom-4 right-4 z-[60] max-w-[min(370px,94vw)] text-white text-xs">
  {expanded&&<div role="menu" className="mb-3 max-h-[75vh] overflow-y-auto rounded-2xl border border-zinc-600 bg-zinc-900/95 p-5 space-y-4 shadow-2xl backdrop-blur">
   <h3 className="text-sm font-black text-white">Meeting options</h3>
   <p className="text-[11px] text-zinc-400">Meeting {roomId} · {participants} of {maxParticipants} participants</p>
   <button onClick={()=>{onOpenSettings?.();setExpanded(false)}} className="flex w-full items-center gap-3 rounded-xl bg-zinc-800 p-3 text-left font-semibold hover:bg-zinc-700"><Settings size={17}/> Video & audio settings</button>
   <button onClick={copyLink} className="flex w-full items-center gap-3 rounded-xl bg-zinc-800 p-3 text-left font-semibold hover:bg-zinc-700"><Link2 size={17}/> Copy meeting link</button>
   <div className="border-t border-zinc-700 pt-4">
    <div className="mb-2 flex gap-2 items-center"><Disc size={16} className="text-red-400"/><span className="font-semibold">Record meeting</span></div>
    <p className="mb-3 text-[11px] text-zinc-400">Record a selected window or tab to a local WebM file. All participants should be informed. Audio capture depends on browser permissions. This is not server-side recording.</p>
    {recording?<button className="w-full rounded-xl bg-rose-600 p-3 font-semibold" onClick={stopRecording}>Stop recording and download</button>:<button className="w-full rounded-xl bg-indigo-600 p-3 font-semibold" onClick={startRecording}>Start screen recording</button>}
   </div>
   <button onClick={()=>setBreakoutOpen(x=>!x)} className="flex w-full items-center justify-between rounded-xl bg-zinc-800 p-3 text-left font-semibold"><span className="flex items-center gap-3"><DoorOpen size={17}/> Breakout rooms</span><span>{breakouts.length}</span></button>
   {breakoutOpen&&<div className="space-y-3 rounded-xl border border-zinc-700 p-3">
    {isHost&&<div className="space-y-2"><label className="block text-xs font-semibold">New breakout room<input className="mt-2 w-full rounded-lg bg-zinc-800 p-2" placeholder="Room name" value={roomName} maxLength={80} onChange={e=>setRoomName(e.target.value)}/></label><button disabled={!roomName.trim()} className="w-full rounded-lg bg-indigo-600 p-2 disabled:opacity-50" onClick={()=>mutate({action:'create',name:roomName})}>Create room</button></div>}
    {breakouts.map(room=><div key={room.id} className="rounded-xl border border-zinc-700 bg-zinc-800 p-3 space-y-2">
      <div className="flex items-center justify-between gap-3"><span className="font-bold">{room.name}</span>{isHost&&<button className="text-rose-300" title="Delete breakout" onClick={()=>{if(window.confirm('Delete '+room.name+'?'))mutate({action:'delete',breakoutID:room.id})}}><Trash2 size={15}/></button>}</div>
      {isHost&&<><div className="space-y-1">{(room.members||[]).map(id=>{const member=team.find(u=>u.id===id);return <div className="flex justify-between gap-2 text-[11px]" key={id}><span>{member?.name||'Member '+id}</span><button className="text-rose-300" onClick={()=>mutate({action:'unassign',breakoutID:room.id,userID:id})}>Remove</button></div>})}</div><select value={selectedUser} onChange={e=>setSelectedUser(e.target.value)} className="w-full rounded-lg bg-zinc-700 p-2"><option value="">Assign member</option>{team.filter(t=>t.active!==false&&t.id!==user?.id).map(t=><option value={t.id} key={t.id}>{t.name}</option>)}</select><button className="w-full rounded-lg bg-indigo-600 p-2 disabled:opacity-40" disabled={!selectedUser} onClick={()=>mutate({action:'assign',breakoutID:room.id,userID:Number(selectedUser)})}>Assign to breakout</button></>}
      {(isHost||room.assigned)&&<button className="w-full rounded-lg border border-zinc-600 p-2 font-semibold" onClick={()=>onSwitchBreakout?.(room.id)}>Enter room</button>}
    </div>)}
    {activeBreakoutId>0&&<button className="flex w-full gap-2 justify-center rounded-lg bg-zinc-700 p-2" onClick={()=>onSwitchBreakout?.(0)}><ArrowLeft size={14}/> Return to main meeting</button>}
    {!isHost&&breakouts.length===0&&<p className="text-zinc-400">The host has not created breakout rooms.</p>}
   </div>}
   <p className="border-t border-zinc-700 pt-3 text-zinc-400 text-[11px]">Broadcasting and remote control require separate services.</p>
   {notice&&<p role="status" className="text-amber-200 break-words">{notice}</p>}
  </div>}
  <button aria-label="More meeting options" aria-expanded={expanded} onClick={()=>setExpanded(x=>!x)} className="ml-auto flex items-center justify-center gap-2 rounded-2xl border border-zinc-600 bg-zinc-900 p-4 text-white shadow-xl hover:bg-zinc-800"><MoreVertical size={21}/><span className="font-bold">More</span></button>
 </div>;
}
