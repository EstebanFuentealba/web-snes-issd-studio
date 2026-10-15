import {loRom} from './binary.mjs';
import {audioStorage} from './audio-long.mjs';

// Compare the stored clip with its original allocation, independently of preview pitch.
export function audioSelectorStatus(rom,sample) {
  const storage=audioStorage(rom,sample);
  const nativeCapacity=Math.floor((loRom(sample.end)-storage.nativeOffset)/9)*9;
  const ratio=storage.capacity/nativeCapacity;
  return {time:ratio<=1?'Dentro del tiempo':ratio<=1.1?'Se pasa un poco':'Supera el tiempo',lowQuality:storage.playbackDivisor>1};
}
export function audioSelectorLabel(sample,title,status,translate=x=>x) {
  return `${translate(sample.name)} / ${title||translate('Sin título')} / ${translate(status.time)}${status.lowQuality?' · '+translate('Calidad reducida'):''}`;
}
