import {Track} from 'livekit-client';
import {BackgroundProcessor,supportsBackgroundProcessors} from '@livekit/track-processors';

export const BACKGROUND_SCENES = [
  {id:'none',label:'None',image:''},
  {id:'blur',label:'Blur',image:''},
  {id:'studio',label:'Nova Studio',image:'/backgrounds/nova-studio.svg'},
  {id:'violet',label:'Purple Gradient',image:'/backgrounds/purple-gradient.svg'},
  {id:'office',label:'Modern Office',image:'/backgrounds/modern-office.svg'},
];

const activeProcessors=new WeakMap();
const pending=new WeakMap();

function desiredBackground(prefs={}){
 const mode=prefs.callBackgroundMode||'none';
 if(mode==='none')return {mode:'disabled'};
 if(mode==='blur')return {mode:'background-blur',blurRadius:15};
 const scene=BACKGROUND_SCENES.find(x=>x.id===mode&&x.image);
 return scene?{mode:'virtual-background',imagePath:scene.image}:{mode:'disabled'};
}

// Change the *published camera track*. CSS filters on local preview cannot
// blur the background sent to other call participants.
export async function applyVideoBackground(room,prefs={}){
 if(!room?.localParticipant)return {applied:false,reason:'not-connected'};
 const publication=room.localParticipant.getTrackPublication(Track.Source.Camera);
 const track=publication?.track;
 if(!track)return {applied:false,reason:'camera-off'};
 const requested=desiredBackground(prefs);
 if(requested.mode!=='disabled'&&!supportsBackgroundProcessors()){
  throw Error('Background effects are not supported by this browser. Your camera is unchanged.');
 }
 if(pending.has(track))await pending.get(track).catch(()=>{});
 const update=(async()=>{
   if(requested.mode==='disabled'){
     if(activeProcessors.has(track)){
       await track.stopProcessor();
       activeProcessors.delete(track);
     }
     return {applied:true};
   }
   const existing=activeProcessors.get(track);
   if(existing&&typeof existing.switchTo==='function'){
     await existing.switchTo(requested);
   }else{
     const processor=BackgroundProcessor(requested);
     await track.setProcessor(processor);
     activeProcessors.set(track,processor);
   }
   return {applied:true};
 })();
 pending.set(track,update);
 try{return await update;}finally{if(pending.get(track)===update)pending.delete(track);}
}
