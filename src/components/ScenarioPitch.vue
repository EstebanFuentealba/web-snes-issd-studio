<template>
  <div class="position-editor">
    <p v-if="automatic">{{ $t('Posición automática según el saque y el estadio. Cambia el inicio de la jugada para colocar la pelota libremente.') }}</p>
    <p v-else>{{ $t('Haz clic o arrastra la pelota. Usa las flechas del teclado para ajustar la posición.') }}</p>
    <svg ref="pitch" class="pitch" :class="{automatic}" viewBox="0 0 720 300" role="application" :aria-label="$t('Cancha del escenario')" @pointerdown="begin" @pointermove="move" @pointerup="finish" @pointercancel="cancel" @lostpointercapture="cancel">
      <defs><pattern id="scenario-grass" width="120" height="300" patternUnits="userSpaceOnUse"><rect width="120" height="300" fill="#20754b"/><rect width="60" height="300" fill="#258153"/></pattern></defs>
      <rect width="720" height="300" rx="8" fill="#143e32"/>
      <rect x="30" y="25" width="660" height="250" fill="url(#scenario-grass)"/>
      <g fill="none" stroke="#e2f3d5" stroke-width="2" pointer-events="none">
        <rect x="30" y="25" width="660" height="250"/><path d="M360 25V275"/><circle cx="360" cy="150" r="33"/>
        <path d="M30 77H125V223H30 M690 77H595V223H690 M30 114H66V186H30 M690 114H654V186H690 M30 130H15V170H30 M690 130H705V170H690"/>
        <path d="M125 122Q151 150 125 178 M595 122Q569 150 595 178"/><circle cx="360" cy="150" r="2" fill="#e2f3d5"/>
        <circle cx="98" cy="150" r="2" fill="#e2f3d5"/><circle cx="622" cy="150" r="2" fill="#e2f3d5"/>
      </g>
      <g class="ball" :transform="`translate(${marker.x} ${marker.y})`" :tabindex="automatic ? -1 : 0" :role="automatic ? 'img' : 'slider'" :aria-label="$t('Posición de la pelota')" :aria-valuetext="`X ${position.x}, Y ${position.y}`" :aria-valuemin="-32768" :aria-valuemax="32767" :aria-valuenow="position.x" @keydown="keyMove">
        <circle r="16" fill="#ffd849" opacity=".4"/><circle r="9" fill="#fff" stroke="#102d36" stroke-width="2"/><path d="M-3-4H3L5 1 0 5-5 1Z" fill="#102d36"/>
      </g>
    </svg>
    <p class="coordinates"><strong>X {{ position.x }} · Y {{ position.y }}</strong><span>{{ $t('Dimensiones de la cancha') }}: {{ size.length }} × {{ size.width }}</span></p>
    <p v-if="outside&&!automatic" class="outside">{{ $t('La posición original está fuera de la cancha. Se conserva hasta que muevas la pelota.') }}</p>
    <div class="position-fields"><label>{{ $t('Coordenada X de la pelota') }}<input :disabled="!!automatic" type="number" min="-32768" max="32767" :value="position.x" @change="numeric('x',$event)" /></label><label>{{ $t('Coordenada Y de la pelota') }}<input :disabled="!!automatic" type="number" min="-32768" max="32767" :value="position.y" @change="numeric('y',$event)" /></label></div>
  </div>
</template>
<script>
import {scenarioPosition,scenarioPitchSize,scenarioPositionChanges,positionOnPitch,scenarioAutomaticPosition} from '../rom/scenario-position.mjs';
export default {
  props:{scenario:Object,rom:Uint8Array},emits:['change'],data(){return {draft:null,pointer:null};},
  computed:{automatic(){return scenarioAutomaticPosition(this.scenario,this.rom);},size(){return scenarioPitchSize(this.scenario.stadium,this.rom);},position(){return this.draft||this.automatic||scenarioPosition(this.scenario);},outside(){const p=this.position;return p.x<0||p.x>this.size.length||p.y<0||p.y>this.size.width;},marker(){return {x:30+Math.max(0,Math.min(1,this.position.x/this.size.length))*660,y:25+Math.max(0,Math.min(1,this.position.y/this.size.width))*250};}},
  methods:{
    point(event){const svg=this.$refs.pitch,p=svg.createSVGPoint();p.x=event.clientX;p.y=event.clientY;const local=p.matrixTransform(svg.getScreenCTM().inverse());return positionOnPitch({x:(local.x-30)/660,y:(local.y-25)/250},this.scenario.stadium,this.rom);},
    begin(event){if(this.automatic||!event.isPrimary||event.button!==0)return;event.preventDefault();this.pointer=event.pointerId;this.$refs.pitch.setPointerCapture(event.pointerId);this.draft=this.point(event);this.$refs.pitch.querySelector('.ball').focus();},
    move(event){if(this.pointer===event.pointerId)this.draft=this.point(event);},
    finish(event){if(this.pointer!==event.pointerId)return;const p=this.point(event);this.pointer=null;this.draft=null;this.$emit('change',scenarioPositionChanges(p.x,p.y));},
    cancel(){this.pointer=null;this.draft=null;},
    keyMove(event){if(this.automatic)return;const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(!directions[event.key])return;event.preventDefault();const [dx,dy]=directions[event.key],step=event.shiftKey?16:1;this.$emit('change',scenarioPositionChanges(Math.max(0,Math.min(this.size.length,this.position.x+dx*step)),Math.max(0,Math.min(this.size.width,this.position.y+dy*step))));},
    numeric(axis,event){if(this.automatic)return;if(event.target.value.trim()!==''&&event.target.checkValidity()){const p={...this.position,[axis]:Number(event.target.value)};this.$emit('change',scenarioPositionChanges(p.x,p.y));}this.$nextTick(()=>{event.target.value=this.position[axis];});},
  },
};
</script>
<style scoped>
.pitch{display:block;width:100%;touch-action:none;cursor:crosshair;user-select:none}.pitch.automatic,.automatic .ball{cursor:default}.ball{cursor:grab;outline:none}.ball:focus circle:first-child{opacity:.85;stroke:#fff;stroke-width:2}.coordinates{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:13px}.coordinates span{color:#526579}.outside{color:#85520d;font-size:13px}.position-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}label{display:flex;flex-direction:column;gap:6px}input{font:inherit;padding:8px;border:1px solid #bbc8d6;border-radius:5px;min-width:0}@media(max-width:500px){.position-fields{grid-template-columns:1fr}}
</style>
