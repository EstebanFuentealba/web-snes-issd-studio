<template>
  <section class="main-menu-editor">
    <h2>{{ $t('Menú principal') }}</h2>
    <p>{{ $t('Edita los rótulos de las ocho opciones y los gráficos del menú. Cada opción conserva su función en el juego.') }}</p>
    <div class="menu-layout">
      <div class="menu-preview"><RomImage :matrix="preview.matrix" :colors="preview.colors" :label="$t('Previsualización del menú principal')" /><p>{{ $t('Selecciona una opción para ver su estado resaltado.') }}</p></div>
      <div class="menu-controls">
        <div class="menu-buttons"><button v-for="(button,i) in buttons" :key="button.frame" :class="{selected:selected===i}" @click="choose(i)">{{button.label}}</button></div>
        <label>{{ $t('Primera línea') }} <input v-model="lines[0]" maxlength="20" @input="prepare" /></label>
        <label>{{ $t('Segunda línea') }} <input v-model="lines[1]" maxlength="20" @input="prepare" /></label>
        <p>{{ $t('Fuente ampliada: A–Z, espacios y guiones. Hasta 112 píxeles por línea.') }}</p>
        <p v-if="textError" role="alert" class="error">{{$t(textError)}}</p>
        <button :disabled="!draft||!!textError" @click="applyText">{{ $t('Aplicar rótulo a la ROM') }}</button>
        <button v-if="textPending" @click="discard">{{ $t('Descartar previsualización') }}</button>
        <button :disabled="!buttonModified" @click="restoreButton">{{ $t('Restaurar esta opción') }}</button>
      </div>
    </div>
    <details @toggle="$event.target.open && (graphicsOpen=true)">
      <summary>{{ $t('Editar gráficos del menú') }}</summary>
      <template v-if="graphicsOpen">
        <select :value="graphicIndex" :aria-label="$t('Seleccionar gráfico')" @change="chooseGraphic($event)"><option v-for="(r,i) in graphics" :value="i" :key="r.id">{{$t(r.label)}}</option></select>
        <p>{{ $t('Las letras y el panel son compartidos: dibujar aquí modifica todos sus usos. El gráfico debe caber en su espacio comprimido original.') }}</p>
        <p v-if="graphic.kind==='menu-layer'">{{ $t('La imagen está armada como en el juego. Los píxeles reutilizados cambian en todas sus apariciones; el borde sombreado sirve de referencia.') }}</p>
        <PixelEditor ref="pixel" :key="graphic.id" :matrix="graphic.matrix" :editable="graphic.editable" :highlight-editable="graphic.kind==='menu-layer'&&graphicIndex===1" :original="originalGraphic.matrix" :colors="graphic.colors" :original-colors="originalGraphic.colors" :apply-error="error" @apply="applyGraphic" />
        <button :disabled="!graphicModified" @click="restoreGraphic">{{ $t('Restaurar recurso en ROM') }}</button>
      </template>
    </details>
  </section>
</template>
<script>
import RomImage from './RomImage.vue';
import PixelEditor from './PixelEditor.vue';
import {MENU_BUTTONS,menuButtonLines,mainMenuTextPatches,restoreMenuButtonPatches,mainMenuPreview,mainMenuGraphics} from '../rom/main-menu.mjs';
import {graphicPatch,graphicPatches} from '../rom/graphics.mjs';
export default {
 components:{RomImage,PixelEditor},props:{rom:Uint8Array,original:Uint8Array,error:String},emits:['change'],
 data(){return {buttons:MENU_BUTTONS,selected:0,lines:['',''],draft:null,textError:'',graphicIndex:0,graphicsOpen:false};},
 computed:{
  textPending(){return !!this.draft||!!this.textError;},dirty(){return this.textPending||!!this.$refs.pixel?.dirty||!!this.$refs.pixel?.importImage;},
  preview(){const bytes=this.rom.slice();this.draft?.forEach(p=>bytes.set(p.bytes,p.offset));return mainMenuPreview(bytes,this.selected);},
  graphics(){return mainMenuGraphics(this.rom);},graphic(){return this.graphics[this.graphicIndex];},originalGraphic(){return mainMenuGraphics(this.original,this.graphic.id==='main-menu:font')[this.graphicIndex];},
  graphicModified(){return JSON.stringify(this.graphic.matrix)!==JSON.stringify(this.originalGraphic.matrix);},
  buttonModified(){return JSON.stringify(menuButtonLines(this.rom,this.selected))!==JSON.stringify(menuButtonLines(this.original,this.selected));},
 },
 watch:{rom(){if(this.textPending&&JSON.stringify(this.lines.map(line=>line.trim().toUpperCase()))!==JSON.stringify(menuButtonLines(this.rom,this.selected)))this.prepare();else this.discard();}},mounted(){this.discard();},
 methods:{
  discard(){this.lines=menuButtonLines(this.rom,this.selected);this.draft=null;this.textError='';},
  allow(){return !this.dirty||confirm(this.$t('Hay una previsualización que todavía no se aplicó a la ROM. ¿Descartar esa previsualización?'));},
  choose(i){if(!this.allow())return;this.selected=i;this.discard();},
  chooseGraphic(event){if(!this.allow()){event.target.value=this.graphicIndex;return;}this.discard();this.graphicIndex=Number(event.target.value);},
  prepare(){this.draft=null;this.textError='';if(JSON.stringify(this.lines)===JSON.stringify(menuButtonLines(this.rom,this.selected)))return;try{this.draft=mainMenuTextPatches(this.original,this.rom,this.selected,this.lines);}catch(e){this.textError=e.message;}},
  applyText(){if(this.$refs.pixel?.dirty||this.$refs.pixel?.importImage){this.textError='Aplica o descarta el dibujo pendiente antes de generar textos.';return;}if(this.draft)this.$emit('change',this.draft);},
  restoreButton(){if(this.allow())this.$emit('change',restoreMenuButtonPatches(this.original,this.rom,this.selected));},
  applyGraphic(matrix){if(this.textPending){this.textError='Aplica o descarta el texto del menú antes de guardar un dibujo.';return;}try{this.$emit('change',graphicPatches(this.original,this.rom,this.graphic,matrix));}catch(e){this.textError=e.message;}},
  restoreGraphic(){if(!this.allow())return;if(this.graphic.id==='main-menu:font'){this.$emit('change',[graphicPatch(this.original,this.graphic,this.originalGraphic.matrix)]);return;}this.$emit('change',[{id:this.graphic.id,offset:this.graphic.offset,bytes:this.original.slice(this.graphic.offset,this.graphic.offset+this.graphic.capacity),label:this.graphic.label}]);},
 },
};
</script>
<style scoped>
.menu-layout{display:flex;gap:24px;align-items:flex-start;flex-wrap:wrap;margin:20px 0}.menu-preview{flex:1;min-width:280px}.menu-preview :deep(canvas){width:100%;height:auto;max-width:640px}.menu-controls{flex:1;min-width:280px}.menu-buttons{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:18px}button,input,select{font:inherit;padding:8px;border:1px solid #bac9dc;border-radius:6px}button{cursor:pointer;background:#edf3fb}button.selected{background:#176be0;color:white}button:disabled{opacity:.45;cursor:default}label{display:block;margin:12px 0}input{display:block;width:90%;text-transform:uppercase}p{line-height:1.5;color:#526277}.error{color:#b12626}summary{cursor:pointer;font-weight:600;padding:12px 0}
</style>
