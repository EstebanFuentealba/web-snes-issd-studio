<template><canvas ref="canvas" :aria-label="$t(label)" role="img" :class="{ compact }" /></template>
<script>
export default {
  props: { matrix: Array, colors: Array, label: String, compact: Boolean, pixelColor: Function },
  mounted() { this.draw(); },
  watch: { pixelColor() { this.draw(); }, matrix: { handler() { this.draw(); }, deep: true }, colors: { handler() { this.draw(); }, deep: true } },
  methods: {
    draw() {
      const canvas = this.$refs.canvas;
      if (!canvas) return;
      canvas.width = this.matrix?.[0]?.length || 0;
      canvas.height = this.matrix?.length || 0;
      const ctx = canvas.getContext('2d');
      this.matrix?.forEach((row, y) => row.forEach((pixel, x) => {
        const color = this.pixelColor ? this.pixelColor(pixel, x, y, this.colors) : this.colors[pixel];
        if (color && color !== 'transparent') { ctx.fillStyle = color; ctx.fillRect(x, y, 1, 1); }
      }));
    },
  },
};
</script>
<style scoped>
canvas { image-rendering: pixelated; width: auto; height: 80px; max-width: 100%; background: #172a40; border: 1px solid #496077; }
canvas.compact { width: 32px; height: 32px; background: #eaf0f6; border: none; }
</style>
