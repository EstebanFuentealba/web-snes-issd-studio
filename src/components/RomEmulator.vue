<template>
  <section>
    <h2>{{ $t("Emulador SNES") }}</h2>
    <p>{{ $t("Prueba la ROM con los cambios aplicados al proyecto. El motor de EmulatorJS se descarga al abrir este menú y requiere internet.") }}</p>
    <div class="controls">
      <button @click="start">{{ $t(active ? 'Recargar ROM modificada' : 'Cargar ROM modificada') }}</button>
      <button @click="stop" :disabled="!active">{{ $t("Detener") }}</button>
    </div>
    <p v-if="active && loadedRevision !== revision" class="notice">{{ $t("Hay cambios nuevos. Recarga la ROM para probarlos; el juego comenzará desde el inicio.") }}</p>
    <p role="status">{{ $t(status) }}</p>
    <p v-if="error" class="error" role="alert">{{ $t(error) }}</p>
    <details class="test-panel" open>
      <summary>{{ $t("Panel de prueba") }}</summary>
      <div class="test-toolbar">
        <label>{{ $t("Mando") }} <select v-model.number="controller"><option :value="0">1P</option><option :value="1">2P</option></select></label>
        <label>{{ $t("Duración") }} <select v-model.number="duration"><option :value="150">150 ms</option><option :value="500">500 ms</option><option :value="1500">1.5 s</option></select></label>
        <button @click="command('restart')" :disabled="!running || busy">{{ $t("Reiniciar juego") }}</button>
        <button v-if="busy" @click="command('cancel')">{{ $t("Cancelar secuencia") }}</button>
      </div>
      <details class="guide"><summary>{{ $t("Guía para ir al selector") }}</summary>
        <p>{{ $t("Desde PRESS START: pulsa Start, luego A en OPEN GAME, A en el modo individual y A en 1P contra CPU. Espera a que aparezca cada menú antes de continuar.") }}</p>
      </details>
      <div class="pad" :aria-label="$t('Mando SNES de prueba')">
        <div class="directions">
          <button class="up" @click="press(4)" :disabled="!running || busy" :aria-label="$t('Arriba')">↑</button>
          <button class="left" @click="press(6)" :disabled="!running || busy" :aria-label="$t('Izquierda')">←</button>
          <button class="down" @click="press(5)" :disabled="!running || busy" :aria-label="$t('Abajo')">↓</button>
          <button class="right" @click="press(7)" :disabled="!running || busy" :aria-label="$t('Derecha')">→</button>
        </div>
        <div class="pad-buttons">
          <button v-for="key in padButtons" :key="key.index" @click="press(key.index)" :disabled="!running || busy" :aria-label="'SNES '+key.name">{{ key.name }}</button>
        </div>
      </div>
      <div class="test-toolbar">
        <label>{{ $t("Nombre de pantalla") }} <input v-model="bookmarkName" maxlength="40" :placeholder="$t('Ejemplo: EXTRA')" /></label>
        <button @click="saveScreen" :disabled="!running || busy || screens.length >= 8">{{ $t("Guardar pantalla") }}</button>
      </div>
      <div class="test-toolbar" v-if="screens.length">
        <button v-for="screen in screens" :key="screen.slot" @click="command('load-screen', {slot:screen.slot})" :disabled="!running || busy">{{ $t("Ir a") }} {{ screen.name }}</button>
      </div>
      <p class="hint">{{ $t("Las pantallas guardadas pertenecen a la ROM cargada y se borran al recargarla o detener el emulador.") }}</p>
      <p role="status" v-if="testStatus">{{ $t(testStatus) }}</p>
    </details>
    <iframe v-if="active" :key="session" ref="frame" :src="frameUrl+'?lang='+$locale" :title="$t(&quot;Emulador de la ROM ISSD modificada&quot;)" allow="autoplay; fullscreen; gamepad" allowfullscreen @load="sendRom" />
    <p>{{ $t("Haz clic en «Iniciar juego» dentro de la pantalla. En la barra del emulador puedes pausar, usar pantalla completa y configurar teclado o mando. Al salir de este menú se detiene la emulación.") }}</p>
  </section>
</template>

