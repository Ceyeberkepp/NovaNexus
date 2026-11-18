import React,{useEffect,useState} from 'react';
import {GridLayout,ParticipantTile,RoomAudioRenderer,TrackToggle,useTracks,useParticipants,useRoomContext,Chat} from '@livekit/components-react';
import {Track} from 'livekit-client';
import {Mic,Video,MonitorUp,MessageCircle,Users,MoreVertical,PhoneOff,Disc,X,Grid2X2} from 'lucide-react';
import './conference.css';

// All participant tiles come from authenticated LiveKit tracks, never demo state.
export default function ConferenceStage({roomId,onEnd}){
 const room=useRoomContext();
 const tracks=useTracks([{source:Track.Source.Camera,withPlaceholder:true},{source:Track.Source.ScreenShare,withPlaceholder:false}]);
 const participants=useParticipants();
 const [drawer,setDrawer]=useState('');
 const [layout,setLayout]=useState('grid');
 const label=roomId||'Meeting';
 const leave=async()=>{try{await room.disconnect()}finally{onEnd?.()}};
 return <div className="nexus-conference-stage" data-lk-theme="default">
   <header className="nexus-video-label"><span className="nexus-live-dot"/> {label} <span className="nexus-stage-count">{participants.length} participant{participants.length===1?'':'s'}</span></header>
   <div className={'nexus-video-area '+(drawer?'nexus-with-drawer':'')}>
     <GridLayout tracks={tracks} className={'nexus-video-grid '+(layout==='speaker'?'nexus-speaker-mode':'')}><ParticipantTile/></GridLayout>
     <RoomAudioRenderer/>
   </div>
   {drawer&&<aside className="nexus-meeting-drawer">
     <div className="nexus-drawer-head"><h2>{drawer==='chat'?'Meeting Chat':'Participants'}</h2><button aria-label="Close meeting panel" onClick={()=>setDrawer('')}><X size={18}/></button></div>
     {drawer==='chat'?<div className="nexus-real-chat"><Chat/></div>:<div className="nexus-real-roster">{participants.map(p=><div key={p.sid||p.identity} className="nexus-roster-person"><span className="nexus-roster-avatar">{String(p.name||p.identity||'?').split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase()}</span><div><strong>{p.name||p.identity||'Member'}</strong><p>{p.isLocal?'You':'Connected'}</p></div></div>)}</div>}
   </aside>}
   <footer className="nexus-float-toolbar" role="toolbar" aria-label="Meeting controls">
     <TrackToggle source={Track.Source.Microphone} showIcon={true} aria-label="Toggle microphone" className="nexus-meeting-control"/>
     <TrackToggle source={Track.Source.Camera} showIcon={true} aria-label="Toggle camera" className="nexus-meeting-control"/>
     <TrackToggle source={Track.Source.ScreenShare} showIcon={true} aria-label="Share screen" className="nexus-meeting-control"/>
     <button aria-label="Change video layout" title="Toggle speaker or grid layout" className="nexus-meeting-control" onClick={()=>setLayout(s=>s==='grid'?'speaker':'grid')}><Grid2X2 size={18}/></button>
     <span className="nexus-control-divider"/>
     <button aria-label="Meeting chat" aria-pressed={drawer==='chat'} className={'nexus-meeting-control '+(drawer==='chat'?'nexus-active':'')} onClick={()=>setDrawer(d=>d==='chat'?'':'chat')}><MessageCircle size={19}/></button>
     <button aria-label="Participants" aria-pressed={drawer==='people'} className={'nexus-meeting-control '+(drawer==='people'?'nexus-active':'')} onClick={()=>setDrawer(d=>d==='people'?'':'people')}><Users size={19}/></button>
     <button aria-label="More meeting options" className="nexus-meeting-control" onClick={()=>window.dispatchEvent(new Event('novanexus:meeting-more'))}><MoreVertical size={19}/></button>
     <button aria-label="End meeting" onClick={leave} className="nexus-end-call"><PhoneOff size={16}/><span>End</span></button>
   </footer>
 </div>;
}
