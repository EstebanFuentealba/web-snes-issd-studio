<template><svg viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true"><rect v-for="(n,i) in notes" :key="i" :x="(n.tick-start)/span*1000" :y="88-(n.pitch-low)/range*72" :width="Math.max(2,n.duration/span*1000)" height="5" fill="currentColor" /></svg></template>
<script>
export default {props:{notes:{type:Array,default:()=>[]},start:Number,span:Number},computed:{low(){return this.notes.length?Math.min(...this.notes.map(n=>n.pitch)):0;},range(){return Math.max(12,...this.notes.map(n=>n.pitch-this.low));}}};
</script>
<style scoped>svg{display:block;width:100%;height:100%;pointer-events:none;overflow:hidden}</style>
