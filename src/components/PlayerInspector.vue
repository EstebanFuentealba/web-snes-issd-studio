<template>
  <section class="player-inspector" :aria-label="$t('Jugador seleccionado')">
    <header><div><span class="eyebrow">{{ $t('Jugador seleccionado') }}</span><h3><span class="jersey">{{ player.no }}</span> {{ player.name }}</h3><p>{{ $t(positions[player.position]) }}</p></div><button :disabled="!modified" @click="$emit('restore')">{{ $t('Restaurar jugador') }}</button></header>
    <div class="inspector-body">
      <div class="portrait">
        <div class="sprite-stage"><RomImage :matrix="currentFrame.matrix" :colors="currentFrame.colors" :label="player.name" /></div>
        <div class="rotation-controls"><button @click="step(-1)" :aria-label="$t('Girar a la izquierda')">‹</button><button @click="rotating=!rotating" :aria-pressed="rotating">{{ $t(rotating?'Pausar rotación':'Rotar jugador') }}</button><button @click="step(1)" :aria-label="$t('Girar a la derecha')">›</button></div>
      </div>
      <div class="statistics">
        <div v-for="stat in gameStats" :key="stat.key" class="stat-row">
          <span class="stat-label" :title="$t(stat.key)">{{ stat.label }}</span>
          <div class="stat-segments" role="group" :aria-label="$t(stat.key)" @keydown="keyStat(stat.key,$event)">
            <button v-for="value in 10" :key="value" :class="{filled:value<=player[stat.key]}" :tabindex="value===player[stat.key]?0:-1" :aria-label="`${$t(stat.key)}: ${value}/10`" :aria-pressed="value===player[stat.key]" :title="`${$t(stat.key)}: ${value}/10`" @click="setStat(stat.key,value)" />
          </div>
          <output>{{ player[stat.key] }}<small>/10</small></output>
        </div>
        <p class="hint">{{ $t('Haz clic en una barra para cambiar el valor. También puedes usar las flechas del teclado.') }}</p>
      </div>
    </div>
  </section>
</template>
<script>
import RomImage from './RomImage.vue';
import {playerPreviewFrames} from '../rom/player-preview.mjs';
import {POSITIONS} from '../rom/players.mjs';
export default {
  components:{RomImage},props:{rom:Uint8Array,teamIndex:Number,player:Object,modified:Boolean},emits:['edit','restore'],
  data(){return {direction:0,rotating:true,timer:null,positions:POSITIONS,gameStats:[{key:'speed',label:'SPEED'},{key:'acceleration',label:'DASH'},{key:'shotPower',label:'SHOT POW.'},{key:'curl',label:'CURVE SKILL'},{key:'balance',label:'BALANCE'},{key:'intelligence',label:'INTELLIGENCE'},{key:'jump',label:'JUMP'},{key:'dribbling',label:'DRIBBLE'},{key:'energy',label:'STAMINA'}]};},
  computed:{frames(){return playerPreviewFrames(this.rom,this.teamIndex,this.player);},currentFrame(){return this.frames[this.direction];}},
  mounted(){this.rotating=!window.matchMedia('(prefers-reduced-motion: reduce)').matches;this.timer=setInterval(()=>{if(this.rotating&&!document.hidden)this.direction=(this.direction+1)%8;},220);},
  beforeUnmount(){clearInterval(this.timer);},
  methods:{
    step(delta){this.rotating=false;this.direction=(this.direction+delta+8)%8;},
    setStat(key,value){if(value!==this.player[key])this.$emit('edit',key,value);},
    keyStat(key,event){const delta={ArrowRight:1,ArrowUp:1,ArrowLeft:-1,ArrowDown:-1}[event.key];if(delta===undefined&&!['Home','End'].includes(event.key))return;event.preventDefault();const value=event.key==='Home'?1:event.key==='End'?10:Math.max(1,Math.min(10,this.player[key]+delta));this.setStat(key,value);const group=event.currentTarget;this.$nextTick(()=>group.querySelectorAll('button')[value-1]?.focus());},
  },
};
</script>
<style scoped>
.player-inspector{margin:18px 0 24px;padding:20px;border:1px solid #3463a0;border-radius:12px;background:linear-gradient(125deg,#142f57,#0c203e);color:#f4f8ff;box-shadow:inset 0 0 0 3px #ffffff05}
header{display:flex;justify-content:space-between;align-items:center;gap:12px;border-bottom:1px solid #ffffff20;padding-bottom:12px}h3{margin:6px 0;font-size:24px}header p{margin:0;color:#b9cde9;font-size:13px}.eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#93b8ed}.jersey{color:#ffd66e;font-variant-numeric:tabular-nums}
.player-inspector button{cursor:pointer}.player-inspector header button,.rotation-controls button{background:#203e65;color:#e9f2ff;border:1px solid #52719b;border-radius:5px;padding:6px 10px;margin:0}.player-inspector button:disabled{opacity:.4;cursor:default}
.inspector-body{display:grid;grid-template-columns:200px minmax(300px,1fr);gap:32px;align-items:center;padding-top:20px}.sprite-stage{height:240px;display:flex;justify-content:center;align-items:center;background:radial-gradient(ellipse at 50% 85%,#1d674860,transparent 48%)}.sprite-stage :deep(canvas){height:224px;max-width:none;background:transparent;border:0}.rotation-controls{display:flex;justify-content:center;gap:5px;font-size:12px}.rotation-controls button{font-size:inherit}.stat-row{display:grid;grid-template-columns:125px minmax(140px,240px) 48px;gap:12px;align-items:center;margin:8px 0}.stat-label{font:700 13px monospace;letter-spacing:.4px}.stat-segments{display:grid;grid-template-columns:repeat(10,1fr);gap:4px}.stat-segments button{height:25px;min-width:0;width:100%;padding:0;margin:0;border:1px solid #734532;border-radius:1px;background:#593126;transition:background .1s}.stat-segments button.filled{background:linear-gradient(to bottom,#ffeab0 0 24%,#ffbb53 24% 74%,#e48b36 74%);border-color:#ffd36d}.stat-segments button:hover{background:#fff0b0;border-color:white}.stat-segments button:focus-visible,.rotation-controls button:focus-visible{outline:2px solid #75d9ff;outline-offset:3px}output{color:#ffd66e;font:700 16px monospace}output small{color:#849ab9;font-size:11px}.hint{color:#9db6d8;font-size:12px;margin:18px 0 0}
@media(max-width:700px){.inspector-body{grid-template-columns:1fr;gap:20px}.sprite-stage{height:180px}.sprite-stage :deep(canvas){height:168px}.stat-row{grid-template-columns:100px minmax(0,1fr) 36px;gap:6px}.stat-label{font-size:11px}.stat-segments{gap:3px}.player-inspector{padding:14px}.rotation-controls{margin-top:8px}}
</style>
