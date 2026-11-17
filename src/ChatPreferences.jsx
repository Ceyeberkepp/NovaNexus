import React,{useState} from 'react';

const defaults={theme:'Quartz',clock24:false,showPresence:false,dmCount:40,sort:'name',sendCtrlEnter:false};
export const chatThemes={Onyx:'#171717',Quartz:'#f8fafc',Indigo:'#eef2ff',Ruby:'#fff1f2'};
export function readChatPreferences(userId){
 try {const raw=localStorage.getItem('novanexus.chat.'+userId);const saved=raw?JSON.parse(raw):{};
  return {...defaults,...saved};}catch{return {...defaults};}
}
export default function ChatPreferences({userId,initial,onClose,onSave}){
 const [settings,setSettings]=useState({...initial});
 const [tab,setTab]=useState('display');
 const [feedback,setFeedback]=useState('');
 function set(key,val){setSettings(v=>({...v,[key]:val}));}
 function save(){
  try{localStorage.setItem('novanexus.chat.'+userId,JSON.stringify(settings));onSave(settings);onClose();}
  catch{setFeedback('Browser storage is unavailable; settings could not be saved.');}
 }
 async function testNotification(){
  if(!('Notification' in window)){setFeedback('This browser does not support desktop notifications.');return;}
  let permission=Notification.permission;
  if(permission==='default')permission=await Notification.requestPermission();
  if(permission==='granted'){new Notification('NovaNexus',{body:'This is a local browser notification test.'});setFeedback('Test notification sent.');}
  else setFeedback('Notifications are not permitted by this browser.');
 }
 const inp='rounded-lg border border-slate-600 bg-zinc-800 p-2 text-slate-100';
 return <div role="dialog" aria-modal="true" aria-label="Chat settings" className="absolute inset-0 z-[110] bg-black/60 flex items-center justify-center p-5">
  <div className="w-full max-w-3xl rounded-xl bg-zinc-900 text-zinc-100 shadow-2xl overflow-hidden">
   <div className="p-5 border-b border-white/10 flex justify-between"><h2 className="font-bold text-xl">Chat Settings</h2><button onClick={onClose} aria-label="Close settings">✕</button></div>
   <div className="grid md:grid-cols-[160px_1fr] min-h-[340px]">
    <nav className="p-3 border-r border-white/10 flex flex-col gap-2">{['display','sidebar','advanced','notifications'].map(t=><button className={'rounded-lg text-left p-3 text-sm '+(t===tab?'bg-indigo-600':'hover:bg-zinc-800')} key={t} onClick={()=>setTab(t)}>{t[0].toUpperCase()+t.slice(1)}</button>)}</nav>
    <div className="p-6 space-y-5">
     {tab==='display'&&<><h3 className="font-semibold">Display settings</h3><div className="grid grid-cols-4 gap-2">{Object.keys(chatThemes).map(t=><button key={t} aria-pressed={settings.theme===t} onClick={()=>set('theme',t)} className={'border-2 rounded-lg p-3 text-xs '+(settings.theme===t?'border-indigo-500':'border-zinc-700')}><span className="block rounded-md h-8 mb-2" style={{background:chatThemes[t]}}/>{t}</button>)}</div><label className="flex gap-3 items-center"><input type="checkbox" checked={settings.clock24} onChange={e=>set('clock24',e.target.checked)}/> 24-hour message timestamps</label><label className="flex gap-3 items-center"><input type="checkbox" checked={settings.showPresence} onChange={e=>set('showPresence',e.target.checked)}/> Show known presence indicators</label></>}
     {tab==='sidebar'&&<><h3 className="font-semibold">Sidebar</h3><label className="block">Maximum direct messages displayed<input type="number" className={inp+' block mt-2 w-full'} min="1" max="500" value={settings.dmCount} onChange={e=>set('dmCount',Math.min(500,Math.max(1,Number(e.target.value)||1)))}/></label><label className="block">Sort users<select className={inp+' block mt-2 w-full'} value={settings.sort} onChange={e=>set('sort',e.target.value)}><option value="name">Name</option><option value="role">Role</option></select></label></>}
     {tab==='advanced'&&<><h3 className="font-semibold">Advanced</h3><label className="flex gap-3 items-center"><input type="checkbox" checked={settings.sendCtrlEnter} onChange={e=>set('sendCtrlEnter',e.target.checked)}/> Send messages with Ctrl+Enter (otherwise Enter)</label><p className="text-xs text-zinc-400">Group message delivery, markdown formatting and automatic join/leave events require server features and are not yet available.</p></>}
     {tab==='notifications'&&<><h3 className="font-semibold">Notifications</h3><button onClick={testNotification} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm">Send test notification</button><p className="text-xs text-zinc-400">Automatic new-message and email notifications are not enabled until the server notification service is integrated.</p></>}
     {feedback&&<p role="status" className="text-xs text-amber-300">{feedback}</p>}
    </div>
   </div>
   <div className="border-t border-white/10 p-4 flex gap-3 justify-end"><button onClick={onClose} className="rounded-lg px-4 py-2 hover:bg-zinc-800">Cancel</button><button className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold" onClick={save}>Save Settings</button></div>
  </div>
 </div>;
}