<script>
export default {
  props: { project: { type: Object, required: true }, revision: Number },
  data() {
    return { active: false, session: 0, loadedRevision: null, status: '', error: '', snapshot: null, timer: null,
      running: false, busy: false, controller: 0, duration: 150, commandId: 0, pendingCommand: null, bookmarkName: '', screens: [], testStatus: '',
      padButtons: [{name:'Select',index:2},{name:'Start',index:3},{name:'L',index:10},{name:'R',index:11},{name:'Y',index:1},{name:'X',index:9},{name:'B',index:0},{name:'A',index:8}],
      frameUrl: `${import.meta.env.BASE_URL}emulator/index.html` };
  },
  mounted() { window.addEventListener('message', this.receive); this.start(); },
  beforeUnmount() { this.stop(); window.removeEventListener('message', this.receive); },
  methods: {
    start() {
      this.stop(); this.error = '';
      try {
        // Use the same validated export as the download, without the copier header.
        this.snapshot = this.project.exportRom().slice(this.project.headerSize);
        this.loadedRevision = this.revision; this.session++; this.active = true;
        this.status = 'Cargando motor SNES…';
        this.timer = setTimeout(() => this.fail('La carga está tardando demasiado. Revisa tu conexión y vuelve a cargar la ROM.'), 60000);
      } catch (error) { this.fail(`No se pudo preparar la ROM: ${error.message}`); }
    },
    stop() {
      clearTimeout(this.timer); this.timer = null; this.active = false; this.snapshot = null;
      this.status = 'Emulador detenido.'; this.running = false; this.busy = false; this.pendingCommand = null; this.screens = []; this.testStatus = '';
    },
    fail(message) { this.stop(); this.error = message; },
    sendRom() {
      if (!this.active || !this.snapshot || !this.$refs.frame) return;
      const bytes = this.snapshot; this.snapshot = null;
      this.$refs.frame.contentWindow.postMessage({ type: 'issd:load-rom', bytes, language: this.$locale || 'es' }, window.location.origin, [bytes.buffer]);
    },
    press(index) { this.command('press', {index,player:this.controller,duration:this.duration}); },
    focusGame() {
      const frame = this.$refs.frame;
      if (!frame) return;
      frame.focus({ preventScroll: true });
      frame.contentWindow.postMessage({ type: 'issd:focus-game' }, window.location.origin);
    },
    saveScreen() {
      const slot = this.screens.length + 1;
      const name = this.bookmarkName.trim() || `${this.$t('Pantalla')} ${slot}`;
      this.command('save-screen', {slot}, name);
    },
    command(action, options = {}, name = '') {
      if(!this.running || !this.$refs.frame || (this.busy && action !== 'cancel'))return;
      const id = ++this.commandId;
      this.pendingCommand = {id,action,name,slot:options.slot}; this.busy = true; this.testStatus = 'Ejecutando control…';
      clearTimeout(this.timer); this.timer = setTimeout(()=>{this.busy=false;this.pendingCommand=null;this.testStatus='No se pudo ejecutar el control.';},25000);
      this.$refs.frame.contentWindow.postMessage({type:'issd:emulator-command',id,action,...options},window.location.origin);
    },
    receive(event) {
      if (!this.active || event.origin !== window.location.origin || event.source !== this.$refs.frame?.contentWindow) return;
      const data = event.data;
      if(data?.type === 'issd:emulator-command-result'){
        if(data.id !== this.pendingCommand?.id)return;
        clearTimeout(this.timer); this.timer=null;
        const pending = this.pendingCommand; this.pendingCommand = null; this.busy = false;
        this.testStatus = data.ok ? 'Control completado.' : 'No se pudo ejecutar el control.';
        if(data.ok && pending.action === 'save-screen'){
          this.screens.push({slot:pending.slot,name:pending.name}); this.bookmarkName = '';
        }
        if(data.ok && ['press', 'restart', 'load-screen', 'cancel'].includes(pending.action)) this.focusGame();
        return;
      }
      if (data?.type !== 'issd:emulator-status') return;
      if (data.state === 'error') { this.fail(data.message || 'No se pudo cargar el emulador. Vuelve a intentarlo.'); return; }
      if (data.state === 'ready' || data.state === 'running') {
        clearTimeout(this.timer); this.timer = null;
        this.running = data.state === 'running';
        if(this.running) this.focusGame();
        this.status = data.state === 'ready' ? 'ROM cargada. Pulsa «Iniciar juego» en la pantalla.' : 'Ejecutando ROM modificada.';
      }
    },
  },
};
</script>

<style scoped>
iframe{display:block;width:100%;height:560px;max-height:75vh;min-height:320px;border:0;border-radius:10px;background:#101820}
.controls{display:flex;gap:8px;flex-wrap:wrap}button{padding:8px 12px;font:inherit;border:1px solid #bbc8d6;border-radius:5px;cursor:pointer}button:disabled{opacity:.45;cursor:default}
.notice{padding:10px;background:#fff0ca}.error{color:#a32121}
.test-panel{margin:12px 0;padding:12px;border:1px solid #bbc8d6;border-radius:8px;background:#f3f7fb}.test-panel summary{font-weight:600;cursor:pointer}.test-toolbar{display:flex;flex-wrap:wrap;align-items:end;gap:8px;margin-top:12px}.test-toolbar label{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.test-toolbar input,.test-toolbar select{padding:6px;font:inherit;max-width:200px}.hint{font-size:.9em;color:#425467}.pad{display:flex;gap:18px;align-items:center;flex-wrap:wrap;margin:12px 0}.directions{display:grid;grid-template-columns:42px 42px 42px;grid-template-rows:42px 42px;gap:4px}.directions button{padding:0;font-size:22px}.up{grid-column:2}.left{grid-column:1;grid-row:2}.down{grid-column:2;grid-row:2}.right{grid-column:3;grid-row:2}.pad-buttons{display:flex;flex-wrap:wrap;gap:6px}.pad-buttons button{min-width:42px;background:#fff}
</style>
