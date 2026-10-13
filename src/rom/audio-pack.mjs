import {hasLongAudio,LONG_AUDIO,longAudioPatches,restoreLongAudioPatches} from './audio-long.mjs';
import {expandedRomBuffer} from './expanded-layout.mjs';
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
  if (![0x200000,0x400000].includes(rom.length)) throw new Error('Se requiere una ROM ISS Deluxe de 2 MB, con o sin cabecera SMC.');
  return {
    format: 'iss-studio-audio', version: hasLongAudio(rom)?2:1, sourceName,
    scope: '76 catalog BRR samples; excludes sequenced music and uncatalogued sounds',
    samples: AUDIO_SAMPLES.map(sample => {
      const region = audioRegion(rom, sample);
      decodeBrr(region.bytes, STREAMED.includes(sample.name));
      return { name: sample.name, brr: encode(region.bytes),...(region.extended?{long:true}:{}) };
    }),
  };
}

export function audioPackPatches(rom, pack) {
  if (pack?.format !== 'iss-studio-audio' || ![1,2].includes(pack.version) || !Array.isArray(pack.samples) ||
      !pack.samples.length || pack.samples.length > AUDIO_SAMPLES.length) throw new Error('Paquete de audio no compatible.');
  if(pack.version===2&&!pack.samples.some(s=>s?.long===true))throw new Error('Paquete de audio no compatible.');
  const seen=new Set(),changes=new Map(),context=expandedRomBuffer(rom);
  const apply=patches=>{for(const p of patches){context.set(p.bytes,p.offset);changes.set(p.id,p);}};
  for(const entry of pack.samples){
    const sample=AUDIO_SAMPLES.find(s=>s.name===entry?.name);
    if(!sample||seen.has(sample.name))throw new Error('Muestra desconocida o duplicada en el paquete.');seen.add(sample.name);
    const region=audioRegion(context,sample),nativeCapacity=Math.floor((loRom(sample.end)-loRom(sample.start))/9)*9;
    const long=pack.version===2&&entry.long===true;
    if(typeof entry.brr!=='string'||entry.brr.length>(long?4*Math.ceil(LONG_AUDIO.capacity/3):4*Math.ceil(nativeCapacity/3))||!/^[A-Za-z0-9+/]*={0,2}$/.test(entry.brr))throw new Error(`Tamaño BRR inválido: ${sample.name}.`);
    const bytes=Uint8Array.from(atob(entry.brr),c=>c.charCodeAt(0));
    if(!bytes.length||bytes.length%9||(!long&&bytes.length!==nativeCapacity))throw new Error(`Tamaño BRR inválido: ${sample.name}.`);
    decodeBrr(bytes,STREAMED.includes(sample.name));
    if(long){if(region.reason||!region.canExtend)throw new Error(`Marcas BRR incompatibles: ${sample.name}.`);apply(longAudioPatches(context,sample,bytes));continue;}
    if(region.extended)apply(restoreLongAudioPatches(new Uint8Array(0),context,sample));
    const destination=audioRegion(context,sample);
    if(destination.reason||destination.segmented)for(let i=0;i<bytes.length;i+=9)if((bytes[i]&3)!==(destination.bytes[i]&3))throw new Error(`Marcas BRR incompatibles: ${sample.name}.`);
    apply([{id:`audio:${loRom(sample.start)}`,offset:loRom(sample.start),label:`Audio · ${sample.name}`,bytes}]);
  }
  return [...changes.values()];
}
