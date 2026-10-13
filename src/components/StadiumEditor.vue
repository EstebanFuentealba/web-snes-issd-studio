<template>
  <section class="stadium-editor">
    <div class="toolbar"><h2>{{ $t('Estadios') }}</h2><button @click="restoreCurrent" :disabled="!modifiedCurrent">{{ $t('Restaurar estadio') }}</button><button @click="restoreAll" :disabled="!modified.some(id=>id.startsWith('stadium:'))">{{ $t('Restaurar todos los estadios') }}</button></div>
    <div class="stadium-layout">
      <nav :aria-label="$t('Seleccionar estadio')"><button v-for="s in stadiums" :key="s.index" :class="{selected:index===s.index}" @click="choose(s.index)"><span>{{ s.index+1 }}. {{ s.name }}</span><small>{{ s.lengthYards }} × {{ s.widthYards }} {{ $t('yardas') }}</small></button></nav>
      <div class="stadium-details">
        <div class="stadium-preview">
          <RomImage v-if="!measurementsOnly&&!namesReadOnly" :matrix="namePreview.matrix" :colors="nameColors" :label="$t('Nombre del estadio en el selector')" />
          <svg viewBox="0 0 400 190" role="img" :aria-label="$t('Vista previa de las medidas')">
            <defs><pattern id="stadium-stripes" width="20" height="20" patternUnits="userSpaceOnUse"><rect width="20" height="20" fill="#2b7f3d"/><rect width="10" height="20" fill="#37954a"/></pattern></defs>
            <rect x="40" y="25" width="320" height="140" fill="url(#stadium-stripes)"/><g fill="none" stroke="#eaffb8" stroke-width="2"><rect x="40" y="25" width="320" height="140"/><path d="M200 25V165 M40 59H88V131H40 M360 59H312V131H360 M40 77H61V113H40 M360 77H339V113H360"/><circle cx="200" cy="95" r="24"/></g><g fill="#f4faff" font-size="12" text-anchor="middle"><text x="200" y="17">{{ lengthYards }} {{ $t('yardas') }}</text><text x="200" y="184">{{ widthYards }} {{ $t('yardas de ancho') }}</text></g>
          </svg>
        </div>
        <form @submit.prevent="applyDetails">
          <fieldset><legend>{{ $t('Nombre y medidas del selector') }}</legend><div class="fields"><label>{{ $t('Nombre del estadio') }}<input :readonly="measurementsOnly||namesReadOnly" v-model="name" maxlength="7" autocomplete="off" /></label><label>{{ $t('Largo en yardas') }}<input v-model.number="lengthYards" type="number" min="100" max="140" required /></label><label>{{ $t('Ancho en yardas') }}<input v-model.number="widthYards" type="number" min="64" max="96" required /></label></div><p>{{ $t('Hasta 7 caracteres A–Z, puntos y espacios. El nombre se actualiza en la selección y en la información del partido.') }}</p><p>{{ $t('Las yardas se muestran en el selector. Las medidas de juego se editan por separado.') }}</p></fieldset>
          <details><summary>{{ $t('Medidas de juego · avanzado') }}</summary><p>{{ $t('Estas unidades definen los límites de la cancha y las posiciones de Scenarios. Cambiarlas no redibuja las líneas, muros ni gradas; revisa el resultado en el emulador.') }}</p><div class="fields"><label>{{ $t('Largo de juego') }}<input v-model.number="length" type="number" min="1792" max="2176" step="64" required /></label><label>{{ $t('Ancho de juego') }}<input v-model.number="width" type="number" min="576" max="704" step="64" required /></label></div></details>
          <p v-if="error" class="error" role="alert">{{ $t(error) }}</p><div class="toolbar"><button class="primary" :disabled="!detailsDirty" type="submit">{{ $t('Aplicar nombre y medidas') }}</button><button type="button" @click="resetDetails" :disabled="!detailsDirty">{{ $t('Descartar cambios') }}</button></div>
        </form>
        <p v-if="measurementsOnly" class="notice">WC26: se pueden editar las medidas. Los nombres y diseños requieren verificar sus recursos gráficos.</p>
        <template v-else><p v-if="namesReadOnly" class="notice">{{ $t('WC26: puedes editar los gráficos, las paletas y las medidas. El nombre del estadio se conserva.') }}</p><h3>{{ $t('Diseños y colores') }}</h3>
        <div class="resource-cards"><button v-for="g in graphics" :key="g.id" :class="{active:g.id===graphic.id}" @click="selectResource(g.id)"><RomImage v-if="resourcePreview(g)" :matrix="resourcePreview(g).matrix" :colors="resourcePreview(g).colors" :pixel-color="(p,x,y,colors)=>resourceColor(g,p,x,y,colors)" :label="$t(g.label)" /><span>{{ $t(g.label) }}</span></button></div>
        <div class="fields"><label>{{ $t('Recurso del estadio') }}<select :value="graphic.id" @change="chooseGraphic"><option v-for="g in graphics" :key="g.id" :value="g.id">{{ $t(g.label) }}{{ g.shared ? ' · '+$t('Compartido') : '' }}</option></select></label><label>{{ $t('Paleta del estadio') }}<select :value="paletteId" @change="choosePalette"><option v-for="p in palettes" :key="p.id" :value="p.id">{{ $t(p.label) }}{{ p.shared ? ' · '+$t('Compartido') : '' }}</option></select></label><label>{{ $t('Fila de paleta') }}<select :value="paletteRow" @change="choosePaletteRow"><option v-for="(_,i) in Array.from({length:Math.ceil(selectedPalette.colors.length/16)})" :key="i" :value="i">{{ i+1 }}</option></select></label></div>
        <p>{{ $t('Edita sobre el diseño armado. Las zonas oscuras sirven de contexto y no se modifican. Los fragmentos repetidos se actualizan juntos.') }}</p><p v-if="graphic.shared" class="notice">{{ $t('Este diseño es compartido por varios estadios. Sus cambios se aplican a todas sus apariciones.') }}</p>
        <p v-if="selectedPalette.shared" class="notice">{{ $t('Esta paleta es compartida por el selector de estadios.') }}</p><div class="palette-editor"><label v-for="(color,i) in selectedPalette.colors.slice(paletteRow*16,paletteRow*16+16)" :key="i">{{ i+paletteRow*16+paletteBase }}<input type="color" :value="color" :aria-label="$t('Color del estadio')+' '+(i+paletteRow*16)" @change="applyColor(i+paletteRow*16,$event)" /></label></div>
        <div class="toolbar"><button @click="restoreGraphic" :disabled="!graphicModified">{{ $t('Restaurar diseño') }}</button><button @click="restorePalette" :disabled="!modified.includes(selectedPalette.id)">{{ $t('Restaurar paleta') }}</button><span>{{ graphic.capacity }} {{ $t('bytes disponibles') }}</span></div>
        <div class="toolbar view-controls"><label v-if="views.length>1">{{ $t('Vista del diseño') }}<select :value="viewIndex" @change="chooseView"><option v-for="(v,i) in views" :key="i" :value="i">{{ $t('Vista') }} {{ i+1 }}</option></select></label><button v-if="views.length" @click="toggleTiles">{{ $t(advancedTiles?'Ver diseño armado':'Ver tiles · avanzado') }}</button><span v-if="!views.length">{{ $t('Este recurso no aparece en la vista de partido de este estadio. Disponible en modo avanzado.') }}</span></div>
        <p v-if="graphic.address===0x9f8a40" class="notice">{{ $t('Este recurso contiene el público visible por encima del muro, tal como aparece en el partido.') }}</p>
        <p v-if="composed&&view.reference" class="notice">{{ $t('Este recurso compartido se muestra en un estadio donde aparece durante el partido.') }}</p>
        <PixelEditor ref="pixel" :key="index+':'+graphic.id+':'+viewIndex+':'+advancedTiles" :matrix="composed?view.matrix:graphic.matrix" :original="composed?originalView.matrix:originalGraphic.matrix" :colors="composed?view.colors:graphic.colors" :original-colors="composed?originalView.colors:originalGraphic.colors" :editable="composed?view.editable:undefined" :highlight-editable="composed" :pixel-color="composed?viewColorAt:undefined" :original-pixel-color="composed?originalColorAt:undefined" :normalize-edit="composed?normalizeView:undefined" :normalize-image="composed?normalizeView:undefined" :color-index="composed?viewColor:undefined" :initial-grid="false" :palette-indices="composed?viewInkIndices:undefined" :apply-error="applyError||error" @apply="applyGraphic" /></template>
      </div>
    </div>
  </section>
