// Only an active, published screen share receives the primary stage.
// Without screen sharing, show every camera in an equal-size grid.
export function selectStage(tracks, activeSpeakers, screenSource='screen_share', cameraSource='camera') {
 const available = Array.isArray(tracks) ? tracks.filter(Boolean) : [];
 const cameras = available.filter(t=>t.source===cameraSource);
 const screen = available.find(t=>t.source===screenSource && t.publication && !t.publication.isMuted && t.publication.track);
 if (screen) return {main:screen, filmstrip:[], mode:'screen'};
 return {main:null, filmstrip:cameras, mode:'grid'};
}
