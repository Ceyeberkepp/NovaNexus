import React,{useState} from 'react';
import {Bell,Monitor,Layout,Cpu,PhoneCall,Edit2,Check,AlertTriangle,Volume2} from 'lucide-react';

const defaults={
 theme:'Onyx',background:'solid',clock24:false,nameDisplay:'username',showPresence:false,timezone:'automatic',
 dmCount:40,sort:'recent',groupUnread:false,sendCtrlEnter:false,
 desktopNotifications:false,notificationSound:'none',
 callMicEnabled:true,callCamEnabled:true,callQuality:'720p',
};
export const chatBackgrounds={
 solid:{label:'Solid',backgroundImage:'none'},
 aurora:{label:'Aurora',backgroundImage:'radial-gradient(ellipse at 10% 15%,rgba(99,102,241,0.17),transparent 55%),radial-gradient(ellipse at 85% 80%,rgba(45,212,191,0.15),transparent 50%)'},
 dots:{label:'Dots',backgroundImage:'radial-gradient(rgba(100,116,139,0.16) 1px,transparent 1px)',backgroundSize:'22px 22px'},
 grid:{label:'Grid',backgroundImage:'linear-gradient(rgba(100,116,139,0.10) 1px,transparent 1px),linear-gradient(90deg,rgba(100,116,139,0.10) 1px,transparent 1px)',backgroundSize:'28px 28px'},
 waves:{label:'Waves',backgroundImage:'repeating-radial-gradient(circle at 0% 100%,transparent 0,transparent 18px,rgba(99,102,241,.08) 19px,transparent 22px)'}
};
export const chatThemes={Onyx:'#1e1e1e',Quartz:'#f8fafc',Indigo:'#eef2ff',Ruby:'#fff1f2'};
export function readChatPreferences(userId){
 try {const raw=localStorage.getItem('novanexus.chat.'+userId);const saved=raw?JSON.parse(raw):{};return {...defaults,...saved};}
 catch{return {...defaults};}
}
const input='rounded-md bg-[#252526] text-indigo-100 border border-white/10 p-2 text-xs';
const tabs=[
 ['notifications','Notifications',Bell],['display','Display',Monitor],['sidebar','Sidebar',Layout],
 ['advanced','Advanced',Cpu],['calls','Calls',PhoneCall]
];
export default function ChatPreferences({userId,initial,onClose,onSave}){
 const [settings,setSettings]=useState({...defaults,...initial});
 const [tab,setTab]=useState('display');
 const [feedback,setFeedback]=useState('');
 function change(key,val){setSettings(prev=>({...prev,[key]:val}));setFeedback('');}
 function save(){
  try{localStorage.setItem('novanexus.chat.'+userId,JSON.stringify(settings));onSave(settings);onClose();}
  catch{setFeedback('Browser storage is unavailable; preferences were not saved.');}
 }
 async function notificationTest(){
  if(!('Notification' in window)){setFeedback('Your browser cannot display desktop notifications.');return;}
  let permission=Notification.permission;
  if(permission==='default')permission=await Notification.requestPermission();
  if(permission==='granted'){new Notification('NovaNexus',{body:'This is a browser notification test.'});setFeedback('Test notification sent.');}
  else{setFeedback('Notifications are blocked by browser permissions.');}
 }
 function SettingRow({label,detail,children,unsupported}){
  return <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-3 py-5">
   <div className="min-w-0 flex-1"><div className="text-sm font-bold text-slate-200">{label}</div><p className="mt-1 text-[11px] text-slate-500">{detail}</p>{unsupported&&<p className="mt-2 text-[10px] text-amber-400">Requires additional service integration; not active</p>}</div>
   {children||<span className="text-xs text-slate-500">Not available</span>}
  </div>;
 }
 const Toggle=({value,onChange})=><button type="button" role="switch" aria-checked={!!value} onClick={()=>onChange(!value)} className={'relative h-7 w-12 shrink-0 rounded-full transition-colors '+(value?'bg-indigo-600':'bg-slate-600')}><span className={'absolute top-1 h-5 w-5 rounded-full bg-white transition-all '+(value?'left-6':'left-1')}/></button>;
 const Choice=({value,onChange,values})=><select aria-label="Select setting" className={input} value={value} onChange={e=>onChange(e.target.value)}>{values.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>;
 return <div role="dialog" aria-modal="true" aria-label="Chat settings" className="absolute inset-0 z-[110] flex items-center justify-center bg-black/65 p-4 md:p-8">
  <div className="flex h-[min(85vh,740px)] w-full max-w-5xl overflow-hidden rounded-xl border border-white/10 bg-[#1e1e1e] font-sans text-slate-300 shadow-2xl">
   <aside className="hidden w-52 shrink-0 flex-col border-r border-black/30 bg-[#252526] md:flex">
    <div className="border-b border-black/30 p-6 text-lg font-black text-white">Settings</div>
    <nav aria-label="Chat preference sections" className="flex-1 space-y-1 overflow-auto p-3">
     {tabs.map(([key,label,Icon])=><button key={key} onClick={()=>setTab(key)} className={'flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-xs font-bold '+(key===tab?'bg-[#37373d] text-white':'text-slate-400 hover:bg-[#2d2d30]')}><Icon size={15}/>{label}</button>)}
    </nav>
   </aside>
   <section className="flex min-w-0 flex-1 flex-col">
    <header className="flex items-center justify-between border-b border-black/30 px-6 py-5">
     <div className="flex flex-wrap gap-3 items-center"><h2 className="text-lg font-bold capitalize text-white">{tab} Settings</h2><select className={input+' md:hidden'} value={tab} onChange={e=>setTab(e.target.value)}>{tabs.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></div>
     <button onClick={onClose} className="rounded-lg p-2 hover:bg-white/10" aria-label="Close settings">✕</button>
    </header>
    <div className="flex-1 overflow-y-auto px-5 py-6 md:px-10">
      {tab==='display'&&<div>
       <div className="mb-6 rounded-xl border border-white/5 bg-[#252526] p-5">
        <div className="mb-4 text-sm font-bold text-white">Theme</div>
        <div className="grid grid-cols-4 gap-3">{Object.entries(chatThemes).map(([name,color])=><button key={name} onClick={()=>change('theme',name)} className="group text-center text-[10px] font-semibold"><span style={{background:color}} className={'mb-2 block h-16 rounded-md border-2 '+(settings.theme===name?'border-indigo-500':'border-transparent')}/>{name}</button>)}</div>
       </div>
       <div className="mb-6 rounded-xl border border-white/5 bg-[#252526] p-5">
        <div className="mb-3 text-sm font-bold text-white">Chat Background</div>
        <p className="mb-4 text-[11px] text-slate-400">Choose an actual conversation background. It updates when you save and stays selected in this browser.</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">{Object.entries(chatBackgrounds).map(([key,bg])=><button key={key} type="button" onClick={()=>change('background',key)} aria-pressed={(settings.background||'solid')===key} className="text-center text-[10px] font-semibold"><span style={{backgroundColor:chatThemes[settings.theme]||'#f8fafc',backgroundImage:bg.backgroundImage,backgroundSize:bg.backgroundSize}} className={'mb-2 block h-14 rounded-lg border-2 '+((settings.background||'solid')===key?'border-indigo-500':'border-transparent')}/>{bg.label}</button>)}</div>
       </div>
       <SettingRow label="Clock Display" detail="Choose the 12-hour or 24-hour format for message timestamps."><Choice value={settings.clock24?'24':'12'} onChange={v=>change('clock24',v==='24')} values={[[ '12','12-hour' ],[ '24','24-hour' ]]}/></SettingRow>
       <SettingRow label="Teammate Name Display" detail="Choose whether to display names or email addresses in the chat sidebar."><Choice value={settings.nameDisplay} onChange={v=>change('nameDisplay',v)} values={[[ 'username','Display name' ],[ 'email','Email address' ]]}/></SettingRow>
       <SettingRow label="Show online availability on profile images" detail="Display presence indicators only when real status is available."><Toggle value={settings.showPresence} onChange={v=>change('showPresence',v)}/></SettingRow>
       <SettingRow label="Timezone" detail="Message times use your browser timezone unless UTC is selected."><Choice value={settings.timezone} onChange={v=>change('timezone',v)} values={[[ 'automatic','Browser timezone' ],[ 'UTC','UTC' ]]}/></SettingRow>
      </div>}
      {tab==='notifications'&&<div>
       <SettingRow label="Desktop and mobile notifications" detail="Allow NovaNexus to display local browser notifications during supported events."><Toggle value={settings.desktopNotifications} onChange={v=>change('desktopNotifications',v)}/></SettingRow>
       <SettingRow label="Desktop notification sounds" detail="Select whether the browser may play sounds with notifications."><Choice value={settings.notificationSound} onChange={v=>change('notificationSound',v)} values={[[ 'none','None' ],[ 'gentle','Gentle alert' ]]}/></SettingRow>
       <SettingRow label="Email notifications" detail="Delivery by email requires a configured SMTP notification worker." unsupported/>
       <SettingRow label="Keywords that trigger notifications" detail="@channel, @here and @all require server push and group message delivery." unsupported/>
       <div className="mt-6 rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-5"><div className="flex gap-3 text-indigo-200"><AlertTriangle size={20}/><div><h3 className="text-xs font-bold">Troubleshooting notifications</h3><p className="mt-2 text-[11px]">Use this test to verify browser notification permission. Automatic messages require the notification service.</p><button className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white" onClick={notificationTest}>Send Test Notification</button></div></div></div>
      </div>}
      {tab==='sidebar'&&<div>
       <SettingRow label="Group unread channels separately" detail="Unread grouping requires server-side read receipts." unsupported/>
       <SettingRow label="Number of direct messages to show" detail="Limit the number of people displayed in the sidebar."><input aria-label="Direct message count" className={input+' w-24'} type="number" min={1} max={500} value={settings.dmCount} onChange={e=>change('dmCount',Math.min(500,Math.max(1,Number(e.target.value)||1)))}/></SettingRow>
       <SettingRow label="Sort channels by" detail="Sort the available people list."><Choice value={settings.sort} onChange={v=>change('sort',v)} values={[[ 'recent','Most recent activity' ],[ 'name','Name' ],[ 'role','Role' ]]}/></SettingRow>
      </div>}
      {tab==='advanced'&&<div>
       <SettingRow label="Send Messages on CTRL+ENTER" detail="Choose Ctrl+Enter or Enter to send messages."><Toggle value={settings.sendCtrlEnter} onChange={v=>change('sendCtrlEnter',v)}/></SettingRow>
       <SettingRow label="Enable Post Formatting" detail="Rich-text and Markdown rendering need an approved renderer." unsupported/>
       <SettingRow label="Enable Join/Leave Messages" detail="Group event delivery requires the server membership event stream." unsupported/>
       <SettingRow label="Scroll position when viewing an unread channel" detail="Unread markers need persistent read-receipt tracking." unsupported/>
      </div>}
      {tab==='calls'&&<div>
       <SettingRow label="Join meetings with microphone enabled" detail="Default microphone selection in the meeting room."><Toggle value={settings.callMicEnabled} onChange={v=>change('callMicEnabled',v)}/></SettingRow>
       <SettingRow label="Join meetings with camera enabled" detail="Default camera selection in the meeting room."><Toggle value={settings.callCamEnabled} onChange={v=>change('callCamEnabled',v)}/></SettingRow>
       <SettingRow label="Preferred video quality" detail="Client capture preference; actual quality adapts to bandwidth."><Choice value={settings.callQuality} onChange={v=>change('callQuality',v)} values={[[ '360p','360p' ],[ '720p','720p HD' ],[ '1080p','1080p Full HD' ]]}/></SettingRow>
       <SettingRow label="Recording, breakout rooms and moderation" detail="These require server-side media and room orchestration." unsupported/>
      </div>}
      {feedback&&<p role="status" className="mt-4 text-xs text-amber-300">{feedback}</p>}
    </div>
    <footer className="flex justify-end gap-3 border-t border-black/30 bg-[#252526] p-5"><button className="rounded-lg px-6 py-2 text-xs font-bold hover:bg-white/10" onClick={onClose}>Cancel</button><button className="rounded-lg bg-indigo-600 px-6 py-2 text-xs font-bold text-white hover:bg-indigo-500" onClick={save}>Save Settings</button></footer>
   </section>
  </div>
 </div>;
}
