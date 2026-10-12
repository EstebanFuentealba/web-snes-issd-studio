<template>
  <section class="formation-editor" v-if="draft">
    <h3>{{ $t('Formación') }} {{current.label}}</h3>
    <p>{{ $t('Selecciona un esquema, arrastra los dorsales y configura la participación ofensiva de cada jugador.') }}</p>
    <div class="formation-toolbar">
      <label>{{ $t('Tipo de formación') }} <select :value="draft.bytes[0]" @change="choosePreset(Number($event.target.value))"><option v-for="(label,i) in labels" :key="i" :value="i">{{label}}</option></select></label>
      <label>{{ $t('Formación original') }} <select v-model.number="source"><option v-for="option in teamOptions" :key="option.index" :value="option.index">{{$t(option.name)}}</option></select></label>
      <button @click="copyOriginal">{{ $t('Copiar formación del equipo') }}</button>
    </div>
    <div class="formation-layout">
      <div class="formation-players" :aria-label="$t('Jugadores en la formación')">
        <div class="list-heading"><span>{{ $t('Jugador') }}</span><span :title="$t('Participación ofensiva')">Attack Participation</span></div>
        <div v-for="(slot,i) in draft.slots" :key="i" class="player-row" :class="{selected:selected===i}">
          <button @click="selected=i" :aria-pressed="selected===i"><span class="shirt-number">{{player(i).no}}</span><span>{{player(i).name}}</span><small>{{roleLabel(slot)}}</small></button>
          <input type="checkbox" :checked="!!(slot.role&4)" :disabled="(slot.role&3)===3" :aria-label="$t('Participación ofensiva')+' · '+player(i).name" @change="setAttack(i,$event.target.checked)" />
        </div>
      </div>
      <div class="formation-field">
        <div class="pitch-headings"><span>DF</span><span>MF</span><span>FW</span></div>
        <svg ref="pitch" viewBox="0 0 160 100" class="formation-pitch" :aria-label="$t('Formación')+' '+draft.label" @pointermove="moveDrag" @pointerup="endDrag" @pointercancel="cancelDrag" @lostpointercapture="drag=null">
          <rect v-for="(color,i) in bands" :key="i" :x="1+i*9.875" y="1" width="9.875" height="98" :fill="color" />
          <path class="pitch-lines" d="M1 1H159V99H1Z M80 1V99 M1 25H29V75H1 M1 37H15V63H1 M159 25H131V75H159 M159 37H145V63H159"/>
          <circle class="pitch-lines" cx="80" cy="50" r="12"/><circle cx="80" cy="50" r=".7" fill="white"/>
          <g class="goalkeeper" transform="translate(5 50)"><title>{{ $t('El portero lo posiciona automáticamente el juego.') }}</title><rect x="-7" y="-4" width="14" height="8" rx="2"/><text y="2.3" text-anchor="middle">{{players[0]?.no||1}}</text></g>
          <g v-for="(slot,i) in draft.slots" :key="i" class="pitch-player" :class="{selected:selected===i}" :transform="'translate('+point(slot).x+' '+point(slot).y+')'" role="button" tabindex="0" :aria-label="player(i).no+' · '+player(i).name+' · '+roleLabel(slot)" :aria-pressed="selected===i" @pointerdown.prevent="startDrag(i,$event)" @keydown="keyMove(i,$event)" @click="selected=i">
            <title>{{player(i).name}} · {{roleLabel(slot)}}</title>
            <rect class="selection-ring" x="-10" y="-6.5" width="22" height="13" rx="1" v-if="selected===i"/>
            <rect class="player-token" x="-8" y="-4" width="16" height="8" rx="2"/>
            <text y="2.4" text-anchor="middle">{{player(i).no}}</text>
            <path v-if="slot.role&4" class="attack-arrow" d="M9 -1.4H12V-3L16 0L12 3V1.4H9Z"/>
          </g>
        </svg>
        <p class="hint">{{ $t('Arrastra un dorsal o usa las flechas del teclado. El portero lo posiciona automáticamente el juego.') }}</p>
        <fieldset v-if="selectedSlot"><legend>{{player(selected).no}} · {{player(selected).name}} · {{roleLabel(selectedSlot)}}</legend>
          <div class="position-controls">
            <label>{{ $t('Avance horizontal') }} <input type="range" :min="-limits.depth" :max="limits.depth" :value="selectedSlot.depth" @input="editOffset('depth',$event)"/><input type="number" :min="-limits.depth" :max="limits.depth" :value="selectedSlot.depth" @change="editOffset('depth',$event)"/></label>
            <label>{{ $t('Posición vertical') }} <input type="range" :min="-limits.width" :max="limits.width" :value="selectedSlot.width" @input="editOffset('width',$event)"/><input type="number" :min="-limits.width" :max="limits.width" :value="selectedSlot.width" @change="editOffset('width',$event)"/></label>
          </div>
          <label class="attack-control"><input type="checkbox" :checked="!!(selectedSlot.role&4)" :disabled="(selectedSlot.role&3)===3" @change="setAttack(selected,$event.target.checked)"/> Attack Participation · {{ $t('Participación ofensiva') }}</label>
          <p v-if="(selectedSlot.role&3)===3" class="hint">{{ $t('Los delanteros no usan el indicador de participación ofensiva.') }}</p>
        </fieldset>
      </div>
    </div>
    <div class="formation-toolbar"><button class="primary" :disabled="!dirty||!!drag" @click="apply">{{ $t('Aplicar formación') }}</button><button :disabled="!dirty" @click="resetDraft">{{ $t('Descartar cambios') }}</button><button :disabled="!modified||dirty" @click="$emit('restore')">{{ $t('Restaurar formación') }}</button><span v-if="dirty">{{ $t('Vista previa de formación') }}: {{draft.label}}</span></div>
    <p v-if="error" class="error" role="alert">{{$t(error)}}</p>
  </section>
