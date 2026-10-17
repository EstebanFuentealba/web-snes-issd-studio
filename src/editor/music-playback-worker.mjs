import {MusicRenderer,MUSIC_SAMPLE_RATE} from './music-renderer.mjs';
let renderer;
self.onmessage=async ({data})=>{
 try {
  if(data.type==='load'){
   renderer=new MusicRenderer(data.bytes);renderer.setSolo(data.solo??null);
   // Yield between seconds so a long seek never blocks cancellation.
   let remaining=Math.round(data.seconds*MUSIC_SAMPLE_RATE);
   while(remaining>0){const n=Math.min(remaining,MUSIC_SAMPLE_RATE);renderer.skip(n);remaining-=n;await new Promise(resolve=>setTimeout(resolve,0));}
   self.postMessage({type:'ready'});
  }else if(data.type==='render'&&renderer){const pcm=renderer.render(data.count);self.postMessage({type:'pcm',...pcm},[pcm.left.buffer,pcm.right.buffer]);}
 }catch(error){self.postMessage({type:'error',message:error.message});}
};
