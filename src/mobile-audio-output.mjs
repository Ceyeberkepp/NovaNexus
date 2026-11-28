export function audioRoutingAvailable({supportsDeviceSelection=false,hasEnumerate=false,hasSwitch=false}={}){
 return Boolean(supportsDeviceSelection&&hasEnumerate&&hasSwitch);
}
export function outputChoices(devices){
 return (Array.isArray(devices)?devices:[]).filter(d=>d?.kind==='audiooutput');
}

/* Prefer an exposed built-in loudspeaker, without assuming browsers expose
   or permit routing to a physical device. Never choose Bluetooth automatically. */
export function preferredSpeakerId(devices){
 const speakers=outputChoices(devices);
 const builtIn=speakers.find(d=>d.deviceId && /speaker|loudspeaker/i.test(d.label||'') && !/bluetooth|headset|earpiece|receiver|airpods|headphones/i.test(d.label||''));
 return builtIn?.deviceId || '';
}
