import React,{useEffect,useRef,useState} from 'react';
import {Camera,Mic,Monitor,Sliders,Shield,RefreshCw} from 'lucide-react';
import {readChatPreferences} from './ChatPreferences';
import {BACKGROUND_SCENES,applyVideoBackground} from './video-backgrounds';

const input='w-full rounded-xl bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-white';
export default function VideoSettings({userId,settings,onSave,onClose,room}){
 const [form,setForm]=useState({...settings});
 const [tab,setTab]=useState('devices');
 const [devices,setDevices]=useState([]);
 const [preview,setPreview]=useState(null);
 const [notice,setNotice]=useState('');
 const videoRef=useRef(null);
 const streamRef=useRef(null);
 useEffect(()=>{let live=true;navigator.mediaDevices?.enumerateDevices?.().then(d=>{if(live)setDevices(d)}).catch(()=>{});return()=>{live=false;streamRef.current?.getTracks().forEach(t=>t.stop())};},[]);
 useEffect(()=>{if(videoRef.current)videoRef.current.srcObject=preview;},[preview]);
 function update(key,value){setForm(p=>({...p,[key]:value}));}
 async function save(){
  try{
   const revised={...readChatPreferences(userId),...form};
   if(room){
     // Apply to the actual published camera stream before reporting success.
     await applyVideoBackground(room,revised);
   }
   localStorage.setItem('novanexus.chat.'+userId,JSON.stringify(revised));
   onSave(revised);onClose();
  }catch(e){setNotice('Browser storage is unavailable: '+e.message)}
 }
 async function cameraTest(){
  setNotice('');
  streamRef.current?.getTracks().forEach(t=>t.stop());
  try{
   const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:form.callVideoDevice?{deviceId:{ideal:form.callVideoDevice}}:true});
   streamRef.current=stream;setPreview(stream);
   const updated=await navigator.mediaDevices.enumerateDevices();setDevices(updated);
  }catch(e){setNotice('Could not start camera preview: '+e.message);}
 }
 async function selectDevice(kind,value){
  const field={audioinput:'callAudioDevice',videoinput:'callVideoDevice',audiooutput:'callSpeakerDevice'}[kind];
  update(field,value);
  if(room&&value)try{await room.switchActiveDevice(kind,value);setNotice('Active '+kind+' changed.');}
  catch(e){setNotice('Device change failed: '+e.message);}
 }
 function switchable(key,title,detail){return <label className="flex items-center justify-between gap-4 border-b border-white/10 py-5 text-sm"><span><strong className="block">{title}</strong><small className="block mt-1 text-zinc-400">{detail}</small></span><input type="checkbox" className="h-5 w-5 accent-indigo-600" checked={form[key]!==false} onChange={e=>update(key,e.target.checked)}/></label>}
 function deviceSelect(kind,title){
  const list=devices.filter(d=>d.kind===kind);
  const field={audioinput:'callAudioDevice',videoinput:'callVideoDevice',audiooutput:'callSpeakerDevice'}[kind];
  return <label className="block space-y-2 text-sm font-medium">{title}<select className={input} value={form[field]||''} onChange={e=>selectDevice(kind,e.target.value)}><option value="">System default</option>{list.map((d,i)=><option key={d.deviceId||i} value={d.deviceId}>{d.label||title+' '+(i+1)}</option>)}</select></label>;
 }
 return <div role="dialog" aria-modal="true" aria-label="Video conference settings" className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 p-3 md:p-6">
  <div className="flex max-h-[90vh] min-h-[580px] w-full max-w-5xl overflow-hidden rounded-2xl border border-zinc-700 bg-[#1e1e1e] text-zinc-100 shadow-2xl">
   <nav className="hidden w-48 shrink-0 space-y-2 border-r border-zinc-700 bg-[#252526] p-5 md:block"><h2 className="mb-7 font-black">Meeting Settings</h2>{[['devices','Devices',Sliders],['audio','Audio',Mic],['video','Video',Camera],['recording','Recording',Monitor],['advanced','Advanced',Shield]].map(([key,label,Icon])=><button key={key} onClick={()=>setTab(key)} className={'flex w-full gap-3 rounded-xl p-3 text-left text-xs font-bold '+(tab===key?'bg-zinc-700 text-white':'text-zinc-400 hover:bg-zinc-800')}><Icon size={16}/>{label}</button>)}</nav>
   <div className="flex min-w-0 flex-1 flex-col">
    <header className="flex items-center justify-between border-b border-zinc-700 p-5"><div className="flex gap-3 items-center"><h2 className="font-black capitalize">{tab} Settings</h2><select className={input+' md:hidden'} value={tab} onChange={e=>setTab(e.target.value)}>{['devices','audio','video','recording','advanced'].map(t=><option key={t} value={t}>{t}</option>)}</select></div><button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg">✕</button></header>
    <div className="flex-1 overflow-y-auto p-6 md:p-9 space-y-5">
     {tab==='devices'&&<><h3 className="font-bold">Camera and audio devices</h3><p className="text-xs text-zinc-400">Select devices before joining or switch active devices while connected. Browser permission may be required.</p>{deviceSelect('videoinput','Camera')}{deviceSelect('audioinput','Microphone')}{deviceSelect('audiooutput','Speakers / Output Device')}<button onClick={cameraTest} className="rounded-lg border border-indigo-500 px-4 py-2 text-xs font-bold text-indigo-200">Test Camera</button>{preview&&<video ref={videoRef} autoPlay playsInline muted className="mt-3 max-h-48 w-full rounded-xl bg-black object-contain"/>}</>}
     {tab==='audio'&&<>{switchable('callMicEnabled','Microphone on when joining','Your personal default; you can mute in the meeting.')}{switchable('callNoiseSuppression','Noise suppression','Browser audio processing; applies to new capture.')}{switchable('callEchoCancellation','Echo cancellation','Browser audio processing; applies to new capture.')}<p className="text-xs text-zinc-400">The microphone picker is in Devices. In-call mute controls are always available in the toolbar.</p></>}
     {tab==='video'&&<>{switchable('callCamEnabled','Camera on when joining','Your default camera state at the start of a call.')}<label className="block text-sm">Preferred camera resolution<select className={input+' mt-2'} value={form.callQuality||'720p'} onChange={e=>update('callQuality',e.target.value)}><option value="360p">360p – low bandwidth</option><option value="720p">720p – HD</option><option value="1080p">1080p – Full HD</option></select></label><p className="text-xs text-zinc-400">Resolution applies to the next camera capture. LiveKit automatically adapts published video quality to network conditions.</p>
       <section aria-label="Video background effects" className="space-y-3">
         <h3 className="font-bold">Background effects</h3>
         <p className="text-xs text-zinc-400">Blur the surroundings or replace them with a built-in background. Applied to the outgoing camera video, not just the preview.</p>
         <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
           {BACKGROUND_SCENES.map(scene=><button type="button" key={scene.id} aria-pressed={(form.callBackgroundMode||'none')===scene.id}
             onClick={()=>update('callBackgroundMode',scene.id)}
             className={'overflow-hidden rounded-xl border-2 p-1 text-left text-xs '+((form.callBackgroundMode||'none')===scene.id?'border-violet-400 bg-violet-900/40':'border-zinc-700 hover:border-zinc-500')}>
             {scene.image?<img src={scene.image} alt="" className="mb-2 aspect-video w-full rounded-lg object-cover"/>:<div className={'mb-2 flex aspect-video w-full items-center justify-center rounded-lg text-sm '+(scene.id==='blur'?'bg-zinc-600/40 backdrop-blur-xl':'bg-zinc-700')}>{scene.id==='blur'?'Blur':'No effect'}</div>}
             <span className="block p-1 font-semibold">{scene.label}</span>
           </button>)}
         </div>
       </section>{switchable('callMirror','Mirror local preview','Affects your own video preview only; remote participants see the normal feed.')}</>}
     {tab==='recording'&&<><h3 className="font-bold">Meeting recording</h3><p className="text-sm text-zinc-300">Server-side recording and transcription require an egress service and retention policy; not enabled yet.</p><p className="text-xs text-zinc-500">You can use your browser or operating system screen recorder independently, but it is not managed by NovaNexus. No fake recording switch is displayed.</p></>}
     {tab==='advanced'&&<><h3 className="font-bold">Advanced conference controls</h3><div className="space-y-4 text-sm">{['Grid and speaker layouts: available in the LiveKit conference controls','In-room chat and participant list: available in the conference toolbar','Screen sharing: available through the conference toolbar','Breakout rooms: requires host orchestration; not enabled','Remote control: requires permission protocol; not enabled','Guest waiting room and approval: not enabled','Background blur and virtual backgrounds: configure in Video settings'].map(x=><div key={x} className="rounded-xl border border-zinc-700 p-4">{x}</div>)}</div></>}
     {notice&&<p role="status" className="rounded-lg bg-amber-900/30 p-3 text-xs text-amber-200">{notice}</p>}
    </div>
    <footer className="flex justify-end gap-3 border-t border-zinc-700 p-5"><button className="rounded-xl px-5 py-2 text-sm hover:bg-zinc-800" onClick={onClose}>Cancel</button><button onClick={save} className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-bold">Save Settings</button></footer>
   </div>
  </div>
 </div>;
}
