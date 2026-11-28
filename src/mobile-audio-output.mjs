export function audioRoutingAvailable({supportsDeviceSelection=false,hasEnumerate=false,hasSwitch=false}={}){
 return Boolean(supportsDeviceSelection&&hasEnumerate&&hasSwitch);
}
export function outputChoices(devices){
 return (Array.isArray(devices)?devices:[]).filter(d=>d?.kind==='audiooutput');
}
