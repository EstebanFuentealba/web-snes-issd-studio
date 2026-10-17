<template>
  <div class="sample-preview">
    <header><strong>{{ $t('Lista de pistas') }}</strong><span>{{ $t(label) }}</span></header>
    <div class="preview-ruler"><span v-for="i in 7" :key="i">{{((i-1)*duration/6).toFixed(2)}} s</span></div>
    <div class="preview-track">
      <div class="track-name"><span>01</span><strong>{{track.name}}</strong></div>
      <div ref="lane" class="preview-lane" role="slider" tabindex="0" :aria-label="$t('Posición de reproducción')" :aria-valuemin="0" :aria-valuemax="duration" :aria-valuenow="Math.min(playback.time,duration)" @pointerdown="seek" @keydown.left.prevent="transport('backward')" @keydown.right.prevent="transport('forward')" @keydown.home.prevent="transport('start')" @keydown.end.prevent="transport('end')" @keydown.space.prevent="transport(playback.playing?'pause':'play')">
        <div class="preview-clip"><span>{{track.name}}</span><canvas ref="wave" width="1200" height="140" role="img" :aria-label="$t('Forma de onda')" /></div>
        <div class="preview-playhead" :style="{left:(duration?Math.min(1,playback.time/duration)*100:0)+'%'}"><span>▼</span></div>
      </div>
    </div>
    <footer role="group" :aria-label="$t('Controles de audio')">
      <output :aria-label="$t('Tiempo de reproducción')">{{timecode(playback.time)}} <small>/ {{timecode(duration)}}</small></output>
      <div class="preview-buttons"><button v-for="control in controls" :key="control.action" :disabled="!duration||(control.action==='pause'&&!playback.playing)||(control.action==='play'&&playback.playing)" :aria-label="$t(control.label)" :title="$t(control.label)" :aria-pressed="control.action==='loop'?loop:undefined" @click="transport(control.action)"><svg viewBox="0 0 24 24" aria-hidden="true"><path :d="control.path" /></svg></button></div>
    </footer>
  </div>
</template>
<script>
import {AUDIO_TRANSPORT_CONTROLS} from '../editor/audio-transport.mjs';
export default {
  props:{track:{type:Object,required:true},playback:{type:Object,required:true},loop:Boolean,label:String},emits:['transport'],
  data(){return {controls:AUDIO_TRANSPORT_CONTROLS};},
  computed:{duration(){return this.track.samples.length/this.track.rate;}},
  watch:{track(){this.$nextTick(()=>this.draw());}},mounted(){this.draw();},
  methods:{
    timecode(time){const ms=Math.max(0,Math.round((time||0)*1000));return String(Math.floor(ms/60000)).padStart(2,'0')+':'+String(Math.floor(ms/1000)%60).padStart(2,'0')+'.'+String(ms%1000).padStart(3,'0');},
    transport(action){if(!this.duration)return;const offsets={start:0,end:this.duration,backward:this.playback.time-1,forward:this.playback.time+1};this.$emit('transport',Object.hasOwn(offsets,action)?{action:'seek',time:Math.max(0,Math.min(this.duration,offsets[action]))}:{action});},
    seek(event){const bounds=this.$refs.lane.getBoundingClientRect();if(!bounds.width||!this.duration)return;event.preventDefault();this.$emit('transport',{action:'seek',time:Math.max(0,Math.min(1,(event.clientX-bounds.left)/bounds.width))*this.duration});},
    draw(){const canvas=this.$refs.wave;if(!canvas)return;const ctx=canvas.getContext('2d'),samples=this.track.samples;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.strokeStyle='#80ccb6';ctx.beginPath();for(let x=0;x<canvas.width;x++){const start=Math.floor(x*samples.length/canvas.width),end=Math.max(start+1,Math.floor((x+1)*samples.length/canvas.width));let low=0,high=0;for(let i=start;i<end;i++){low=Math.min(low,samples[i]||0);high=Math.max(high,samples[i]||0);}ctx.moveTo(x,70-low/32768*64);ctx.lineTo(x,70-high/32768*64);}ctx.stroke();},
  },
};
</script>
<style scoped>
.sample-preview{margin-top:16px;background:#162131;border:1px solid #37485d;border-radius:10px;overflow:hidden;min-width:0;color:#dce8f4}.sample-preview header{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;background:#202d3e;border-bottom:1px solid #35465c;padding:10px 12px}.sample-preview header strong{text-transform:uppercase;font-size:10px;letter-spacing:.12em}.sample-preview header span{font-size:11px;color:#9db0c9}.preview-ruler{display:flex;justify-content:space-between;padding:10px 12px 10px 150px;color:#9cb1ca;background:#192637;font:10px monospace}.preview-track{display:grid;grid-template-columns:138px minmax(0,1fr);min-height:174px}.track-name{display:flex;align-items:flex-start;gap:9px;padding:16px 10px;background:#202d3e;border-right:1px solid #35465c;border-left:3px solid #80ccb6;font-size:11px;overflow-wrap:anywhere;min-width:0}.track-name>span{color:#80ccb6;font:16px monospace}.track-name strong{min-width:0}.preview-lane{position:relative;padding:12px 0;cursor:crosshair;min-width:0;background:repeating-linear-gradient(90deg,transparent 0,transparent calc(100% / 6 - 1px),#ffffff0d calc(100% / 6 - 1px),#ffffff0d calc(100% / 6))}.preview-clip{border:1px solid #526b63;background:#21483f;border-radius:4px;overflow:hidden}.preview-clip>span{display:block;padding:4px 9px;background:#305b51;color:#d4f6e8;font-size:11px}.preview-clip canvas{display:block;width:100%;height:140px;pointer-events:none}.preview-playhead{position:absolute;top:0;bottom:0;border-left:2px solid #edca89;pointer-events:none}.preview-playhead>span{position:absolute;top:-4px;left:-7px;color:#edca89;font-size:13px}.sample-preview footer{display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:10px 12px;background:#111b28;border-top:1px solid #35465c}.sample-preview output{font:16px monospace;color:#83c9f2;font-variant-numeric:tabular-nums}.sample-preview output small{font-size:11px;color:#9db0c9}.preview-buttons{display:flex;gap:3px}.sample-preview .preview-buttons button{display:grid;place-items:center;width:30px;height:30px;padding:5px;background:transparent;border:1px solid transparent;color:#dce8f4;border-radius:4px;cursor:pointer}.sample-preview .preview-buttons button:hover:not(:disabled),.sample-preview .preview-buttons button[aria-pressed=true]{background:#305b51;color:#a4f0d4;border-color:#526b63}.preview-buttons svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.sample-preview .preview-buttons button:disabled{opacity:.35;cursor:default}.preview-lane:focus-visible{outline:2px solid #a4d9ff;outline-offset:-2px}@media(max-width:600px){.preview-track{grid-template-columns:88px minmax(0,1fr)}.preview-ruler{padding-left:100px;font-size:9px}.preview-ruler span:nth-child(even){display:none}.track-name{flex-direction:column}.sample-preview footer{gap:8px}.preview-buttons{flex-wrap:wrap}}
</style>
