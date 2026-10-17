<template>
 <section class="spc-preview" :aria-label="$t('Archivo SPC: reproducción')">
  <header><strong>{{ $t('Archivo SPC: reproducción') }}</strong><button @click="$emit('close')">{{ $t('Volver a las canciones de la ROM') }}</button></header>
  <h3>{{file.tags.title||filename}}</h3><p>{{file.tags.game||filename}}<span v-if="file.tags.artist"> · {{file.tags.artist}}</span></p>
  <p class="notice">{{ $t('Reproducción de sólo lectura con el driver e instrumentos originales del archivo SPC. La ROM permanece sin cambios.') }}</p>
  <div class="transport"><button :disabled="state==='loading'||state==='playing'" @click="play">{{ $t('Reproducir audio') }}</button><button :disabled="state!=='playing'" @click="pause">{{ $t('Pausar audio') }}</button><button @click="stop">{{ $t('Detener') }}</button><output>{{time(position)}} / {{time(file.duration)}}</output><span v-if="state==='loading'">{{ $t('Preparando reproducción SPC…') }}</span></div>
  <label class="seek">{{ $t('Posición en segundos') }}<input type="range" min="0" :max="file.duration" step="0.1" :value="position" @pointerdown="beginSeek" @input="seekPosition" @change="finishSeek" @pointerup="finishSeek" @pointercancel="finishSeek" @blur="finishSeek" /></label>
  <div class="voices"><span>{{ $t('Escuchar solo este canal') }}</span><button v-for="voice in 8" :key="voice" :aria-pressed="solo===voice-1" :class="{active:solo===voice-1}" @click="toggleSolo(voice-1)">{{ $t('Voz DSP') }} {{voice}}</button><button :class="{active:solo===null}" @click="toggleSolo(null)">{{ $t('Escuchar todos los canales') }}</button></div>
  <p v-if="error" class="error" role="alert">{{ $t(error) }}</p>
 </section>
</template>
<script>
import {MusicPlayback} from '../editor/music-playback.mjs';
import MusicWorker from '../editor/music-playback-worker.mjs?worker';
export default {props:{file:Object,filename:String},emits:['close'],data(){return {position:0,state:'stopped',solo:null,error:'',seeking:false,resumeSeek:false};},beforeUnmount(){this.halt();},methods:{
 time(seconds){return `${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;},
 halt(){this._player?.stop();this._player=null;this.state='stopped';},
 stop(){this.halt();this.position=0;},
 async play(){this.error='';if(this.state==='playing'||this.state==='loading')return;try{if(this.state==='paused'){await this._player.resume();return;}if(this.position>=this.file.duration)this.position=0;const player=new MusicPlayback({createWorker:()=>new MusicWorker(),onState:s=>{this.state=s;},onPosition:p=>{this.position=p;},onError:e=>{this.error=e.message;}});this._player=player;await player.play(this.file.bytes,this.position,this.file.duration,this.solo);}catch(error){this.halt();this.error=error.message;}},
 async pause(){try{await this._player?.pause();}catch(error){this.halt();this.error=error.message;}},
 beginSeek(){this.resumeSeek=this.state==='playing'||this.state==='loading';this.seeking=true;this.halt();},
 seekPosition(event){if(!this.seeking)this.beginSeek();this.position=Number(event.target.value);},
 finishSeek(){if(!this.seeking)return;const resume=this.resumeSeek;this.seeking=false;this.resumeSeek=false;this.halt();if(resume&&this.position<this.file.duration)this.play();},
 toggleSolo(channel){if(this._player&&(this.state==='playing'||this.state==='paused'))this.position=this._player.position();this.halt();this.solo=channel===this.solo?null:channel;this.play();}
}};
</script>
<style scoped>
.spc-preview{padding:18px;background:#1d2d40;border:1px solid #7699b9;border-radius:9px;margin:14px 0;color:#d9e9f8}.spc-preview header,.transport,.voices{display:flex;align-items:center;gap:9px;flex-wrap:wrap}.spc-preview header{justify-content:space-between}.spc-preview p{font-size:12px;line-height:1.6}.spc-preview .notice{color:#edcc90}.spc-preview button{padding:7px 9px;background:#253b50;color:#deefff;border:1px solid #6c88a2;border-radius:4px;cursor:pointer;font:inherit}.spc-preview button.active{background:#397b69}.spc-preview button:disabled{opacity:.4;cursor:default}.transport output{font:14px monospace}.seek{display:flex;align-items:center;gap:12px;margin:18px 0;font-size:12px}.seek input{flex:1;min-width:80px;accent-color:#80ccb6}.voices{font-size:11px}.spc-preview .error{color:#ffd0bd}.spc-preview :focus-visible{outline:2px solid #a4ddff;outline-offset:2px}
</style>
