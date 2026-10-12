import { loRom } from './binary.mjs';
import { AUDIO_SAMPLES, decodeBrr } from './audio.mjs';
import { audioRegion, STREAMED } from './audio-edit.mjs';

const encode = bytes => {
  let text = '';
  for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(text);
};

// A hack may erase its title/header while retaining the original audio layout.
// Extract only the catalog's fixed BRR allocations, never arbitrary ROM patches.
export function createAudioPack(input, sourceName = '') {
  const header = input.length % 0x8000 === 512 ? 512 : 0;
  const rom = input.subarray(header);
  if (rom.length !== 0x200000) throw new Error('Se requiere una ROM ISS Deluxe de 2 MB, con o sin cabecera SMC.');
  return {
    format: 'iss-studio-audio', version: 1, sourceName,
    scope: '76 catalog BRR samples; excludes sequenced music and uncatalogued sounds',
    samples: AUDIO_SAMPLES.map(sample => {
      const region = audioRegion(rom, sample);
      decodeBrr(region.bytes, STREAMED.includes(sample.name));
      return { name: sample.name, brr: encode(region.bytes) };
    }),
  };
}

export function audioPackPatches(rom, pack) {
  if (pack?.format !== 'iss-studio-audio' || pack.version !== 1 || !Array.isArray(pack.samples) ||
      !pack.samples.length || pack.samples.length > AUDIO_SAMPLES.length) throw new Error('Paquete de audio no compatible.');
  const seen = new Set();
  return pack.samples.map(entry => {
    const sample = AUDIO_SAMPLES.find(s => s.name === entry?.name);
    if (!sample || seen.has(sample.name)) throw new Error('Muestra desconocida o duplicada en el paquete.');
    seen.add(sample.name);
    const region = audioRegion(rom, sample);
    if (region.offset + region.capacity > rom.length || typeof entry.brr !== 'string' ||
        entry.brr.length !== 4 * Math.ceil(region.capacity / 3) || !/^[A-Za-z0-9+/]*={0,2}$/.test(entry.brr)) throw new Error(`Tamaño BRR inválido: ${sample.name}.`);
    const bytes = Uint8Array.from(atob(entry.brr), c => c.charCodeAt(0));
    if (bytes.length !== region.capacity) throw new Error(`Tamaño BRR inválido: ${sample.name}.`);
    // Streamed/looping resources must retain the destination's protocol exactly.
    if (region.reason || region.segmented) for (let i = 0; i < bytes.length; i += 9) {
      if ((bytes[i] & 3) !== (region.bytes[i] & 3)) throw new Error(`Marcas BRR incompatibles: ${sample.name}.`);
    }
    decodeBrr(bytes, STREAMED.includes(sample.name));
    return { id: `audio:${loRom(sample.start)}`, offset: region.offset, label: `Audio · ${sample.name}`, bytes };
  });
}
