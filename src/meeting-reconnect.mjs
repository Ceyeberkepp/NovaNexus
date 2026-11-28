// Keep reconnection decisions deterministic and testable.
export function mayStartJoin({active=false,inFlight=false}={}) {
 return Boolean(active && !inFlight);
}
export function acceptJoinResponse({active=false,requestEpoch=0,currentEpoch=0}={}) {
 return Boolean(active && requestEpoch===currentEpoch);
}
export function recoveryDelayMs(attempt) {
 return 2500*Math.max(1,Math.min(2,Number(attempt)||1));
}
