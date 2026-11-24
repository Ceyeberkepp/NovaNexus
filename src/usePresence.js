import {useCallback,useEffect,useRef,useState} from 'react';

// Update presence using the current authenticated session only.
// Closing a tab or losing network heartbeats eventually shows Offline.
export function usePresence(user){
 const [presence,setPresence]=useState({});
 const lastActivity=useRef(Date.now());
 const alive=!!user?.id&&!user?.isGuest&&!user?.must_change_password&&!user?.terms_required;

 const refresh=useCallback(async()=>{
  if(!alive)return;
  try{
   const response=await fetch('/api/presence',{credentials:'same-origin',cache:'no-store'});
   if(response.ok){const data=await response.json();setPresence(data.presence||{});}
  }catch{}
 },[alive]);

 const heartbeat=useCallback(async(mode)=>{
  if(!alive)return;
  const idle=document.hidden||Date.now()-lastActivity.current>=5*60*1000;
  const payload={idle,...(mode?{mode}:{})};
  try{
   const response=await fetch('/api/presence',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),keepalive:true});
   if(response.ok)await refresh();
  }catch{}
 },[alive,refresh]);

 useEffect(()=>{
  if(!alive){setPresence({});return;}
  const activity=()=>{lastActivity.current=Date.now();};
  const visible=()=>{if(!document.hidden)activity();heartbeat();};
  for(const event of ['pointerdown','keydown','touchstart'])window.addEventListener(event,activity,{passive:true});
  document.addEventListener('visibilitychange',visible);
  heartbeat();refresh();
  const timer=setInterval(()=>{heartbeat();refresh();},25000);
  return()=>{
   clearInterval(timer);
   document.removeEventListener('visibilitychange',visible);
   for(const event of ['pointerdown','keydown','touchstart'])window.removeEventListener(event,activity);
  };
 },[alive,heartbeat,refresh]);
 return {presence,setStatus:heartbeat};
}
