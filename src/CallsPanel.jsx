import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {Phone,PhoneIncoming,PhoneOutgoing,PhoneMissed,Video,Search,Users,SlidersHorizontal,Headphones,ChevronDown,History,PhoneCall,RefreshCw,Voicemail,PhoneForwarded,X} from 'lucide-react';

const filters=['All','Missed','Incoming','Outgoing','Voicemail'];
async function loadCalls(){
 const response=await fetch('/api/calls',{credentials:'same-origin'});
 const data=await response.json();
 if(!response.ok)throw Error(data.error||'Unable to load call history');
 return data.calls||[];
}
function duration(call){
 if(!call.answeredAt)return '';
 const end=call.endedAt||call.updatedAt;
 if(!end||call.status==='accepted')return 'In progress';
 const ms=Math.max(0,new Date(end).getTime()-new Date(call.answeredAt).getTime());
 const secs=Math.floor(ms/1000),mins=Math.floor(secs/60);
 return mins>=60?Math.floor(mins/60)+'h '+(mins%60)+'m':mins?mins+'m '+(secs%60)+'s':secs+'s';
}
function when(date){
 const d=new Date(date);if(isNaN(d.getTime()))return '';
 const today=new Date(),yesterday=new Date(today);yesterday.setDate(today.getDate()-1);
 if(d.toDateString()===today.toDateString())return d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
 if(d.toDateString()===yesterday.toDateString())return 'Yesterday';
 return d.toLocaleDateString([],{month:'short',day:'numeric',year:d.getFullYear()===today.getFullYear()?undefined:'numeric'});
}
function initials(name){return String(name||'?').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()}
function eventCall(member,audioOnly){window.dispatchEvent(new CustomEvent('novanexus:call',{detail:{recipientId:member.id,name:member.name,audioOnly}}))}
function CallRow({call,user,users}){
 const outgoing=call.callerId===user.id;
 const otherId=outgoing?call.recipientId:call.callerId;
 const member=users.find(u=>u.id===otherId);
 const label=member?.name||(outgoing?call.recipientName:call.callerName)||'Former member';
 const missed=call.status==='missed'&&!outgoing;
 const Icon=missed?PhoneMissed:outgoing?PhoneOutgoing:PhoneIncoming;
 return <div className="group flex items-center gap-3 border-b border-slate-100 py-3.5 pl-3 pr-4 hover:bg-indigo-50/40">
   <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700" aria-hidden="true">{initials(label)}</div>
   <div className="min-w-0 flex-1">
     <div className="truncate text-[13px] font-semibold text-slate-800">{label}</div>
     <div className={'mt-1 flex gap-1.5 items-center text-[11px] '+(missed?'text-rose-600':'text-slate-500')}><Icon size={13}/><span>{missed?'Missed incoming':call.status==='declined'?'Declined':call.status==='canceled'?'Canceled':call.status==='missed'?'Not answered':outgoing?'Outgoing':'Incoming'}</span><span className="text-slate-400">·</span><span>{call.audioOnly?'Audio':'Video'}</span></div>
   </div>
   <div className="flex items-center gap-4"><div className="text-right text-[11px] text-slate-500"><div>{when(call.createdAt)}</div>{duration(call)&&<div className="mt-1 text-slate-400">{duration(call)}</div>}</div>
     {member&&member.id!==user.id&&<div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"><button aria-label={'Call '+label} title="Call again" className="rounded-lg p-2 text-indigo-600 hover:bg-indigo-100" onClick={()=>eventCall(member,true)}><Phone size={16}/></button><button aria-label={'Video call '+label} title="Video call again" className="rounded-lg p-2 text-indigo-600 hover:bg-indigo-100" onClick={()=>eventCall(member,false)}><Video size={17}/></button></div>}
   </div>
 </div>;
}
export default function CallsPanel({user,users}){
 const [calls,setCalls]=useState([]);
 const [filter,setFilter]=useState('All');
 const [search,setSearch]=useState('');
 const [selected,setSelected]=useState('');
 const [showContacts,setShowContacts]=useState(false);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(false);
 const [sort,setSort]=useState('newest');
 const [deviceNames,setDeviceNames]=useState([]);
 const [device,setDevice]=useState('');
 const refresh=useCallback(async(silent=false)=>{
  if(!silent)setLoading(true);
  try{setCalls(await loadCalls());setError('')}catch(e){setError(e.message||'Unable to load call history')}finally{if(!silent)setLoading(false)}
 },[]);
 useEffect(()=>{refresh();const timer=setInterval(()=>refresh(true),6000);return()=>clearInterval(timer)},[refresh]);
 useEffect(()=>{let mounted=true;navigator.mediaDevices?.enumerateDevices?.().then(all=>{if(mounted)setDeviceNames(all.filter(d=>d.kind==='audioinput'))}).catch(()=>{});return()=>{mounted=false}},[]);
 const contacts=useMemo(()=>users.filter(u=>u.active!==false&&u.id!==user.id).sort((a,b)=>a.name.localeCompare(b.name)),[users,user.id]);
 const matches=contacts.filter(c=>((c.name||'')+' '+(c.email||'')).toLowerCase().includes(search.toLowerCase()));
 const person=contacts.find(x=>String(x.id)===String(selected));
 const visible=useMemo(()=>{
  return [...calls].filter(c=>{
   const isOutgoing=c.callerId===user.id;
   if(filter==='Outgoing'&&!isOutgoing)return false;
   if(filter==='Incoming'&&isOutgoing)return false;
   if(filter==='Missed'&&!(c.status==='missed'&&!isOutgoing))return false;
   if(filter==='Voicemail')return false; // No voicemail records exist until a voicemail service is installed.
   return true;
  }).sort((a,b)=>sort==='oldest'?new Date(a.createdAt)-new Date(b.createdAt):new Date(b.createdAt)-new Date(a.createdAt));
 },[calls,filter,user.id,sort]);
 return <section className="flex h-full min-h-0 flex-col bg-white text-slate-800">
  <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
    <div className="flex items-center gap-4"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white"><Phone size={20}/></span><h1 className="text-xl font-bold tracking-tight">Calls</h1><span className="border-b-2 border-indigo-600 px-3 py-2 text-sm font-semibold text-indigo-700">Personal</span></div>
    <button type="button" className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50" onClick={()=>setShowContacts(x=>!x)}><Users size={16}/> {showContacts?'Hide contacts':'View contacts'}</button>
  </header>
  <div className="flex min-h-0 flex-1 flex-col md:flex-row">
   <aside className="flex w-full shrink-0 flex-col border-b border-slate-200 bg-[#fcfcff] md:w-[290px] md:border-b-0 md:border-r">
    <div className="space-y-3 border-b border-slate-100 p-4">
      <label className="relative block"><Search size={16} className="pointer-events-none absolute left-3 top-3 text-slate-400"/><input aria-label="Search users to call" className="w-full rounded-lg border border-slate-200 bg-slate-100 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-indigo-500 focus:bg-white" placeholder="Type a name or email" value={search} onChange={e=>{setSearch(e.target.value);setSelected('')}}/></label>
      <select aria-label="Choose a contact" className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm" value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Select a member</option>{matches.map(c=><option value={c.id} key={c.id}>{c.name} ({c.email})</option>)}</select>
      <div className="grid grid-cols-2 gap-2"><button className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-35" disabled={!person} onClick={()=>eventCall(person,true)}><Phone size={16}/> Call</button><button className="flex items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-sm font-semibold text-indigo-700 disabled:opacity-35" disabled={!person} onClick={()=>eventCall(person,false)}><Video size={17}/> Video</button></div>
      {search&&matches.length===0&&<p className="text-xs text-slate-500">No workspace members match that search.</p>}
    </div>
    {showContacts&&<div className="min-h-0 overflow-y-auto p-3"><h2 className="mb-3 px-2 text-xs font-bold uppercase text-slate-500">Workspace contacts ({contacts.length})</h2>{matches.map(c=><button key={c.id} className={'flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-indigo-50 '+(String(selected)===String(c.id)?'bg-indigo-50':'')} onClick={()=>setSelected(String(c.id))}><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">{initials(c.name)}</span><span className="min-w-0"><span className="block truncate text-xs font-semibold">{c.name}</span><span className="block truncate text-[11px] text-slate-400">{c.email}</span></span></button>)}{contacts.length===0&&<p className="px-2 text-xs text-slate-500">No other active members in your workspace.</p>}</div>}
    <div className="mt-auto border-t border-slate-100 p-4 text-[11px] text-slate-600">
      <div className="mb-2 flex items-center gap-2"><PhoneForwarded size={15}/> Call forwarding: Not configured</div>
      <label className="flex items-center gap-2"><Headphones size={15}/><select aria-label="Microphone preference" value={device} onChange={e=>setDevice(e.target.value)} className="min-w-0 flex-1 border-0 bg-transparent text-[11px]"><option value="">System microphone</option>{deviceNames.map((d,i)=><option value={d.deviceId} key={d.deviceId||i}>{d.label||'Microphone '+(i+1)}</option>)}</select></label>
      <p className="mt-2 text-[10px] text-slate-400">Choose call devices in Video & Audio Settings before joining.</p>
    </div>
   </aside>
   <div className="flex min-h-0 min-w-0 flex-1 flex-col">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div className="flex flex-wrap items-center gap-2"><History size={16} className="mr-1 text-slate-500"/><h2 className="mr-3 text-sm font-bold">History</h2>{filters.map(x=><button key={x} aria-pressed={filter===x} onClick={()=>setFilter(x)} className={'rounded-full border px-3 py-1.5 text-[12px] font-semibold '+(filter===x?'border-indigo-600 bg-indigo-600 text-white':'border-slate-200 text-slate-600 hover:border-indigo-300')}>{x}</button>)}</div>
      <div className="flex items-center gap-2"><select aria-label="Sort call history" value={sort} onChange={e=>setSort(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select><button aria-label="Refresh call history" title="Refresh" onClick={()=>refresh()} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><RefreshCw size={17}/></button></div>
    </div>
    {error&&<p className="m-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700" role="alert">{error}</p>}
    <div className="min-h-0 flex-1 overflow-y-auto px-3 md:px-5">
      {visible.length>0?visible.map(c=><CallRow key={c.id} call={c} user={user} users={users}/>):<div className="flex min-h-[330px] flex-col items-center justify-center gap-3 p-8 text-center"><PhoneCall size={32} className="text-slate-300"/><h3 className="font-semibold text-slate-700">{loading?'Loading call history…':filter==='Voicemail'?'Voicemail is not configured':filter==='All'?'No calls yet': 'No '+filter.toLowerCase()+' calls'}</h3><p className="max-w-sm text-sm text-slate-500">{filter==='Voicemail'?'Voicemail requires a dedicated recording and message-delivery service. No voicemail entries are fabricated.':'Your real workspace calls will appear here automatically once they occur.'}</p></div>}
    </div>
   </div>
  </div>
 </section>;
}
