<template>
  <div class="roster-pitch" @keydown.esc="open=false">
    <button class="pitch-toggle" :aria-expanded="open" aria-controls="roster-pitch-panel" @click="open=!open">{{ $t('Cancha') }} · {{ formation.label }} <span>{{open?'×':'↗'}}</span></button>
    <button v-if="open" class="pitch-backdrop" :aria-label="$t('Cerrar cancha')" @click="open=false" />
    <section id="roster-pitch-panel" class="pitch-card" :class="{open}" :aria-label="$t('Disposición de jugadores')">
      <header><div><h3>{{ $t('Cancha') }} <span>{{formation.label}}</span></h3><small>{{ $t('Toca un dorsal para abrir al jugador.') }}</small></div><button class="close-pitch" :aria-label="$t('Cerrar cancha')" @click="open=false">×</button></header>
      <div class="pitch-zones"><span>DF</span><span>MF</span><span>FW</span></div>
      <svg viewBox="-8 -5 176 110" :aria-label="$t('Jugadores en la formación')">
        <rect x="1" y="1" width="158" height="98" rx="1" fill="#327846" />
        <rect v-for="i in 8" :key="i" :x="1+(i-1)*19.75" y="1" width="9.875" height="98" fill="#3b8950" />
        <path class="lines" d="M1 1H159V99H1Z M80 1V99 M1 25H29V75H1 M1 37H15V63H1 M159 25H131V75H159 M159 37H145V63H159" />
        <circle class="lines" cx="80" cy="50" r="12"/><circle cx="80" cy="50" r="1" fill="#cbe6d0"/>
        <g v-for="token in starters" :key="token.index" :transform="`translate(${token.x} ${token.y})`" class="pitch-token" :class="{selected:selected===token.index,highlighted:activeIndex===token.index,goalkeeper:token.index===0}" tabindex="0" role="button" :aria-label="`${$t('Ver jugador')} ${token.player.no} · ${token.player.name}`" :aria-pressed="selected===token.index" @click="choose(token.index)" @keydown.enter.prevent="choose(token.index)" @keydown.space.prevent="choose(token.index)" @mouseenter="localHover=token.index" @mouseleave="localHover=null" @focus="localHover=token.index" @blur="localHover=null">
          <title>{{token.player.name}} · {{$t(positions[token.player.position])}}</title>
          <rect class="ring" x="-10" y="-6.5" width="20" height="13" rx="3"/>
          <rect class="shirt" x="-8" y="-4.5" width="16" height="9" rx="2"/>
          <text y="2.7" text-anchor="middle">{{token.player.no}}</text>
          <path v-if="token.attack" class="attack" d="M9 -1H12V-3L16 0L12 3V1H9Z"/>
        </g>
      </svg>
      <div class="player-context" aria-live="polite"><template v-if="activePlayer"><strong>{{activePlayer.no}} · {{activePlayer.name}}</strong><span>{{ $t(positions[activePlayer.position]) }} · {{ $t(activeIndex>10?'Suplente':'Titular') }}</span></template><template v-else><strong>{{ $t('Selecciona un jugador') }}</strong><span>{{ $t('Pasa por una fila para ver su ubicación.') }}</span></template></div>
      <div class="bench"><span>{{ $t('Suplentes') }}</span><div><button v-for="(player,i) in players.slice(11)" :key="i" :class="{selected:selected===i+11,highlighted:activeIndex===i+11}" :aria-label="`${$t('Ver jugador')} ${player.no} · ${player.name}`" :title="player.name" :aria-pressed="selected===i+11" @click="choose(i+11)" @mouseenter="localHover=i+11" @mouseleave="localHover=null" @focus="localHover=i+11" @blur="localHover=null">{{player.no}}</button></div></div>
      <p class="pitch-note">{{ $t('El portero lo posiciona automáticamente el juego.') }}</p>
    </section>
  </div>
