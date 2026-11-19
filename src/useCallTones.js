import {useEffect,useRef,useState} from 'react';

// Original, synthetic call tones. No remote audio files or media permissions.
// Browsers may block sound until the visitor interacts with the site.
export function useCallTones(kind,enabled) {
 const context=useRef(null);
 const timer=useRef(null);
 const [blocked,setBlocked]=useState(false);
 useEffect(()=>{
  if(!enabled||!kind){setBlocked(false);return;}
  let stopped=false;
  let ctx;
  try {
   const AudioContext=window.AudioContext||window.webkitAudioContext;
   if(!AudioContext){setBlocked(true);return;}
   ctx=new AudioContext();context.current=ctx;
   const playTone=(start,seconds,freq,volume)=>{
    const osc=ctx.createOscillator();
    const gain=ctx.createGain();
    osc.type='sine';osc.frequency.value=freq;
    gain.gain.setValueAtTime(0,start);
    gain.gain.linearRampToValueAtTime(volume,start+0.025);
    gain.gain.setValueAtTime(volume,start+Math.max(0.03,seconds-0.05));
    gain.gain.linearRampToValueAtTime(0,start+seconds);
    osc.connect(gain);gain.connect(ctx.destination);
    osc.start(start);osc.stop(start+seconds+0.015);
   };
   const ring=()=>{
    if(stopped||ctx.state!=='running')return;
    const t=ctx.currentTime+0.035;
    if(kind==='incoming'){
      playTone(t,0.45,523.25,0.075);
      playTone(t+0.52,0.45,659.25,0.075);
      playTone(t+1.04,0.55,783.99,0.075);
    }else{
      playTone(t,0.9,440,0.035);
      playTone(t+1.0,0.9,480,0.035);
    }
   };
   ctx.resume().then(()=>{if(!stopped){setBlocked(ctx.state!=='running');ring();}}).catch(()=>{if(!stopped)setBlocked(true)});
   timer.current=window.setInterval(ring,kind==='incoming'?3600:4300);
  }catch{setBlocked(true);}
  return()=>{
   stopped=true;
   if(timer.current){clearInterval(timer.current);timer.current=null;}
   if(ctx){ctx.close().catch(()=>{});if(context.current===ctx)context.current=null;}
  };
 },[kind,enabled]);
 return blocked;
}