</template>
<script>
import RomImage from './RomImage.vue';
import PixelEditor from './PixelEditor.vue';
import {stadiumViews,stadiumViewPixels,normalizeStadiumView,stadiumViewColor} from '../rom/stadium-scene.mjs';
import {palette,loRom} from '../rom/binary.mjs';
import {previewBigTeamText} from '../rom/team-labels.mjs';
import {readStadiums,stadiumGraphics,stadiumPalettes,stadiumNamePatches,stadiumMeasurePatch,stadiumGraphicPatch,stadiumPalettePatch} from '../rom/stadiums.mjs';
export default {
 components:{RomImage,PixelEditor},props:{rom:Uint8Array,original:Uint8Array,modified:Array,applyError:String,measurementsOnly:Boolean,namesReadOnly:Boolean},emits:['apply','restore','restore-all'],
 data(){return {index:0,name:'',lengthYards:0,widthYards:0,length:0,width:0,graphicId:'',viewIndex:0,advancedTiles:false,paletteId:'',paletteRow:0,error:''};},
 computed:{
  stadiums(){return readStadiums(this.rom);},stadium(){return this.stadiums[this.index];},
  palettes(){if(this.measurementsOnly)return [];return stadiumPalettes(this.rom,this.index);},selectedPalette(){return this.palettes.find(p=>p.id===this.paletteId)||this.palettes[0];},
  paletteBase(){return this.selectedPalette.shared&&this.selectedPalette.size===8?8:this.selectedPalette.size===30?1:0;},
  graphics(){if(this.measurementsOnly)return [];return stadiumGraphics(this.rom,this.index,this.rowColors(this.selectedPalette),this.original);},
  viewInkIndices(){if(this.graphic.partOffset!==null)return [0,8,9,10,11];const bases=new Set(this.view.bases.flatMap((row,y)=>row.filter((v,x)=>this.view.editable[y][x])));return [...bases].flatMap(base=>Array.from({length:16},(_,i)=>base+i));},
  views(){return stadiumViews(this.rom,this.index,this.graphic);},
  view(){return this.views[this.viewIndex]||this.views[0];},
  composed(){return !this.advancedTiles&&!!this.view;},
  originalView(){return stadiumViews(this.original,this.index,this.originalGraphic)[this.viewIndex]||stadiumViews(this.original,this.index,this.originalGraphic)[0];},
  graphic(){return this.graphics.find(g=>g.id===this.graphicId)||this.graphics[0];},
  originalGraphic(){const p=stadiumPalettes(this.original,this.index).find(p=>p.id===this.selectedPalette.id);return stadiumGraphics(this.original,this.index,this.rowColors(p)).find(g=>g.id===this.graphic.id);},
  namePreview(){return previewBigTeamText(this.rom,this.name.trim().toUpperCase());},nameColors(){const colors=Array(16).fill('transparent');colors.splice(8,4,...palette(this.rom,loRom(0x89dfec),4));return colors;},
  detailsDirty(){return ['name','lengthYards','widthYards','length','width'].some(k=>this[k]!==this.stadium[k]);},
  dirty(){return this.detailsDirty||!!this.$refs.pixel?.dirty||!!this.$refs.pixel?.importImage;},
  graphicModified(){return this.modified.includes(this.graphic.id)&&(this.graphic.partOffset===null||JSON.stringify(this.graphic.matrix)!==JSON.stringify(this.originalGraphic.matrix));},
  modifiedCurrent(){return this.modified.some(id=>id===`stadium:name:${this.index}`||id===`stadium:yards:${this.index}`||id===`stadium:field:${this.index}`||this.palettes.some(p=>!p.shared&&p.id===id)||this.graphics.some(g=>!g.shared&&g.id===id&&(g.partOffset===null||JSON.stringify(g.matrix)!==JSON.stringify(stadiumGraphics(this.original,this.index).find(r=>r.id===id).matrix))));},
 },
 watch:{rom(){this.resetDetails();}},created(){this.resetDetails();if(!this.measurementsOnly){this.paletteId=this.palettes[0].id;this.defaultPalette();}},
 methods:{
  viewColorAt(value,x,y,colors){return stadiumViewColor(this.view,value,x,y,colors);},
  originalColorAt(value,x,y,colors){return stadiumViewColor(this.originalView,value,x,y,colors);},
  resourceColor(g,value,x,y,colors){return stadiumViewColor(this.resourcePreview(g),value,x,y,colors);},
  resourcePreview(g){return stadiumViews(this.rom,this.index,g)[0];},
  selectResource(id){this.chooseGraphic({target:{value:id}});},
  chooseView(event){if(!this.allowDiscard()){event.target.value=this.viewIndex;return;}this.viewIndex=Number(event.target.value);},
  toggleTiles(){if(this.allowDiscard())this.advancedTiles=!this.advancedTiles;},
  normalizeView(matrix,baseline){return normalizeStadiumView(this.graphic,this.view,matrix,baseline);},
  viewColor(point,value){return this.view.bases[point.y][point.x]+(value&15);},
  rowColors(p){const colors=Array(16).fill('transparent');colors.splice(this.paletteBase,p.colors.length<16?p.colors.length:16,...p.colors.slice(this.paletteRow*16,this.paletteRow*16+16));colors[0]='transparent';return colors;},
  defaultPalette(){const g=this.graphic;const label=g.label.includes('Climas')?'Selector · climas':g.label.includes('Miniaturas')?'Selector · cancha':g.label.startsWith('Capa 1')?'Gradas y carteles':'Despejado · campo y gradas';this.paletteId=this.palettes.find(p=>p.label===label)?.id||this.palettes[0].id;this.paletteRow=0;},
  resetDetails(){Object.assign(this,{name:this.stadium.name,lengthYards:this.stadium.lengthYards,widthYards:this.stadium.widthYards,length:this.stadium.length,width:this.stadium.width,error:''});},
  allowDiscard(){return !this.dirty||confirm(this.$t('Hay una previsualización que todavía no se aplicó a la ROM. ¿Descartar esa previsualización?'));},
  choose(index){if(index===this.index||!this.allowDiscard())return;this.index=index;this.graphicId='';this.viewIndex=0;this.advancedTiles=false;this.resetDetails();if(!this.measurementsOnly){this.paletteId=this.palettes[0].id;this.paletteRow=0;this.defaultPalette();}},
  chooseGraphic(event){if(!this.allowDiscard()){event.target.value=this.graphic.id;return;}this.resetDetails();this.graphicId=event.target.value;this.viewIndex=0;this.advancedTiles=false;this.defaultPalette();},
  choosePalette(event){if(this.$refs.pixel?.dirty||this.$refs.pixel?.importImage){this.error='Aplica o descarta el dibujo pendiente antes de cambiar la paleta.';event.target.value=this.selectedPalette.id;return;}this.paletteId=event.target.value;this.paletteRow=0;},
  choosePaletteRow(event){if(this.$refs.pixel?.dirty||this.$refs.pixel?.importImage){this.error='Aplica o descarta el dibujo pendiente antes de cambiar la paleta.';event.target.value=this.paletteRow;return;}this.paletteRow=Number(event.target.value);},
  attempt(build){this.error='';try{this.$emit('apply',build());}catch(e){this.error=e.message;}},
  applyDetails(){if(this.$refs.pixel?.dirty||this.$refs.pixel?.importImage){this.error='Aplica o descarta el dibujo pendiente antes de aplicar los datos del estadio.';return;}this.attempt(()=>[...(this.measurementsOnly||this.namesReadOnly?[]:stadiumNamePatches(this.original,this.rom,this.index,this.name)),stadiumMeasurePatch(this.index,'yards',this.lengthYards,this.widthYards),stadiumMeasurePatch(this.index,'field',this.length,this.width)]);},
  applyGraphic(matrix){if(this.detailsDirty){this.error='Aplica o descarta el nombre y las medidas antes de editar los diseños.';return;}this.attempt(()=>[stadiumGraphicPatch(this.original,this.graphic,this.composed?stadiumViewPixels(this.graphic,this.view,matrix):matrix)]);},
  applyColor(i,event){if(this.dirty){this.error='Aplica o descarta los cambios pendientes antes de editar los colores.';event.target.value=this.selectedPalette.colors[i];return;}this.attempt(()=>[stadiumPalettePatch(this.rom,this.selectedPalette.id,i,event.target.value)]);this.$nextTick(()=>{event.target.value=this.selectedPalette.colors[i];});},
  restoreCurrent(){if(this.allowDiscard())this.$emit('restore',this.index);},restoreAll(){if(this.allowDiscard())this.$emit('restore-all');},
  restoreGraphic(){if(this.allowDiscard())this.attempt(()=>this.graphic.partOffset!==null?[stadiumGraphicPatch(this.original,this.graphic,this.originalGraphic.matrix)]:[{id:this.graphic.id,offset:this.graphic.offset,bytes:this.original.slice(this.graphic.offset,this.graphic.offset+this.graphic.capacity)}]);},
  restorePalette(){if(this.allowDiscard())this.attempt(()=>[{id:this.selectedPalette.id,offset:this.selectedPalette.offset,bytes:this.original.slice(this.selectedPalette.offset,this.selectedPalette.offset+this.selectedPalette.size)}]);},
 },
};
</script>
<style scoped>
.resource-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(145px,1fr));gap:10px;margin:14px 0}.resource-cards button{display:flex;flex-direction:column;align-items:center;justify-content:space-between;gap:8px;min-height:100px;background:#eef4f8;overflow:hidden;font-size:12px}.resource-cards button.active{border:2px solid #176be0;background:#dcecff}.resource-cards :deep(canvas){max-width:100%;max-height:85px;object-fit:contain}.view-controls{margin:12px 0}.toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.toolbar h2{margin-right:auto}.stadium-layout{display:grid;grid-template-columns:160px minmax(0,1fr);gap:20px}.stadium-details{min-width:0}nav button{display:flex;flex-direction:column;text-align:left;width:100%;gap:6px;padding:12px;margin:4px 0;background:#edf3f9}nav small{color:#62758b}nav .selected{background:#176be0;color:white}nav .selected small{color:#e7f0ff}.stadium-preview{background:#102f51;border-radius:10px;padding:16px;display:flex;align-items:center;justify-content:space-around;gap:16px;flex-wrap:wrap;margin:12px 0}.stadium-preview svg{width:380px;max-width:100%}.fields{display:flex;gap:12px;flex-wrap:wrap}label{display:flex;flex-direction:column;gap:6px}input,select,button{font:inherit;padding:7px;border:1px solid #bbc8d6;border-radius:5px}button{cursor:pointer}button:disabled{opacity:.45;cursor:default}input[type=number]{width:110px}select{max-width:100%}fieldset{border:1px solid #d4dce4;border-radius:8px;padding:14px;margin:12px 0}details{padding:12px;background:#edf3f9;border-radius:8px}.primary{background:#176be0;color:white}.palette-editor{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0}.palette-editor label{font-size:11px;color:#62758b}.palette-editor input{width:34px;height:30px;padding:2px}.error{color:#a32121}.notice{padding:10px;background:#fff0ca}@media(max-width:900px){.stadium-layout{grid-template-columns:1fr}nav{display:flex;gap:6px;flex-wrap:wrap}nav button{width:140px}}
</style>
