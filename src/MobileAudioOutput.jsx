import React,{useEffect,useState} from 'react';
import {useRoomContext} from '@livekit/components-react';
import {supportsAudioOutputSelection} from 'livekit-client';
import {Volume2,ChevronDown,X} from 'lucide-react';
import {audioRoutingAvailable, outputChoices, preferredSpeakerId} from './mobile-audio-output.mjs';

// Mobile browsers do not all offer an API for switching call output.
// Only offer an actual route switch if the browser + LiveKit support it.
// iOS Safari delegates speaker/earpiece/Bluetooth routing to iOS itself.
export default function MobileAudioOutput(){
 const room=useRoomContext();
 const [open,setOpen]=useState(false);
 const [devices,setDevices]=useState([]);
 const [selected,setSelected]=useState('');
 const [error,setError]=useState('');
 const [routeNote,setRouteNote]=useState('');
 const supported=audioRoutingAvailable({
   supportsDeviceSelection:typeof supportsAudioOutputSelection==='function' && supportsAudioOutputSelection(),
   hasEnumerate:typeof navigator!=='undefined' && !!navigator.mediaDevices?.enumerateDevices,
   hasSwitch:typeof room?.switchActiveDevice==='function'
 });
 useEffect(()=>{
  if(!supported)return;
  let live=true;
  const refresh=()=>navigator.mediaDevices.enumerateDevices().then(all=>{
   if(!live)return;
   const choices=outputChoices(all);
   setDevices(choices);
   // On first arrival, prefer a specifically identified built-in speaker.
   // Do not override a user-selected route or reroute to Bluetooth.
   if(!selected){
    const speaker=preferredSpeakerId(choices);
    if(speaker)room.switchActiveDevice('audiooutput',speaker).then(ok=>{
      if(live&&ok!==false){setSelected(speaker);setRouteNote('Speaker selected.');}
    }).catch(()=>{if(live)setRouteNote('Your browser controls the default audio route.');});
   }
  }).catch(()=>{if(live)setError('Audio output devices could not be listed. Check browser permissions.');});
  refresh();
  navigator.mediaDevices?.addEventListener?.('devicechange',refresh);
  return()=>{live=false;navigator.mediaDevices?.removeEventListener?.('devicechange',refresh)};
 },[supported,room]);
 async function choose(id){
  setError('');
  try{
   const changed=await room.switchActiveDevice('audiooutput',id);
   if(changed===false)throw new Error('This output route was not accepted by the browser.');
   setSelected(id);
   setOpen(false);
  }catch(e){setError(e?.message||'This browser cannot change the audio output.');}
 }
 return <>
  <button type="button" aria-label="Mobile call audio output" title="Call audio output" aria-expanded={open}
    className="nexus-meeting-control nexus-mobile-audio-button" onClick={()=>setOpen(v=>!v)}>
    <Volume2 size={19}/><ChevronDown size={12}/>
  </button>
  {open&&<div role="dialog" aria-label="Call audio output" className="nexus-mobile-audio-panel">
    <div className="nexus-mobile-audio-heading"><strong>Call audio output</strong><button aria-label="Close audio options" onClick={()=>setOpen(false)}><X size={18}/></button></div>
    {supported?<>
      <p>Speakerphone is preferred when your browser exposes a built-in speaker. Select another output here when available.</p>
      <button className="nexus-mobile-output-choice" onClick={()=>choose('')} aria-pressed={selected===''}>System default</button>
      {devices.filter(d=>d.deviceId).map((device,i)=><button key={device.deviceId} onClick={()=>choose(device.deviceId)} aria-pressed={selected===device.deviceId} className="nexus-mobile-output-choice">{device.label||'Audio device '+(i+1)}</button>)}
      {devices.length===0&&<p>No additional output devices are available. Connect a speaker or Bluetooth headset and reopen this menu.</p>}
    </>:<>
      <p>Your mobile browser does not allow websites to switch between the phone earpiece and speakerphone directly.</p>
      <p><strong>iPhone:</strong> open iOS Control Center and use the AirPlay/audio output selector to choose iPhone or a connected Bluetooth device, where available. During a browser call, iOS manages the earpiece/speakerphone route.</p>
      <p><strong>Android:</strong> use the phone's system media-output or Bluetooth controls if the browser does not expose speaker selection.</p>
    </>}
    {routeNote&&<p role="status">{routeNote}</p>}
    {error&&<p role="alert" className="nexus-mobile-output-error">{error}</p>}
  </div>}
 </>;
}
