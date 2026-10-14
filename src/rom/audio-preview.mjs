// Shared by the native preview and the track transport bar.
export function audioPlaybackState(audio) {
  return {time:Number.isFinite(audio?.currentTime)?audio.currentTime:0,
    duration:Number.isFinite(audio?.duration)?audio.duration:0,
    playing:!!audio&&!audio.paused&&!audio.ended};
}
export async function controlAudioPreview(audio,{action,time=0}) {
  if(!audio)return audioPlaybackState(null);
  if(action==='play')await audio.play();
  else if(action==='pause')audio.pause();
  else if(action==='stop'){audio.pause();audio.currentTime=0;}
  else if(action==='seek'&&Number.isFinite(time))audio.currentTime=Math.max(0,Math.min(audioPlaybackState(audio).duration,time));
  return audioPlaybackState(audio);
}