</template>
<script>
import {readFormation,readFormationPreset,FORMATION_LABELS,formationPoint,formationSlotAt,formationLimits,customFormationPatch} from '../rom/formations.mjs';
import {teamExists,teamDataRom,activeTeamIds} from '../rom/team-count.mjs';
export default {
  props:{rom:Uint8Array,original:Uint8Array,teamIndex:Number,players:Array,teamOptions:Array,modified:Boolean},emits:['apply','restore'],
  data(){return {draft:null,selected:0,source:this.teamIndex,drag:null,error:'',labels:FORMATION_LABELS,bands:['#5b8741','#639341','#75aa3e','#7abd36','#83cc31','#cf7527','#d48527','#dc9528','#e6a329','#efb52c','#f8c739','#d83e5c','#e04c6a','#e7597a','#ed648c','#f475a1']};},
  computed:{current(){return readFormation(this.rom,this.teamIndex);},selectedSlot(){return this.draft?.slots[this.selected];},limits(){return formationLimits(this.selectedSlot.role);},dirty(){return !!this.draft&&(this.draft.bytes[0]!==this.current.bytes[0]||this.draft.slots.some((s,i)=>['depth','width','role'].some(k=>s[k]!==this.current.slots[i][k])));}},
  watch:{rom(){this.resetDraft();},teamIndex(){this.selected=0;this.source=this.teamIndex;this.resetDraft();}},created(){this.resetDraft();},
  methods:{
    resetDraft(){this.draft=readFormation(this.rom,this.teamIndex);this.drag=null;this.error='';},
    player(i){return this.players[i+1]||{no:i+2,name:String(i+2)};},
    point:formationPoint,roleLabel(slot){return ['DF','MF','FW'][(slot.role&3)-1];},
    choosePreset(index){this.draft=readFormationPreset(this.original,index);this.drag=null;this.error='';},
    copyOriginal(){const source=teamDataRom(this.original);this.draft=readFormation(source,teamExists(source,this.source)?this.source:activeTeamIds(source)[0]);this.drag=null;this.error='';},
    setAttack(i,enabled){const slot=this.draft.slots[i];if((slot.role&3)===3)return;slot.role=(slot.role&3)|(enabled?4:0);},
    editOffset(key,event){if(event.target.value.trim()===''||!event.target.checkValidity()){event.target.value=this.selectedSlot[key];return;}this.selectedSlot[key]=Number(event.target.value);},
    startDrag(i,event){if(event.button!==0)return;this.selected=i;this.drag={index:i,pointerId:event.pointerId,start:{...this.draft.slots[i]}};this.$refs.pitch.setPointerCapture(event.pointerId);},
    moveDrag(event){if(!this.drag||event.pointerId!==this.drag.pointerId)return;const svg=this.$refs.pitch,ctm=svg.getScreenCTM();if(!ctm)return;const p=svg.createSVGPoint();p.x=event.clientX;p.y=event.clientY;const local=p.matrixTransform(ctm.inverse());this.draft.slots[this.drag.index]=formationSlotAt(this.draft.slots[this.drag.index],local.x,local.y);},
    endDrag(event){if(!this.drag||event.pointerId!==this.drag.pointerId)return;this.moveDrag(event);if(this.$refs.pitch.hasPointerCapture(event.pointerId))this.$refs.pitch.releasePointerCapture(event.pointerId);this.drag=null;},
    cancelDrag(event){if(this.drag&&event.pointerId===this.drag.pointerId){this.draft.slots[this.drag.index]=this.drag.start;this.drag=null;}},
    keyMove(i,event){this.selected=i;if(event.key==='Enter'||event.key===' '){event.preventDefault();return;}const d={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];if(!d)return;event.preventDefault();const p=formationPoint(this.draft.slots[i]);this.draft.slots[i]=formationSlotAt(this.draft.slots[i],p.x+d[0],p.y+d[1]);},
    apply(){try{const patch=customFormationPatch(this.rom,this.teamIndex,this.draft.bytes[0],this.draft.slots);this.error='';this.$emit('apply',patch);}catch(e){this.error=e.message;}},
  },
};
</script>
<style scoped>
.formation-toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin:14px 0}.formation-layout{display:grid;grid-template-columns:240px minmax(0,1fr);gap:20px;align-items:start}.formation-players{border:1px solid #d4dce4;border-radius:8px;overflow:hidden}.list-heading{display:flex;justify-content:space-between;gap:6px;padding:10px;font-size:11px;background:#edf3f9}.player-row{display:flex;align-items:center;padding-right:10px;background:white;border-top:1px solid #d4dce4}.player-row.selected{background:#fff4c9}.player-row button{display:flex;align-items:center;gap:8px;flex:1;min-width:0;text-align:left;border:0;background:transparent;margin:0;border-radius:0;padding:12px 8px}.player-row button span:nth-child(2){overflow:hidden;text-overflow:ellipsis}.player-row small{margin-left:auto;color:#526579}.shirt-number{display:inline-grid;place-items:center;min-width:26px;background:#16366b;color:#ffe867;border-radius:4px;font-weight:bold}.formation-field{min-width:0}.pitch-headings{display:flex;justify-content:space-around;background:#173667;color:white;font-weight:bold;letter-spacing:3px;padding:10px;border-radius:6px 6px 0 0}.formation-pitch{display:block;width:100%;background:#173667;border:4px solid #173667;box-sizing:border-box;touch-action:none;user-select:none;overflow:visible}.pitch-lines{stroke:#fff;stroke-width:1;fill:none}.pitch-player{cursor:grab;outline:none}.pitch-player:active{cursor:grabbing}.player-token{fill:#16366b;stroke:#09224e;stroke-width:1}.pitch-player text{fill:#fff267;font-size:7px;font-weight:900;pointer-events:none}.attack-arrow{fill:#ffe53d;stroke:#ff912a;stroke-width:.4;pointer-events:none}.selection-ring{fill:none;stroke:#ffec41;stroke-width:1.2;pointer-events:none}.pitch-player:focus .player-token{stroke:#fff;stroke-width:1.5}.goalkeeper rect{fill:#777f91;stroke:#b7bbc8;stroke-width:.8}.goalkeeper text{fill:#e5e8f0;font-size:7px;font-weight:900}.hint{color:#526579;font-size:12px;line-height:1.5;margin:10px 0}fieldset{margin:16px 0;border:1px solid #d4dce4;border-radius:8px;padding:12px;min-width:0}legend{font-weight:600}.position-controls{display:grid;grid-template-columns:1fr 1fr;gap:12px}.position-controls label{display:flex;flex-wrap:wrap;align-items:center;gap:8px}.position-controls input[type=range]{width:100%;padding:0}.position-controls input[type=number]{width:65px}.attack-control{display:flex;align-items:center;gap:8px;margin-top:14px}button,input,select{font:inherit;padding:7px;border:1px solid #bbc8d6;border-radius:5px}button{cursor:pointer}button:disabled,input:disabled{opacity:.45;cursor:default}input[type=checkbox]{accent-color:#176be0}.primary{background:#176be0;color:white;border:0}.error{color:#a32121}@media(max-width:1050px){.formation-layout{grid-template-columns:1fr}.formation-players{display:grid;grid-template-columns:1fr 1fr}.list-heading{grid-column:1/-1}.formation-field{max-width:760px}}@media(max-width:500px){.formation-players,.position-controls{grid-template-columns:1fr}.formation-toolbar label{display:flex;flex-direction:column;gap:6px;width:100%}}
</style>
