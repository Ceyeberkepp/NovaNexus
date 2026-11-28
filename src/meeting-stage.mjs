// Deterministic meeting stage selection. Screen sharing always wins over speakers.
// LiveKit participant and track references are used directly; never synthesize demo tracks.
export function selectStage(tracks, activeSpeakers, screenSource='screen_share', cameraSource='camera') {
 const available = Array.isArray(tracks) ? tracks.filter(Boolean) : [];
 const screen = available.find(t => t.source === screenSource && t.publication && !t.publication.isMuted && t.publication.track);
 if (screen) {
  return {main:screen, filmstrip:available.filter(t=>t!==screen && t.source!==screenSource), mode:'screen'};
 }
 const cameras = available.filter(t=>t.source===cameraSource);
 const active = (activeSpeakers||[]).find(p=>cameras.some(t=>t.participant?.identity===p?.identity));
 const main = cameras.find(t=>t.participant?.identity===active?.identity) ||
              cameras.find(t=>t.participant?.isLocal===false) ||
              cameras[0] || null;
 return {main, filmstrip:cameras.filter(t=>t!==main), mode:'speaker'};
}
