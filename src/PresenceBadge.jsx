import React from 'react';
import {Check,Minus,Clock} from 'lucide-react';

const colors={
 available:'bg-emerald-500 text-white',
 busy:'bg-rose-500 text-white',
 away:'bg-amber-400 text-amber-950',
 offline:'bg-slate-400 text-white'
};
export function PresenceBadge({status='offline',size='sm',className=''}) {
 const value=Object.prototype.hasOwnProperty.call(colors,status)?status:'offline';
 const Icon=value==='available'?Check:value==='busy'?Minus:value==='away'?Clock:null;
 const style=size==='xs'?'h-3.5 w-3.5':'h-4 w-4';
 return <span aria-label={'Status: '+value} title={value==='available'?'Available':value==='busy'?'Busy':value==='away'?'Away':'Offline'} role="img"
  className={`inline-flex shrink-0 items-center justify-center rounded-full border-2 border-white ${style} ${colors[value]} ${className}`}>
  {Icon&&<Icon size={size==='xs'?8:10} strokeWidth={3}/>}
 </span>;
}

export function PresenceSelect({status='offline',onChange}) {
 return <label className="flex items-center gap-2 text-xs text-slate-600">
  <PresenceBadge status={status}/>
  <span className="sr-only">My availability</span>
  <select aria-label="Set my availability" value={status} onChange={event=>onChange(event.target.value)}
   className="max-w-28 rounded-lg border border-slate-200 bg-white px-1.5 py-1.5 text-xs font-semibold text-slate-700">
   <option value="available">Available</option>
   <option value="away">Away</option>
   <option value="busy">Busy</option>
   <option value="offline">Appear offline</option>
  </select>
 </label>;
}
