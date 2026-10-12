<template>
  <div class="group-preview" :class="{ 'four-columns': columns === 4 }">
    <svg class="panel-frame" viewBox="0 0 256 132" preserveAspectRatio="none" aria-hidden="true">
      <path d="M4 3 H130 L133 6 V23 L136 26 H250 L253 29 V126 L250 129 H6 L3 126 V6 Z" fill="#080c83" stroke="#394bff" stroke-width="3" />
      <path d="M5 5 H129 L131 7 V24 L135 28 H249 L251 30 V125 L249 127 H7 L5 125 Z" fill="none" stroke="#00d8fa" stroke-width="1" />
    </svg>
    <div class="group-title">
      <RomImage v-if="title" :matrix="title.matrix" :colors="title.colors" :label="name" />
      <span v-else>{{ name }}</span>
    </div>
    <ul class="preview-teams" :style="{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }">
      <li v-for="(team, slot) in teamIds" :key="team" class="preview-team">
        <div class="flag-wrap" :class="{ 'first-slot': slot === 0 }">
          <RomImage :matrix="artwork[team].flag.matrix" :colors="artwork[team].flag.colors" :label="teams[team]" />
          <button class="remove-team" :aria-label="$t('Quitar equipo') + ' ' + $t(teams[team])" @click="$emit('remove', team)">×</button>
        </div>
        <RomImage class="team-label" :matrix="artwork[team].label.matrix" :colors="artwork[team].label.colors" :label="teams[team]" />
      </li>
    </ul>
  </div>
</template>
<script>
import RomImage from './RomImage.vue';
export default {
  components: { RomImage },
  props: { name: String, title: Object, teamIds: Array, artwork: Object, teams: Array, columns: Number },
  emits: ['remove'],
};
</script>
<style scoped>
.group-preview{position:relative;isolation:isolate;padding:12px 18px 24px;overflow:hidden;color:white;min-width:0}
.panel-frame{position:absolute;inset:0;width:100%;height:100%;z-index:-1}
.group-title{width:50%;height:48px;display:flex;align-items:center;justify-content:center;font-family:monospace;font-weight:bold;font-size:24px}
.group-title :deep(canvas){width:192px;height:auto;max-width:100%;background:transparent;border:0}
.preview-teams{list-style:none;padding:12px 0 0;margin:0;display:grid;gap:24px 8px;min-height:160px;align-content:start}
.four-columns .preview-teams{min-height:68px}
.preview-team{display:flex;flex-direction:column;align-items:center;min-width:0}
.flag-wrap{position:relative;display:flex;justify-content:center;width:72px;max-width:75%;aspect-ratio:3/2}
.flag-wrap :deep(canvas){width:100%;height:100%;max-width:none;background:transparent;border:0}
.first-slot::before{content:'';position:absolute;inset:-5px;border:3px solid #ffff00;outline:3px solid #263cff;box-shadow:0 0 0 5px #00d8fa;pointer-events:none}
.team-label{margin-top:4px}
.team-label:deep(canvas),canvas.team-label{width:96px;height:auto;max-width:100%;background:transparent;border:0}
.remove-team{position:absolute;top:-12px;right:-12px;width:24px;height:24px;padding:0;border:1px solid #bacbff;border-radius:50%;background:#071264;color:white;font:18px/1 sans-serif;cursor:pointer;opacity:0;transition:opacity .15s}
.flag-wrap:hover .remove-team,.flag-wrap:focus-within .remove-team{opacity:1}
.remove-team:focus-visible{outline:2px solid white;outline-offset:3px}
@media(hover:none){.remove-team{opacity:1}}
@media(max-width:500px){.group-preview{padding:8px 12px 18px}.group-title{height:36px}.group-title :deep(canvas){width:128px}.preview-teams{gap:20px 6px;min-height:128px}.four-columns .preview-teams{min-height:52px}.first-slot::before{inset:-3px;border-width:2px;outline-width:2px;box-shadow:0 0 0 3px #00d8fa}}
</style>
