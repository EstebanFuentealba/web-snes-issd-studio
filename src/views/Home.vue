<template>
  <header>
    <img src="/logo-issd-studio.png" width="150" :alt="$t('Web ISSD Studio')" />
    <LanguageSelector />
  </header>
  <main>
    <label for="rom" class="rom-drop" :class="{ dragging: romDragging && !loading }" @dragover.prevent="romDragging = !loading" @dragleave.prevent="romDragging = false" @drop.prevent="onDropRom">
      <strong>{{ $t("Subir o arrastrar un ROM") }}</strong>
      <span>{{ $t("SFC o SMC · ISS / ISS Deluxe (USA)") }}</span>
      <input id="rom" type="file" accept=".sfc,.smc" @change="onChangeFile" :disabled="loading" />
    </label>
    <p v-if="loading" role="status">{{ $t("Leyendo ROM…") }}</p>
    <p v-if="error" role="alert" class="error">{{ $t(error) }}</p>
    <StudioEditor ref="editor" v-if="session?.game === 'issd'" :input="session.input" @import-rom="loadFile($event, true)" />
    <template v-if="session && session.game !== 'issd'">
      <p>{{ $t(session.label) }} · {{ teams.length }} {{ $t("equipos ·") }} {{ $t(session.headerSize ? 'Cabecera SMC detectada' : 'Sin cabecera SMC') }}</p>
      <nav :aria-label="$t(&quot;Equipos&quot;)">
        <button @click="move(-1)" :disabled="loading">{{ $t("Anterior") }}</button>
        <select :aria-label="$t(&quot;Seleccionar equipo&quot;)" :value="teamIndex" @change="selectTeam(Number($event.target.value))" :disabled="loading">
          <option v-for="(name, index) in teams" :key="index" :value="index">{{ index + 1 }}. {{ $t(name) }}</option>
        </select>
        <button @click="move(1)" :disabled="loading">{{ $t("Siguiente") }}</button>
      </nav>
      <section v-if="teamData">
        <h2>{{ teamData.name }} <small>({{ $t(teams[teamIndex]) }})</small></h2>
        <div class="images">
          <figure><RomImage :matrix="teamData.flag" :colors="teamData.colors" :label="$t(&quot;Bandera del equipo&quot;)" /><figcaption>{{ $t("Bandera de la ROM") }}</figcaption></figure>
          <figure><RomImage :matrix="teamData.teamMatrix" :colors="teamData.teamColors" :label="$t(&quot;Rótulo del equipo&quot;)" /><figcaption>{{ $t("Rótulo de la ROM") }}</figcaption></figure>
        </div>
        <h3>{{ $t("Jugadores (") }}{{ teamData.players.length }})</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>{{ $t("Dorsal") }}</th><th>{{ $t("Nombre") }}</th><th v-if="session.game === 'issd'">{{ $t("Posición") }}</th><th>{{ $t("Pelo") }}</th><th v-if="session.game === 'issd'">{{ $t("Piel") }}</th><th>{{ $t("Datos") }}</th></tr></thead>
            <tbody><tr v-for="(player, index) in teamData.players" :key="index">
              <td>{{ $t(player.no) }}</td><td>{{ player.name }}</td><td v-if="session.game === 'issd'">{{ $t(positions[player.position] || player.position) }}</td>
              <td><div class="appearance"><RomImage v-if="player.head" compact :matrix="player.head" :colors="player.headColors" :label="$t(`Cabeza de ${player.name}, pelo ${player.hair}`)" /><span>{{ player.hair }}</span></div></td>
              <td v-if="session.game === 'issd'"><div class="appearance"><span class="skin-swatch" :style="{ backgroundColor: player.skinColor }" role="img" :aria-label="$t(`Piel de ${player.name}: ${player.skinColor}`)" :title="$t(player.skinColor)"></span><span>{{ player.skin }}</span></div></td>
              <td><details><summary>{{ $t("Ver atributos") }}</summary><pre>{{ JSON.stringify(playerAttributes(player), null, 2) }}</pre></details></td>
            </tr></tbody>
          </table>
        </div>
      </section>
      <section v-if="session.game === 'issd'" class="audio-section">
        <h2>{{ $t("Audio de la ROM") }}</h2>
        <p>{{ $t("Voces y muestras BRR extraídas del archivo abierto. La velocidad de previsualización es ajustable; la música secuenciada requiere el motor SPC700.") }}</p>
        <label for="sample">{{ $t("Muestra") }}</label>
        <select id="sample" v-model.number="sampleIndex" @change="clearAudio">
          <option v-for="(sample, index) in audioSamples" :key="index" :value="index">{{ $t(sample.name) }}</option>
        </select>
        <label for="rate">{{ $t("Frecuencia de previsualización") }}</label>
        <select id="rate" v-model.number="sampleRate" @change="clearAudio"><option :value="8000">{{ $t("8 kHz") }}</option><option :value="16000">{{ $t("16 kHz") }}</option><option :value="32000">{{ $t("32 kHz") }}</option></select>
        <button @click="prepareAudio">{{ $t("Cargar audio") }}</button>
        <p v-if="audioError" class="error" role="alert">{{ $t(audioError) }}</p>
        <div v-if="audioUrl" class="audio-output"><audio :key="audioUrl" controls :src="audioUrl" /><a :href="audioUrl" :download="audioSamples[sampleIndex].name + '.wav'">{{ $t("Descargar WAV") }}</a></div>
      </section>
    </template>
  </main>
