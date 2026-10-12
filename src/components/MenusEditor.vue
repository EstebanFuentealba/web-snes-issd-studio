<template>
  <section class="menus-editor">
    <h2>{{ $t('Menus') }}</h2>
    <div class="menu-tabs" role="tablist" :aria-label="$t('Menus')">
      <button v-for="(tab,index) in tabs" :id="`menu-tab-${tab.id}`" :key="tab.id"
        type="button" role="tab" :aria-selected="active===tab.id" :aria-controls="`menu-panel-${tab.id}`"
        :tabindex="active===tab.id?0:-1" :class="{selected:active===tab.id}"
        @click="active=tab.id" @keydown="navigateTabs($event,index)">{{ $t(tab.label) }}</button>
    </div>
    <div v-show="active==='main'" id="menu-panel-main" role="tabpanel" aria-labelledby="menu-tab-main" tabindex="0" class="menu-panel">
      <MainMenuEditor ref="mainEditor" :rom="rom" :original="original" :error="error" @change="$emit('change',$event)" />
    </div>
    <div v-for="tab in tabs.slice(1)" v-show="active===tab.id" :id="`menu-panel-${tab.id}`" :key="tab.id"
      role="tabpanel" :aria-labelledby="`menu-tab-${tab.id}`" tabindex="0" class="menu-panel">
      <MenuTextEditor :ref="editor=>setTextEditor(tab.id,editor)" :screen-id="tab.id" :rom="rom" :original="original" :error="error" @change="$emit('change',$event)" />
    </div>
  </section>
</template>

<script>
import {MENU_TABS} from '../navigation.mjs';
import MainMenuEditor from './MainMenuEditor.vue';
import MenuTextEditor from './MenuTextEditor.vue';

export default {
  components:{MainMenuEditor,MenuTextEditor},
  props:{rom:Uint8Array,original:Uint8Array,error:String},
  emits:['change'],
  data(){return {
    textEditors:{},tabs:MENU_TABS,
  };},
  computed:{
    active:{
      get(){return this.$route?.meta.menuTab||'main';},
      set(tab){this.$router.push({name:`menu-${tab}`});},
    },
    dirty(){return !!this.$refs.mainEditor?.dirty||Object.values(this.textEditors).some(editor=>editor.dirty);},
  },
  methods:{
    setTextEditor(id,editor){if(editor){if(this.textEditors[id]!==editor)this.textEditors[id]=editor;}else delete this.textEditors[id];},
    async navigateTabs(event,index){
      let next;
      if(event.key==='ArrowRight')next=(index+1)%this.tabs.length;
      else if(event.key==='ArrowLeft')next=(index+this.tabs.length-1)%this.tabs.length;
      else if(event.key==='Home')next=0;
      else if(event.key==='End')next=this.tabs.length-1;
      else return;
      event.preventDefault();
      await this.$router.push({name:`menu-${this.tabs[next].id}`});
      this.$nextTick(()=>document.getElementById(`menu-tab-${this.active}`)?.focus());
    },
  },
};
</script>

<style scoped>
.menu-tabs{display:flex;flex-wrap:wrap;gap:6px;border-bottom:1px solid #bac9dc;padding-bottom:12px;margin-bottom:20px}
.menu-tabs button{font:inherit;padding:10px 14px;border:1px solid #bac9dc;border-radius:6px;background:#edf3fb;color:#243b53;cursor:pointer}
.menu-tabs button.selected{background:#176be0;border-color:#176be0;color:white}
.menu-tabs button:focus-visible,.menu-panel:focus-visible{outline:3px solid #176be0;outline-offset:3px}
.menu-panel{min-width:0}
</style>