</template>
<script>
import {formationPoint} from '../rom/formations.mjs';
import {POSITIONS} from '../rom/players.mjs';
export default {
  props:{formation:Object,players:Array,selected:Number,hovered:Number},emits:['select'],
  data(){return {open:false,localHover:null,positions:POSITIONS};},
  computed:{
    starters(){return [{index:0,player:this.players[0],x:5,y:50},...this.formation.slots.map((slot,i)=>({index:i+1,player:this.players[i+1],...formationPoint(slot),attack:!!(slot.role&4)}))];},
    activeIndex(){return this.localHover??this.hovered??this.selected;},
    activePlayer(){return this.activeIndex===null||this.activeIndex===undefined?null:this.players[this.activeIndex];},
  },
  watch:{players(){this.localHover=null;}},
  methods:{choose(index){this.localHover=null;this.$emit('select',index);this.open=false;}},
};
</script>
<style scoped>
.roster-pitch{position:sticky;top:16px;align-self:start;justify-self:end;grid-area:1 / 1;width:0;min-width:0}.pitch-card{position:relative;left:36px;width:280px;box-sizing:border-box;border:1px solid #c4d3df;border-radius:12px;background:#fff;overflow:hidden;box-shadow:0 4px 16px #172a4010}.pitch-card header{display:flex;align-items:center;justify-content:space-between;padding:16px 14px 12px;gap:12px}h3{margin:0 0 6px;font-size:16px}h3 span{font-size:13px;color:#176be0;margin-left:8px}small{color:#526579;font-size:11px}.pitch-zones{display:flex;justify-content:space-around;font-size:10px;letter-spacing:2px;color:#6b7d8d;font-weight:bold}svg{display:block;width:100%;padding:4px 10px;box-sizing:border-box}.lines{stroke:#cbe6d0;stroke-width:.7;fill:none}.pitch-token{cursor:pointer;outline:none}.shirt{fill:#173b73;stroke:#102954;stroke-width:.5}.pitch-token text{fill:#fff1b8;font:bold 7.5px monospace;pointer-events:none}.goalkeeper .shirt{fill:#76558e}.ring{fill:none;stroke:transparent;stroke-width:1.3}.selected .ring{stroke:#ffd45c}.highlighted .shirt{fill:#fbd56a;stroke:#fff}.highlighted text{fill:#173b73}.pitch-token:focus-visible .ring{stroke:#fff;stroke-width:1.8}.attack{fill:#ffdf50;pointer-events:none}.player-context{min-height:46px;padding:8px 14px 12px;display:flex;flex-direction:column;gap:4px}.player-context strong{font-size:14px}.player-context span{font-size:11px;color:#617587}.bench{padding:12px 14px;border-top:1px solid #edf1f5;background:#f6f9fc}.bench>span{font-size:11px;color:#617587}.bench>div{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}.bench button{padding:5px 0;width:28px;border:1px solid #b9cadd;border-radius:4px;background:#fff;color:#294463;font:600 12px monospace;cursor:pointer}.bench button.selected{border-color:#176be0;box-shadow:0 0 0 1px #176be0}.bench button.highlighted{background:#ffe7a2;border-color:#e3b442}.pitch-note{font-size:10px;color:#718395;line-height:1.5;margin:0;padding:10px 14px}.pitch-toggle,.close-pitch,.pitch-backdrop{display:none}
@media(max-width:1699px){.roster-pitch{position:fixed;width:auto;right:20px;bottom:20px;top:auto;z-index:40}.pitch-toggle{display:flex;align-items:center;gap:18px;padding:12px 16px;border-radius:24px;border:1px solid #315ba0;background:#173b73;color:#fff;font:600 13px system-ui;box-shadow:0 4px 20px #172a4030;cursor:pointer}.pitch-toggle span{font-size:20px;line-height:1}.pitch-card{display:none;position:fixed;left:auto;right:20px;bottom:78px;width:340px;max-width:calc(100vw - 32px);max-height:calc(100dvh - 110px);overflow-y:auto;z-index:42;box-shadow:0 8px 32px #172a4040}.pitch-card.open{display:block}.close-pitch{display:block;background:#f0f4f8;border:0;border-radius:50%;width:28px;height:28px;font-size:18px;color:#294463;cursor:pointer}.pitch-backdrop{display:block;position:fixed;inset:0;border:0;background:#172a4033;z-index:39}.pitch-toggle{position:relative;z-index:41}}
@media(max-width:600px){.roster-pitch{right:16px;bottom:max(16px,env(safe-area-inset-bottom))}.pitch-card{right:16px;bottom:80px;width:calc(100vw - 32px);max-height:calc(100dvh - 100px)}.pitch-card svg{max-height:220px}.close-pitch{width:36px;height:36px}.bench button{width:36px;min-height:36px}.pitch-card header{padding-top:12px}.player-context{min-height:36px}.pitch-note{padding:8px 14px}}
</style>
