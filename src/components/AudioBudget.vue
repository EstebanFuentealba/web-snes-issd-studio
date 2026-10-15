<template>
  <div class="audio-budget">
    <div class="budget-heading"><strong>{{ $t('Espacio de audio') }}</strong><span>{{ size(budget.used) }} / {{ size(budget.capacity) }}</span></div>
    <div class="budget-total" :aria-label="$t('Espacio de audio')">
      <button v-for="row in budget.rows" :key="row.name" type="button" class="budget-segment" :class="{hatched:row.overflow,selected:row.index===selected}" :style="{width:(row.weight/Math.max(budget.capacity,budget.used)*100)+'%',backgroundColor:color(row.index)}" :title="label(row)" :aria-label="label(row)" @click="$emit('select',row.index)"></button>
    </div>
    <p class="budget-caption">{{ budget.banks }} / {{ budget.maxBanks }} {{ $t('bancos de audio largo usados') }} · {{ $t('Cada audio largo reserva 32 KiB; el espacio original se conserva.') }}</p>
    <p v-if="budget.overflow" class="notice" role="status">{{ $t('Los sonidos achurados exceden su capacidad o no tienen un banco libre. Reduce el recorte antes de aplicarlo.') }}</p>
    <details>
      <summary>{{ $t('Peso de cada sonido') }}</summary>
      <div class="budget-rows">
        <button v-for="row in budget.rows" :key="row.name" type="button" class="budget-row" :class="{active:row.index===selected}" :title="label(row)" @click="$emit('select',row.index)">
          <span class="budget-name">{{ $t(row.name) }}<span v-if="titles[row.name]"> / {{ titles[row.name] }}</span><small v-if="row.preview"> · {{ $t('Recorte pendiente') }}</small></span>
          <span class="budget-size">{{ size(row.bytes) }} / {{ size(row.limit) }}</span>
          <span class="budget-track"><span class="budget-fill" :class="{hatched:row.overflow}" :style="{width:Math.min(100,row.bytes/row.limit*100)+'%',backgroundColor:color(row.index)}"></span></span>
          <small v-if="row.overflow" class="budget-exceeded">{{ $t('Excede el espacio') }}</small>
        </button>
      </div>
    </details>
  </div>
</template>
<script>
export default {
  props:{budget:{type:Object,required:true},selected:{type:Number,default:0},titles:{type:Object,default:()=>({})}},
  emits:['select'],
  methods:{
    size(bytes){return `${(bytes/1024).toFixed(1)} KiB`;},
    color(index){return `hsl(${index*137.508%360}, 60%, 46%)`;},
    label(row){return `${this.$t(row.name)}${this.titles[row.name]?' / '+this.titles[row.name]:''} · ${this.size(row.bytes)} / ${this.size(row.limit)} BRR${row.overflow?' · '+this.$t('Excede el espacio'):''}`;}
  }
};
</script>
<style scoped>
.audio-budget{margin:16px 0;padding:12px;border:1px solid #d5dce5;border-radius:8px;background:#fff}
.budget-heading{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:.9rem}
.budget-total{display:flex;height:18px;overflow:hidden;background:#e2e8f0;border-radius:4px;margin-top:9px}
.budget-segment{padding:0;margin:0;min-width:1px;border:0;border-right:1px solid #ffffff70;border-radius:0;flex-shrink:0;cursor:pointer}
.budget-segment.selected{box-shadow:inset 0 0 0 2px #172b4d}
.budget-caption{font-size:.8rem;color:#475569;margin:8px 0}
summary{cursor:pointer;font-size:.875rem}
.budget-rows{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-top:10px}
.budget-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 8px;text-align:left;background:#f8fafc;border:1px solid #e2e8f0;border-radius:5px;padding:7px;margin:0;color:#1e293b;font-size:.75rem;cursor:pointer}
.budget-row.active{border-color:#2563eb;background:#eff6ff}
.budget-name{overflow-wrap:anywhere}.budget-size{white-space:nowrap;font-variant-numeric:tabular-nums}
.budget-track{grid-column:1/-1;display:block;height:6px;background:#e2e8f0;border-radius:2px;overflow:hidden}
.budget-fill{display:block;height:100%}
.hatched{background-image:repeating-linear-gradient(135deg,transparent 0,transparent 3px,rgba(0,0,0,.65) 3px,rgba(0,0,0,.65) 5px)!important}
.budget-exceeded{grid-column:1/-1;color:#b91c1c}
@media(max-width:700px){.budget-rows{grid-template-columns:1fr}}
</style>
