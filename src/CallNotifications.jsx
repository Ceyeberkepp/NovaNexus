import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Phone,PhoneOff,Video,Loader2,X,Volume2,VolumeX} from 'lucide-react';
import {useCallTones} from './useCallTones';

async function callRequest(options){
 const res=await fetch('/api/calls',{credentials:'same-origin',...options,headers:options?.method==='POST'?{'Content-Type':'application/json'}:undefined});
 const data=await res.json();
 if(!res.ok)throw new Error(data.error||'Call unavailable');
 return data;
}
export default function CallNotifications({user,onJoin}){
 const [incoming,setIncoming]=useState(null);
 const [outgoing,setOutgoing]=useState(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const handledCalls=useRef(new Set());
 const joinedOutgoing=useRef(new Set());
 const actionInFlight=useRef(false);
 const [muted,setMuted]=useState(false);
 const ringingIncoming=!!incoming&&!busy;
 const ringingOutgoing=outgoing?.status==='ringing'&&!busy;
 const audioBlocked=useCallTones(ringingIncoming?'incoming':ringingOutgoing?'outgoing':null,(ringingIncoming||ringingOutgoing)&&!muted);

 const poll=useCallback(async()=>{
  if(!user?.id)return;
  try{
   const data=await callRequest({method:'GET'});
   const items=data.calls||[];
   const ringing=items.find(c=>c.recipientId===user.id&&c.status==='ringing'&&!handledCalls.current.has(c.id));
   setIncoming(ringing||null);
   setOutgoing(previous=>{
    if(!previous)return null;
    const latest=items.find(c=>c.id===previous.id);
    if(!latest||['declined','missed','canceled'].includes(latest.status))return {...previous,status:latest?.status||'missed'};
    return {...previous,...latest};
   });
  }catch(e){setError(e.message)}
 },[user?.id]);
 useEffect(()=>{
  let alive=true;
  const handle=async event=>{
   const recipientId=Number(event.detail?.recipientId);
   if(!alive||!recipientId||busy||outgoing?.status==='ringing')return;
   setBusy(true);setError('');
   try{const data=await callRequest({method:'POST',body:JSON.stringify({action:'start',recipientId,audioOnly:!!event.detail.audioOnly})});
     setOutgoing({...data,recipientId,audioOnly:!!event.detail.audioOnly,status:'ringing',recipientName:event.detail.name||'Member'});
   }catch(e){setError(e.message)}
   finally{if(alive)setBusy(false)}
  };
  window.addEventListener('novanexus:call',handle);
  return()=>{alive=false;window.removeEventListener('novanexus:call',handle)};
 },[outgoing?.status,busy]);
 useEffect(()=>{poll();const i=setInterval(poll,2500);return()=>clearInterval(i)},[poll]);
 useEffect(()=>{
  if(outgoing?.status==='accepted'&&!joinedOutgoing.current.has(outgoing.id)){
   joinedOutgoing.current.add(outgoing.id);
   const room=outgoing.room,audioOnly=outgoing.audioOnly,id=outgoing.id;
   setOutgoing(null);
   onJoin(room,{autoJoin:true,audioOnly,callId:id});
  }
 },[outgoing?.status,outgoing?.room,outgoing?.audioOnly,onJoin]);
 const respond=async(action)=>{
  if(!incoming||actionInFlight.current)return;
  const current=incoming;
  actionInFlight.current=true;
  setBusy(true);setError('');
  // Hide and stop ringtone immediately. Record handled ID BEFORE the next poll,
  // so an outdated response cannot reopen the same incoming call.
  handledCalls.current.add(current.id);
  setIncoming(null);
  try{
   const result=await callRequest({method:'POST',body:JSON.stringify({action,callId:current.id})});
   if(action==='accept')onJoin(result.room,{autoJoin:true,audioOnly:current.audioOnly,callId:current.id});
  }catch(e){
   setError(action==='accept'?'Could not answer: '+e.message:'The incoming call was closed locally, but the server may not have received the decline: '+e.message);
   if(action==='accept'){handledCalls.current.delete(current.id);await poll();}
  }finally{actionInFlight.current=false;setBusy(false);}
 };
 const cancel=async()=>{
  if(!outgoing||actionInFlight.current)return;
  const current=outgoing;
  actionInFlight.current=true;setBusy(true);setError('');
  // The X and Cancel button have identical behavior. Close right away even
  // if the request fails, with a visible warning instead of a stuck popup.
  setOutgoing(null);
  try{
   await callRequest({method:'POST',body:JSON.stringify({action:'cancel',callId:current.id})});
  }catch(e){
   // 409 means the recipient already answered, declined or timed out.
   // In every case, this outgoing ringing popup must remain closed.
   if(!/409|no longer in the required state/i.test(e.message)){
    setError('The call was closed locally, but cancel was not confirmed by the server: '+e.message);
   }
  }finally{actionInFlight.current=false;setBusy(false);}
 };
 return <div className="fixed bottom-5 right-5 z-[150] w-[min(360px,calc(100vw-32px))] space-y-3">
  {incoming&&<div role="dialog" aria-label={incoming.callerName+' is calling'} aria-live="assertive" className="relative rounded-3xl border-2 border-indigo-300 bg-white p-6 shadow-2xl">
   <button type="button" aria-label="Dismiss incoming call" title="Decline call" disabled={busy} onClick={()=>respond('decline')} className="absolute right-3 top-3 rounded-full p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"><X size={18}/></button>
   <p className="mb-2 text-[11px] font-black uppercase tracking-widest text-indigo-600">{incoming.audioOnly?'Incoming audio call':'Incoming video call'}</p>
   <div className="mb-4 flex items-center gap-3"><div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-lg font-bold text-indigo-700">{String(incoming.callerName||'?').trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase()}</div><h2 className="min-w-0 break-words text-xl font-black text-slate-900">{incoming.callerName} is calling</h2></div>
   <p className="mt-2 mb-5 text-xs text-slate-500">Accept to join automatically, or decline this call.</p>
   <button type="button" aria-label={muted?'Unmute ringtone':'Mute ringtone'} onClick={()=>setMuted(x=>!x)} className="mb-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600">{muted?<VolumeX size={15}/>:<Volume2 size={15}/>} {muted?'Ringtone muted — unmute':'Mute ringtone'}</button>
   {audioBlocked&&!muted&&<p className="mb-3 text-xs text-amber-700" role="status">Your browser blocked automatic ringtone audio. Interact with this page to enable call sounds.</p>}
   <div className="flex gap-3">
    <button disabled={busy} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 p-3 text-sm font-bold text-white" onClick={()=>respond('decline')}><PhoneOff size={16}/> Decline</button>
    <button disabled={busy} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 p-3 text-sm font-bold text-white" onClick={()=>respond('accept')}><Phone size={16}/> Accept</button>
   </div>
  </div>}
  {outgoing&&<div role="status" className="relative rounded-3xl border border-slate-100 bg-white p-5 shadow-2xl">
   <button type="button" aria-label={outgoing.status==='ringing'?'Cancel outgoing call':'Dismiss call notification'} title={outgoing.status==='ringing'?'Cancel call':'Dismiss'} disabled={busy} onClick={outgoing.status==='ringing'?cancel:()=>setOutgoing(null)} className="absolute right-2 top-2 rounded-full p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"><X size={18}/></button>
   <div className="flex items-center gap-3">{outgoing.status==='ringing'?<Loader2 size={20} className="animate-spin text-indigo-600"/>:<PhoneOff size={20} className="text-slate-500"/>}<div className="flex-1"><h2 className="text-sm font-black text-slate-900">{outgoing.status==='ringing'?'Calling '+outgoing.recipientName:'Call '+outgoing.status}</h2><p className="text-xs text-slate-500">{outgoing.status==='ringing'?'Waiting for an answer…':'The meeting was not started.'}</p></div></div>
   <button className="mt-4 w-full rounded-xl border border-rose-200 bg-rose-50 p-2 text-sm font-bold text-rose-700" disabled={busy} onClick={outgoing.status==='ringing'?cancel:()=>setOutgoing(null)}>{outgoing.status==='ringing'?'Cancel call':'Dismiss'}</button>
  </div>}
  {error&&<div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}<button className="ml-3 underline" onClick={()=>setError('')}>Dismiss</button></div>}
 </div>;
}