</template>
<script>
import { markRaw } from 'vue';
import LanguageSelector from '../components/LanguageSelector.vue';
import RomImage from '../components/RomImage.vue';
import StudioEditor from '../components/StudioEditor.vue';
import Storage from '../utils/Storage';
import { openRom } from '../rom/binary.mjs';
import { teamNames, readTeam } from '../rom/studio';
import { AUDIO_SAMPLES, DEFAULT_SAMPLE_RATE, readAudioSample, wavBlob } from '../rom/audio.mjs';
export default {
  components: { RomImage, StudioEditor, LanguageSelector },
  data() {
    return {
      session: null, teamData: null, teams: [], teamIndex: 0, loading: false, romDragging: false, error: '',
      storage: markRaw(new Storage()), audioSamples: AUDIO_SAMPLES, sampleIndex: AUDIO_SAMPLES.findIndex(s => s.name === 'TitleScreenNameDrop'),
      sampleRate: DEFAULT_SAMPLE_RATE, audioUrl: '', audioError: '', loadVersion: 0,
      positions: { 1: 'Portero', 2: 'Defensa', 3: 'Medio defensivo', 4: 'Mediocampo', 5: 'Medio ofensivo', 6: 'Delantero' },
    };
  },
  mounted() {
    const version = this.loadVersion;
    this.storage.init(() => this.storage.get(file => {
      if (file && version === this.loadVersion) this.loadFile(file);
    }));
  },
  beforeUnmount() { this.loadVersion++; this.clearAudio(); },
  methods: {
    playerAttributes({ head, headColors, skinColor, ...attributes }) { return Object.fromEntries(Object.entries(attributes).map(([key,value]) => [this.key,value])); },
    async loadFile(file, save = false) {
      const version = ++this.loadVersion;
      this.loading = true; this.error = ''; this.teamData = null; this.session = null; this.teams = []; this.clearAudio();
      try {
        const input = new Uint8Array(await file.arrayBuffer());
        const session = { ...openRom(input), input };
        const data = await readTeam(session, 0);
        if (version !== this.loadVersion) return;
        this.session = markRaw(session); this.teams = teamNames(session.game); this.teamIndex = 0; this.teamData = data;
        if (save && this.storage.database) this.storage.set(file);
      } catch (error) { if (version === this.loadVersion) this.error = error.message; }
      finally { if (version === this.loadVersion) this.loading = false; }
    },
    importRomFile(file) { if (file && !this.loading && (!this.$refs.editor || this.$refs.editor.allowNavigate())) this.loadFile(file, true); },
    onChangeFile(event) { this.importRomFile(event.target.files?.[0]); event.target.value = ''; },
    onDropRom(event) { this.romDragging = false; this.importRomFile(event.dataTransfer?.files?.[0]); },
    move(step) { this.selectTeam((this.teamIndex + step + this.teams.length) % this.teams.length); },
    async selectTeam(index) {
      if (!this.session || this.loading) return;
      this.loading = true; this.error = ''; this.teamData = null;
      try { this.teamData = await readTeam(this.session, index); this.teamIndex = index; }
      catch (error) { this.error = error.message; }
      finally { this.loading = false; }
    },
    clearAudio() { if (this.audioUrl) URL.revokeObjectURL(this.audioUrl); this.audioUrl = ''; this.audioError = ''; },
    prepareAudio() {
      this.clearAudio();
      try { this.audioUrl = URL.createObjectURL(wavBlob(readAudioSample(this.session.rom, this.audioSamples[this.sampleIndex]), this.sampleRate)); }
      catch (error) { this.audioError = error.message; }
    },
  },
};
</script>
<style scoped>
main { max-width: 1050px; margin: 32px auto; padding: 0 20px; font-family: system-ui, sans-serif; color: #172a40; }
header { 
  max-width: 1050px;
  margin: 32px auto; padding: 0 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
 }
h1 { margin-bottom: 24px; } input, select, button { margin: 6px; padding: 8px; font: inherit; }
button { cursor: pointer; } nav, .images, .audio-output { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.rom-drop { display: flex; flex-direction: column; align-items: center; gap: 8px; margin: 20px 0; padding: 22px; border: 2px dashed #92abc5; border-radius: 10px; background: #f0f5fa; cursor: pointer; }
.rom-drop.dragging { background: #deedff; border-color: #176be0; }
.rom-drop:focus-within { outline: 3px solid #176be0; outline-offset: 2px; }
.rom-drop span { font-size: 14px; color: #516579; }
.rom-drop input { max-width: 100%; }
figure { margin: 12px 0; } figcaption { font-size: 13px; margin-top: 6px; } small { font-size: 14px; font-weight: normal; }
.error { color: #a32121; } table { border-collapse: collapse; width: 100%; } th, td { padding: 8px 14px; text-align: left; border-bottom: 1px solid #d4dce4; } th { background: #eaf0f6; }
.table-wrap { overflow-x: auto; } pre { font-size: 12px; } summary { cursor: pointer; } .audio-section { margin: 32px 0; padding-top: 16px; border-top: 1px solid #d4dce4; } .audio-section label { display: inline-block; margin-left: 8px; }
.appearance { display: flex; align-items: center; gap: 8px; }
.skin-swatch { display: inline-block; width: 20px; height: 20px; flex: 0 0 20px; box-shadow: inset 0 0 0 1px #172a4033; }
</style>
