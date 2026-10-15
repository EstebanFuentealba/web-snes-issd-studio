import {audioStorage} from './audio-long.mjs';
import { loRom } from './binary.mjs';
import { AUDIO_SAMPLES } from './audio-catalog.mjs';
export { AUDIO_SAMPLES };
export const DEFAULT_SAMPLE_RATE = 8000;

import {decodeBrr} from './audio-brr.mjs';
export {decodeBrr};

export function readAudioSample(rom, sample,playback=false) {
  const region=audioStorage(rom,sample);
  const start = playback&&region.extended?region.playbackOffset:region.offset, end = region.extended?start+(playback?region.playbackCapacity:region.capacity):loRom(sample.end);
  if (end > rom.length || end <= start) throw new Error('Muestra fuera de la ROM.');
  let bytes = rom.slice(start, end);
  // Five catalog ranges include three zero padding bytes after the final block.
  const padding = bytes.length % 9;
  if (padding) {
    if (padding !== 3 || bytes.slice(-padding).some(byte => byte !== 0)) throw new Error('Muestra BRR incompleta.');
    bytes = bytes.slice(0, -padding);
  }
  const streamed = ['TitleScreenNameDrop', 'VictoryMusic', 'UnknownShout', 'UnknownIntroSample'].includes(sample.name);
  return decodeBrr(bytes, streamed);
}

export function wavBlob(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2), data = new DataView(buffer);
  const text = (offset, value) => Array.from(value).forEach((char, i) => data.setUint8(offset + i, char.charCodeAt(0)));
  text(0, 'RIFF'); data.setUint32(4, buffer.byteLength - 8, true); text(8, 'WAVE'); text(12, 'fmt ');
  data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, 1, true);
  data.setUint32(24, sampleRate, true); data.setUint32(28, sampleRate * 2, true); data.setUint16(32, 2, true); data.setUint16(34, 16, true);
  text(36, 'data'); data.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, index) => data.setInt16(44 + index * 2, sample, true));
  return new Blob([buffer], { type: 'audio/wav' });
}
