<template>
  <section class="menu-text-editor">
    <h3>{{ $t(screen.label) }}</h3>
    <p>{{ $t('Edita los rótulos y las descripciones de este menú. Cada opción conserva su función en el juego.') }}</p>
    <div class="menu-layout">
      <div class="menu-preview"><RomImage :matrix="preview.matrix" :colors="preview.colors" :label="$t(screen.label)" /><p>{{ $t('Previsualización de textos con la fuente de la ROM.') }}</p></div>
      <div class="menu-controls">
        <div class="menu-options"><button v-for="field in screen.fields" :key="field.key" :class="{selected:selected===field.key}" @click="choose(field.key)">{{ $t(field.label) }}</button></div>
        <label>{{ $t('Texto del rótulo') }}<textarea :readonly="readOnly" v-model="text" :rows="Math.max(2,field.rows)" @input="prepare" /></label>
        <p>{{ $t('Hasta {0} líneas de {1} caracteres por línea.').replace('{0}',field.rows).replace('{1}',field.columns) }}</p>
        <p>{{ $t('Usa letras sin tildes, números, espacios y puntuación compatible con la fuente del menú.') }}</p>
        <p v-if="field.nativeText||field.map">{{ $t('Los rótulos originales compactos se conservan al restaurar. Los textos nuevos usan la fuente de caracteres del juego.') }}</p>
        <p v-if="field.shared">{{ $t('Este texto es compartido: el cambio se aplica a todos sus usos en el juego.') }}</p>
        <p v-if="textError||error" role="alert" class="error">{{ $t(textError||error) }}</p>
        <div class="actions">
          <button :disabled="readOnly||!draft||!!textError" @click="$emit('change',draft)">{{ $t('Aplicar rótulo a la ROM') }}</button>
          <button v-if="dirty" @click="discard">{{ $t('Descartar previsualización') }}</button>
          <button :disabled="readOnly||!modified" @click="restore">{{ $t('Restaurar esta opción') }}</button>
        </div>
      </div>
    </div>
  </section>
</template>
<script>
import RomImage from './RomImage.vue';
import {menuScreen,readMenuText,menuTextPatches,restoreMenuTextPatches,menuTextPreview} from '../rom/menu-text.mjs';
export default {
  components:{RomImage},props:{screenId:String,rom:Uint8Array,original:Uint8Array,error:String,readOnly:Boolean},emits:['change'],
  data(){return {selected:menuScreen(this.screenId).fields[0].key,text:'',draft:null,textError:''};},
  computed:{
    screen(){return menuScreen(this.screenId);},field(){return readMenuText(this.rom,this.screenId,this.selected);},
    dirty(){return this.text!==this.field.text;},
    modified(){if(this.readOnly)return false;const patches=restoreMenuTextPatches(this.original,this.rom,this.screenId,this.selected);return patches.some(p=>p.bytes.some((b,i)=>b!==this.rom[p.offset+i]));},
    preview(){const bytes=this.rom.slice();this.draft?.forEach(p=>bytes.set(p.bytes,p.offset));return menuTextPreview(bytes,this.screenId,this.selected);},
  },
  watch:{rom(){const normalized=this.text.replace(/\r\n?/g,'\n').split('\n').map(line=>line.trimEnd()).join('\n').trimEnd();if(normalized===this.field.text)this.discard();else this.prepare();}},mounted(){this.discard();},
  methods:{
    discard(){this.text=this.field.text;this.draft=null;this.textError='';},
    allow(){return !this.dirty||confirm(this.$t('Hay una previsualización que todavía no se aplicó a la ROM. ¿Descartar esa previsualización?'));},
    choose(key){if(key===this.selected||!this.allow())return;this.selected=key;this.discard();},
    prepare(){this.draft=null;this.textError='';if(!this.dirty)return;try{this.draft=menuTextPatches(this.original,this.rom,this.screenId,this.selected,this.text);}catch(e){this.textError=e.message;}},
    restore(){if(this.allow())this.$emit('change',restoreMenuTextPatches(this.original,this.rom,this.screenId,this.selected));},
  },
};
</script>
<style scoped>
.menu-layout{display:flex;gap:24px;align-items:flex-start;flex-wrap:wrap;margin:20px 0}.menu-preview{flex:1;min-width:240px}.menu-preview :deep(canvas){width:100%;height:auto;max-width:640px}.menu-controls{flex:1;min-width:240px}.menu-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-bottom:18px}.menu-options button{text-align:left;overflow-wrap:anywhere}button,textarea{font:inherit;padding:8px;border:1px solid #bac9dc;border-radius:6px}button{cursor:pointer;background:#edf3fb}button.selected{background:#176be0;color:white}button:disabled{opacity:.45;cursor:default}label{display:block;margin:12px 0}textarea{display:block;box-sizing:border-box;width:100%;resize:vertical;margin-top:8px;font-family:monospace;line-height:1.6}p{line-height:1.5;color:#526277}.error{color:#b12626}.actions{display:flex;gap:8px;flex-wrap:wrap}
</style>
