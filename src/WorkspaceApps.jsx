import React,{useMemo,useState} from 'react';
import {MessageCircle,Phone,Calendar,BrainCircuit,Shield,Search,Pin,PinOff,ArrowUpRight} from 'lucide-react';

// Nexus Apps are workspace experiences, not host/Docker/OS packages.
// Include only views which actually exist and work in this workspace.
export const NEXUS_APPS=[
 {id:'chats',name:'Chat',category:'Collaboration',description:'Direct messages, photos and private file attachments.',icon:MessageCircle},
 {id:'calls',name:'Calls',category:'Collaboration',description:'Start voice or video calls with your workspace contacts.',icon:Phone},
 {id:'schedule',name:'Calendar',category:'Productivity',description:'Schedule and manage workspace meetings.',icon:Calendar},
 {id:'ai',name:'AI Assistant',category:'Productivity',description:'Open the administrator-configured workspace assistant.',icon:BrainCircuit},
 {id:'admin',name:'Administration',category:'Management',description:'Manage users, meeting settings and workspace access.',icon:Shield,adminOnly:true},
];
const STORAGE_KEY='novanexus.pinned-apps.v1';
export function loadPinnedApps(){
 try{
  const v=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');
  return Array.isArray(v)?v.filter(x=>typeof x==='string'&&NEXUS_APPS.some(app=>app.id===x)).slice(0,8):[];
 }catch{return [];}
}
export function persistPinnedApps(ids){
 try{localStorage.setItem(STORAGE_KEY,JSON.stringify(ids))}catch{}
}

export default function WorkspaceApps({role,onOpen,pinned,onPin}){
 const [search,setSearch]=useState('');
 const [category,setCategory]=useState('All');
 const available=useMemo(()=>NEXUS_APPS.filter(x=>!x.adminOnly||role==='Admin'),[role]);
 const visible=available.filter(x=>(category==='All'||x.category===category)&&
   (x.name+' '+x.description).toLowerCase().includes(search.trim().toLowerCase()));
 return <div className="mx-auto max-w-6xl space-y-7 px-5 py-8 sm:px-10" aria-label="Nexus Apps">
   <div className="space-y-2">
     <h1 className="text-3xl font-black text-slate-900">Apps</h1>
     <p className="text-sm text-slate-500">Discover and pin real workspace experiences, like the Apps hub in Teams. Apps run inside Nexus—not as server packages.</p>
   </div>
   <div className="flex flex-wrap gap-3">
     <label className="relative min-w-[220px] flex-1">
       <Search size={18} className="absolute left-3 top-3 text-slate-400"/>
       <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search apps" className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm" aria-label="Search apps"/>
     </label>
     <select aria-label="App category" value={category} onChange={e=>setCategory(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm">
       {['All','Collaboration','Productivity','Management'].map(x=><option key={x} value={x}>{x}</option>)}
     </select>
   </div>
   <div className="space-y-3">
     <h2 className="text-lg font-bold text-slate-800">Available to you</h2>
     {visible.length===0&&<p className="rounded-lg border p-6 text-sm text-slate-500">No matching apps are available.</p>}
     <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
       {visible.map(app=><div key={app.id} className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
         <div className="flex items-start gap-3">
           <div className="rounded-xl bg-violet-100 p-3 text-violet-700"><app.icon size={25}/></div>
           <div className="min-w-0"><h3 className="font-bold text-slate-900">{app.name}</h3><p className="text-xs text-slate-500">{app.category}</p></div>
         </div>
         <p className="min-h-[44px] text-sm leading-relaxed text-slate-600">{app.description}</p>
         <div className="mt-auto flex flex-wrap gap-2">
           <button type="button" onClick={()=>onOpen(app.id)} className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Open <ArrowUpRight size={14}/></button>
           <button type="button" onClick={()=>onPin(app.id)} aria-pressed={pinned.includes(app.id)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">{pinned.includes(app.id)?<PinOff size={14}/>:<Pin size={14}/>} {pinned.includes(app.id)?'Unpin':'Pin'}</button>
         </div>
       </div>)}
     </div>
   </div>
 </div>;
}
