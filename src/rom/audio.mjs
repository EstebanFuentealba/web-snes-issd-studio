import {audioStorage} from './audio-long.mjs';
import { loRom } from './binary.mjs';
import { AUDIO_SAMPLES } from './audio-catalog.mjs';
export { AUDIO_SAMPLES };
export const DEFAULT_SAMPLE_RATE = 8000;

// BRR predictor/filter arithmetic follows the SNES half-scale domain.
// Reference: issd-native/deps/snesrecomp/runner/src/snes/dsp.c.
export function decodeBrr(bytes, streamed = false) {
  if (!bytes.length || bytes.length % 9) throw new Error('Muestra BRR incompleta.');
  const samples = [];
  let previous = 0, older = 0;
  for (let block = 0; block < bytes.length; block += 9) {
    const header = bytes[block], shift = header >>> 4, filter = (header >>> 2) & 3;
    for (let n = 0; n < 16; n++) {
      const packed = bytes[block + 1 + (n >>> 1)];
      let value = n % 2 ? packed & 15 : packed >>> 4;
      if (value > 7) value -= 16;
      value = shift <= 12 ? (value << shift) >> 1 : value & ~0x7ff;
      if (filter === 1) value += previous + (-previous >> 4);
      if (filter === 2) value += 2 * previous + (3 * -previous >> 5) - older + (older >> 4);
      if (filter === 3) value += 2 * previous + (13 * -previous >> 6) - older + (3 * older >> 4);
      value = Math.max(-32768, Math.min(32767, value));
      value = ((value & 0x7fff) << 17) >> 17;
      older = previous; previous = value;
      samples.push(value * 2);
    }
    // Preview plays once, even for samples carrying a loop flag.
    if ((header & 1) && !streamed) return Int16Array.from(samples);
  }
  if (bytes[bytes.length - 9] & 1) return Int16Array.from(samples);
  throw new Error('La muestra BRR no tiene bloque final.');
}

export function readAudioSample(rom, sample) {
  const region=audioStorage(rom,sample);
  const start = region.offset, end = region.extended?start+region.capacity:loRom(sample.end);
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
