const MUSIC_SAMPLE_RATE=32000;

// Render the actual SPC machine off the UI thread. Web Audio only queues PCM;
// the audible clock, rather than the worker's lookahead, drives the playhead.
export class MusicPlayback {
 constructor({onPosition=()=>{},onState=()=>{},onError=()=>{},createWorker=()=>{throw new Error('No se pudo iniciar el motor SPC700.');},createContext=()=>new (window.AudioContext||window.webkitAudioContext)()}={}){Object.assign(this,{onPosition,onState,onError,createWorker,createContext});this.state='stopped';this.session=0;}
 position(){return Math.min(this.duration||0,(this.offset||0)+Math.max(0,(this.context?.currentTime||0)-(this.origin||0)));}
 async play(bytes,seconds,duration,solo=null){
  this.stop();const session=this.session;
  try{
   this.duration=duration;this.offset=Math.max(0,Math.min(seconds,duration));this.context=this.createContext();this.state='loading';this.onState(this.state);await this.context.resume();if(session!==this.session)return;
   this.worker=this.createWorker();this.state='loading';this.onState(this.state);this.queued=0;this.pending=false;this.ready=false;
   this.worker.onerror=()=>{if(session===this.session)this.fail(new Error('No se pudo iniciar el motor SPC700.'));};
   this.worker.onmessage=({data})=>{if(session!==this.session)return;if(data.type==='error')return this.fail(new Error(data.message));if(data.type==='ready'){this.ready=true;this.origin=this.context.currentTime+.08;this.state='playing';this.onState(this.state);this.pump();}else if(data.type==='pcm'){this.pending=false;const buffer=this.context.createBuffer(2,data.left.length,MUSIC_SAMPLE_RATE);buffer.copyToChannel(data.left,0);buffer.copyToChannel(data.right,1);const source=this.context.createBufferSource();source.buffer=buffer;source.connect(this.context.destination);const start=Math.max(this.origin+this.queued,this.context.currentTime+.015);if(!this.queued)this.origin=start;source.start(start);this.queued=(start-this.origin)+buffer.duration;this.pump();}};
   this.worker.postMessage({type:'load',bytes,seconds:this.offset,solo});
   this.timer=setInterval(()=>{if(this.state!=='playing')return;const position=this.position();if(position>=this.duration){const end=this.duration;this.stop();this.onPosition(end);}else{this.onPosition(position);this.pump();}},40);
  }catch(error){if(session===this.session)this.fail(error);}
 }
 pump(){if(!this.ready||this.pending||this.state!=='playing'||this.queued>=this.duration-this.offset)return;const elapsed=Math.max(0,this.context.currentTime-this.origin);if(this.queued-elapsed>.6)return;this.pending=true;this.worker.postMessage({type:'render',count:Math.max(1,Math.min(8000,Math.ceil((this.duration-this.offset-this.queued)*MUSIC_SAMPLE_RATE)))});}
 async pause(){if(this.state!=='playing')return;const session=this.session;await this.context.suspend();if(session!==this.session)return;this.state='paused';this.onState(this.state);this.onPosition(this.position());}
 async resume(){if(this.state!=='paused')return;const session=this.session;await this.context.resume();if(session!==this.session)return;this.state='playing';this.onState(this.state);this.pump();}
 stop(){this.session++;clearInterval(this.timer);this.worker?.terminate();this.worker=null;this.context?.close().catch(()=>{});this.context=null;this.state='stopped';this.onState(this.state);}
 fail(error){this.stop();this.onError(error);}
}
