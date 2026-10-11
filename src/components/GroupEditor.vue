<template>
  <section class="group-editor">
    <div class="group-toolbar"><h2>{{ $t('Grupos') }} <small>{{ groups.length }} / {{ maxGroups }}</small></h2><button class="primary" :disabled="groups.length>=maxGroups" @click="addGroup">{{ $t('Agregar grupo') }}</button><button @click="$emit('restore')" :disabled="!modified">{{ $t('Restaurar grupos originales') }}</button></div>
    <p>{{ $t('Agrega o quita equipos en cada grupo. Un equipo puede participar en varios grupos.') }}</p>
    <p class="notice">{{ $t(columns===4?'En el juego, cada página muestra hasta cuatro equipos en una fila. Cambia la distribución en Configuración. Los grupos vacíos no aparecen en la selección.':'En el juego, cada página muestra hasta seis equipos en dos filas. Cambia la distribución en Configuración. Los grupos vacíos no aparecen en la selección.') }}</p>
    <div class="group-grid">
      <article v-for="(group,index) in groups" :key="index" class="group-card">
        <div class="group-toolbar"><label>{{ $t('Nombre del grupo') }} <input :value="group.name" maxlength="15" @change="rename(index,$event)" /></label><button :aria-label="$t('Quitar grupo')+' '+group.name" :disabled="groups.length===1" @click="removeGroup(index)">{{ $t('Quitar grupo') }}</button></div>
        <p>{{ group.teams.length }} {{ $t('equipos en el grupo') }}</p>
        <ul class="group-teams"><li v-for="team in group.teams" :key="team"><span>{{ $t(teams[team]) }}</span><button :aria-label="$t('Quitar equipo')+' '+$t(teams[team])" @click="removeTeam(index,team)">×</button></li></ul>
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
export default {
  props:{columns:{type:Number,default:3},groups:Array,teams:Array,modified:Boolean},emits:['change','restore'],
  data(){return {maxGroups:MAX_GROUPS,selectedGroup:null,selectedTeams:[],search:''};},
  computed:{filteredTeams(){return this.teams.map((name,index)=>({name,index})).filter(t=>t.name!==null).filter(t=>this.$t(t.name).toLowerCase().includes(this.search.toLowerCase()));}},
  methods:{
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
.group-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.group-toolbar h2{margin-right:auto}.group-toolbar small{font-size:14px;color:#526579}.group-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:16px;margin-top:20px}.group-card{padding:16px;background:white;border:1px solid #d4dce4;border-radius:10px}.group-card label{flex:1}.group-card input{display:block;width:calc(100% - 22px)}.group-teams{list-style:none;padding:0;display:flex;flex-wrap:wrap;gap:6px}.group-teams li{display:flex;align-items:center;background:#edf3f9;border-radius:6px;padding-left:9px}.group-teams button{border:0;background:transparent;font-size:18px}.empty{color:#526579}.notice{padding:10px;background:#fff0ca}button,input{padding:7px;font:inherit;border:1px solid #bbc8d6;border-radius:5px;margin:3px}button{cursor:pointer}button:disabled{opacity:.45;cursor:default}.primary{background:#176be0;color:white;border:0}.team-dialog{max-width:620px;width:calc(100% - 64px);border:0;border-radius:12px;padding:24px}.team-dialog::backdrop{background:#172a4080}.team-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));max-height:50vh;overflow:auto;margin:16px 0}.team-options label{display:flex;align-items:center;padding:5px}.team-options input{accent-color:#176be0}@media(max-width:500px){.team-options{grid-template-columns:1fr}.group-grid{grid-template-columns:1fr}}
</style>
