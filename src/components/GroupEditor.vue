<template>
  <section class="group-editor">
    <div class="group-toolbar"><h2>{{ $t('Grupos') }} <small>{{ groups.length }} / {{ maxGroups }}</small></h2><button class="primary" :disabled="groups.length>=maxGroups" @click="addGroup">{{ $t('Agregar grupo') }}</button><button @click="$emit('restore')" :disabled="!modified">{{ $t('Restaurar grupos originales') }}</button></div>
    <p>{{ $t('Agrega o quita equipos en cada grupo. Un equipo puede participar en varios grupos.') }}</p>
    <label class="columns-setting">{{ $t('Columnas en Grupos') }}
      <select :value="columns" @change="$emit('columns-change',Number($event.target.value))">
        <option :value="3">{{ $t('3 columnas · 2 filas') }}</option>
        <option :value="4">{{ $t('4 columnas · 1 fila') }}</option>
      </select>
    </label>
    <p class="notice">{{ $t('La ROM exportada usa esta distribución. Los grupos se dividen en páginas de seis o cuatro equipos según la opción elegida.') }}</p>
    <div class="group-grid">
      <article v-for="(group,index) in groups" :key="index" class="group-card">
        <div class="group-toolbar"><label>{{ $t('Nombre del grupo') }} <input :value="group.name" maxlength="15" @change="rename(index,$event)" /></label><button :aria-label="$t('Quitar grupo')+' '+group.name" :disabled="groups.length===1" @click="removeGroup(index)">{{ $t('Quitar grupo') }}</button></div>
        <p>{{ group.teams.length }} {{ $t('equipos en el grupo') }}</p>
        <div v-for="(page,pageIndex) in pages(group)" :key="pageIndex" class="group-page">
          <p v-if="group.teams.length > pageSize" class="page-number">{{ pageIndex + 1 }} / {{ pages(group).length }}</p>
          <GroupPreview :name="group.name" :title="titles[index]" :team-ids="page" :artwork="artwork" :teams="teams" :columns="columns" @remove="removeTeam(index,$event)" />
        </div>
        <p v-if="!group.teams.length" class="empty">{{ $t('Este grupo todavía no tiene equipos.') }}</p>
        <button @click="openTeams(index)">{{ $t('Agregar o elegir equipos') }}</button>
      </article>
    </div>
    <dialog ref="teamDialog" class="team-dialog" @cancel="closeTeams">
      <template v-if="selectedGroup!==null && groups[selectedGroup]">
        <h3>{{ $t('Equipos del grupo') }} · {{ groups[selectedGroup].name }}</h3>
        <input v-model="search" :placeholder="$t('Buscar equipo')" :aria-label="$t('Buscar equipo')" />
        <p>{{ selectedTeams.length }} {{ $t('equipos seleccionados') }}</p>
        <div class="team-options"><label v-for="option in filteredTeams" :key="option.index"><input type="checkbox" :value="option.index" v-model="selectedTeams" />{{ $t(option.name) }}</label></div>
        <div class="group-toolbar"><button class="primary" @click="applyTeams">{{ $t('Guardar equipos del grupo') }}</button><button @click="closeTeams">{{ $t('Cancelar') }}</button></div>
      </template>
    </dialog>
  </section>
</template>
<script>
import {MAX_GROUPS} from '../rom/groups.mjs';
import {flagMatrix,smallLabelMatrix,selectionGroupGraphics} from '../rom/graphics.mjs';
import {palette,loRom} from '../rom/binary.mjs';
import {teamPointer} from '../rom/team-count.mjs';
import GroupPreview from './GroupPreview.vue';
export default {
  components:{GroupPreview},
  props:{rom:Uint8Array,columns:{type:Number,default:3},groups:Array,teams:Array,modified:Boolean},emits:['change','restore','columns-change'],
  data(){return {maxGroups:MAX_GROUPS,selectedGroup:null,selectedTeams:[],search:''};},
  computed:{
    pageSize(){return this.columns===4?4:6;},
    titles(){return selectionGroupGraphics(this.rom);},
    artwork(){return Object.fromEntries([...new Set(this.groups.flatMap(g=>g.teams))].map(team=>{
      const colors=new Array(16).fill('transparent');
      colors.splice(12,4,...palette(this.rom,loRom(0x890000|teamPointer(this.rom,0xe7d8,team))+2,4));
      return [team,{flag:{matrix:flagMatrix(this.rom,team),colors},label:{matrix:smallLabelMatrix(this.rom,team),colors:['transparent','#ffffff','#b8b8b8','#555555']}}];
    }));},
    filteredTeams(){return this.teams.map((name,index)=>({name,index})).filter(t=>t.name!==null).filter(t=>this.$t(t.name).toLowerCase().includes(this.search.toLowerCase()));}},
  methods:{
    pages(group){const pages=[];for(let i=0;i<group.teams.length;i+=this.pageSize)pages.push(group.teams.slice(i,i+this.pageSize));return pages;},
    copy(){return this.groups.map(g=>({name:g.name,teams:g.teams.slice()}));},
    addGroup(){const groups=this.copy();let n=1;while(groups.some(g=>g.name===`GRUPO ${n}`))n++;groups.push({name:`GRUPO ${n}`,teams:[]});this.$emit('change',groups);},
    rename(index,event){const groups=this.copy();groups[index].name=event.target.value;this.$emit('change',groups);event.target.value=this.groups[index].name;},
    removeGroup(index){const groups=this.copy();groups.splice(index,1);this.$emit('change',groups);},
    removeTeam(index,team){const groups=this.copy();groups[index].teams=groups[index].teams.filter(t=>t!==team);this.$emit('change',groups);},
    openTeams(index){this.selectedGroup=index;this.selectedTeams=this.groups[index].teams.slice();this.search='';this.$nextTick(()=>this.$refs.teamDialog.showModal());},
    closeTeams(){this.$refs.teamDialog.close();this.selectedGroup=null;},
    applyTeams(){const groups=this.copy();groups[this.selectedGroup].teams=this.selectedTeams.slice();this.$emit('change',groups);this.closeTeams();},
  },
};
</script>
<style scoped>
.columns-setting{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.group-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.group-toolbar h2{margin-right:auto}.group-toolbar small{font-size:14px;color:#526579}.group-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,520px),1fr));gap:16px;margin-top:20px}.group-card{padding:16px;background:white;border:1px solid #d4dce4;border-radius:10px}.group-card label{flex:1}.group-card input{display:block;width:calc(100% - 22px)}.group-page{margin:12px 0}.page-number{margin:8px 0;color:#526579;font-size:12px;text-align:right;font-variant-numeric:tabular-nums}.empty{color:#526579}.notice{padding:10px;background:#fff0ca}button,input,select{padding:7px;font:inherit;border:1px solid #bbc8d6;border-radius:5px;margin:3px}button{cursor:pointer}button:disabled{opacity:.45;cursor:default}.primary{background:#176be0;color:white;border:0}.team-dialog{max-width:620px;width:calc(100% - 64px);border:0;border-radius:12px;padding:24px}.team-dialog::backdrop{background:#172a4080}.team-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));max-height:50vh;overflow:auto;margin:16px 0}.team-options label{display:flex;align-items:center;padding:5px}.team-options input{accent-color:#176be0}@media(max-width:500px){.team-options{grid-template-columns:1fr}.group-grid{grid-template-columns:1fr}}
</style>
